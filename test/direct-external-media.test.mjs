import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,realpath,stat,symlink,unlink,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {findFFmpeg,defaultSettings} from '../src/runtime-paths.mjs';
import {createActions,normalizeLibrary} from '../src/wallpaper-actions.mjs';
import {resolveAuthorizedMedia,bindMediaFile} from '../src/media-file-source.mjs';
import {libraryPreview} from '../src/library-preview.mjs';
import {removeManagedFile} from '../src/media-store.mjs';
import {planMedia} from '../src/media-preflight.mjs';

const run=promisify(execFile);

async function createFixtures(dir){
 const ffmpeg=await findFFmpeg();
 const mp4Audio=path.join(dir,'compat-audio.mp4');
 const pngSmall=path.join(dir,'compat.png');
 const pngBackup=path.join(dir,'healthy.png');
 const oversizedMp4=path.join(dir,'oversized-1080p60.mp4');
 const webmCompatSize=path.join(dir,'incompatible.webm');
 await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','testsrc2=size=640x360:rate=24','-f','lavfi','-i','sine=frequency=440','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',mp4Audio],{windowsHide:true});
 await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','color=c=0x336699:s=640x360:d=1','-frames:v','1',pngSmall],{windowsHide:true});
 await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','color=c=0x228844:s=320x180:d=1','-frames:v','1',pngBackup],{windowsHide:true});
 await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','testsrc2=size=1920x1080:rate=60','-t','1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',oversizedMp4],{windowsHide:true});
 await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','color=c=0x883322:s=320x180:r=24','-t','1','-c:v','libvpx',webmCompatSize],{windowsHide:true});
 return {mp4Audio,pngSmall,pngBackup,oversizedMp4,webmCompatSize};
}

test('direct external reference imports compatible image and MP4 (with audio) with zero media copies, while oversized/incompatible media still transcodes',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'cwb-direct-import-'));
 const root=path.join(temp,'data'),ext=path.join(temp,'external');
 await mkdir(path.join(root,'media'),{recursive:true});await mkdir(ext);
 const {mp4Audio,pngSmall,oversizedMp4,webmCompatSize}=await createFixtures(ext);
 const settings=defaultSettings();normalizeLibrary(settings);
 const owner={};
 let pickedFiles=[];
 const actions=createActions(root,settings,async()=>{},undefined,{configureMedia:async()=>{},pickMediaFile:async()=>({file:pickedFiles[0],files:pickedFiles})});

 // 1. Compatible MP4 with audio -> direct external reference, zero files in media/.
 pickedFiles=[mp4Audio];
 let picked=await actions(owner,{action:'media-pick',operationId:'pick-mp4'});
 await actions(owner,{action:'wallpaper-engine',projectToken:picked.projectToken,apply:true});
 const mp4Entry=settings.library[0];
 assert.equal(mp4Entry.file,await realpath(mp4Audio));
 assert.equal(mp4Entry.sourcePath,await realpath(mp4Audio));
 assert.equal(mp4Entry.importInfo.route,'direct');
 assert.equal(mp4Entry.importInfo.direct,true);
 assert.deepEqual(await readdir(path.join(root,'media')),[]);

 // 2. Compatible PNG -> direct external reference, still zero files in media/.
 pickedFiles=[pngSmall];
 picked=await actions(owner,{action:'media-pick',operationId:'pick-png'});
 await actions(owner,{action:'wallpaper-engine',projectToken:picked.projectToken,apply:false});
 const pngEntry=settings.library[1];
 assert.equal(pngEntry.file,await realpath(pngSmall));
 assert.equal(pngEntry.importInfo.route,'direct');
 assert.deepEqual(await readdir(path.join(root,'media')),[]);

 // 3. Oversized 1080p60 MP4 at default 1280/24 -> transcoded into media/.
 pickedFiles=[oversizedMp4];
 picked=await actions(owner,{action:'media-pick',operationId:'pick-oversized'});
 await actions(owner,{action:'wallpaper-engine',projectToken:picked.projectToken,apply:false});
 const oversizedEntry=settings.library[2];
 assert(oversizedEntry.file.startsWith('media/wallpaper-'));
 assert.equal(oversizedEntry.importInfo.route,'transcode');

 // 4. Incompatible codec (WebM) even within 1280/24 -> transcoded into media/.
 pickedFiles=[webmCompatSize];
 picked=await actions(owner,{action:'media-pick',operationId:'pick-webm'});
 await actions(owner,{action:'wallpaper-engine',projectToken:picked.projectToken,apply:false});
 const webmEntry=settings.library[3];
 assert(webmEntry.file.startsWith('media/wallpaper-'));
 assert.equal(webmEntry.importInfo.route,'transcode');

 // 5. High-bitrate MP4 within resolution/fps cap still transcodes instead of direct-reading.
 const ffmpeg=await findFFmpeg(),highBitrate=path.join(ext,'high-bitrate.mp4');
 await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','nullsrc=s=640x360:r=24,noise=alls=100:allf=t+u','-t','1','-c:v','libx264','-preset','ultrafast','-crf','0','-pix_fmt','yuv420p',highBitrate],{windowsHide:true});
 const highPlan=await planMedia(root,highBitrate,'video/mp4',{maxWidth:1280,fps:24});
 assert(highPlan.source.bitrate>20e6,'expected high bitrate fixture > 20 Mbps, got '+highPlan.source.bitrate);
 assert.equal(highPlan.route,'transcode');

 // 6. UNC path is refused by preflight.
 await assert.rejects(planMedia(root,'\\\\server\\share\\video.mp4','video/mp4',{maxWidth:1280,fps:24}),/网络路径/);
});

test('security fence enforces library registration, rejects UNC, traversal, non-media extensions, symlinks/junctions, and TOCTOU mutations',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'cwb-direct-fence-'));
 const root=path.join(temp,'data'),ext=path.join(temp,'external'),other=path.join(temp,'other');
 await mkdir(path.join(root,'media'),{recursive:true});await mkdir(ext);await mkdir(other);
 const {mp4Audio,pngSmall}=await createFixtures(ext);
 const unregistered=path.join(other,'unregistered.mp4');
 await writeFile(unregistered,await readFile(mp4Audio));
 const txtFile=path.join(ext,'secret.txt');
 await writeFile(txtFile,'do-not-read');
 const managedMp4='media/managed.mp4';
 await writeFile(path.join(root,managedMp4),await readFile(mp4Audio));

 const canonicalMp4=await realpath(mp4Audio),canonicalPng=await realpath(pngSmall);
 const settings={library:[
  {id:'m',file:managedMp4,mime:'video/mp4'},
  {id:'v',file:canonicalMp4,sourcePath:canonicalMp4,mime:'video/mp4'},
  {id:'i',file:canonicalPng,sourcePath:canonicalPng,mime:'image/png'},
  {id:'t',file:await realpath(txtFile),sourcePath:await realpath(txtFile),mime:'text/plain'}
 ]};

 // Allowed: managed file and registered external files.
 const rManaged=await resolveAuthorizedMedia(root,settings,managedMp4);
 assert.equal(rManaged.managed,true);
 const rExt=await resolveAuthorizedMedia(root,settings,canonicalMp4);
 assert.equal(rExt.managed,false);assert.equal(rExt.path,canonicalMp4);

 // Previews work for registered external files when settings are provided, and fail without settings or when unregistered.
 const imgPrev=await libraryPreview(root,settings.library[2],{settings});
 assert(imgPrev.preview?.startsWith('data:image/png;base64,'));
 const vidPrev=await libraryPreview(root,settings.library[1],{settings});
 assert(vidPrev.preview?.startsWith('data:image/jpeg;base64,'));
 const unauthPrev=await libraryPreview(root,{name:'Unregistered',file:unregistered,mime:'video/mp4'},{settings});
 assert.equal(unauthPrev.preview,null);assert.equal(unauthPrev.previewUnavailable,true);
 const noSettingsPrev=await libraryPreview(root,settings.library[2]);
 assert.equal(noSettingsPrev.preview,null);assert.equal(noSettingsPrev.previewUnavailable,true);

 // Rejected: unregistered external file, UNC, non-media extension, traversal.
 await assert.rejects(resolveAuthorizedMedia(root,settings,unregistered),/未在已保存壁纸库中登记/);
 await assert.rejects(resolveAuthorizedMedia(root,settings,'\\\\server\\share\\video.mp4'),/UNC/);
 await assert.rejects(resolveAuthorizedMedia(root,settings,'//server/share/video.mp4'),/UNC/);
 await assert.rejects(resolveAuthorizedMedia(root,settings,await realpath(txtFile)),/格式不受支持/);
 await assert.rejects(resolveAuthorizedMedia(root,settings,'../external/compat-audio.mp4'),/越过媒体目录/);
 await assert.rejects(resolveAuthorizedMedia(root,settings,canonicalMp4.replace(/[^\\/]+$/,'..'+path.sep+'external'+path.sep+'compat-audio.mp4')),/相对跳转/);

 // Rejected: directory junction / symlink along path even if registered!
 const linkedDir=path.join(temp,'linked-dir');
 await symlink(other,linkedDir,process.platform==='win32'?'junction':'dir');
 const throughJunction=path.join(linkedDir,'unregistered.mp4');
 const settingsWithJunction={library:[{id:'j',file:throughJunction,sourcePath:throughJunction,mime:'video/mp4'}]};
 await assert.rejects(resolveAuthorizedMedia(root,settingsWithJunction,throughJunction),/符号链接|目录联接/);

 // Rejected: TOCTOU file mutation between DOM.setFileInputFiles and post-bind verification.
 const mutable=path.join(ext,'mutable.mp4');
 await writeFile(mutable,await readFile(mp4Audio));
 const canonicalMutable=await realpath(mutable);
 const mutableSettings={library:[{id:'mut',file:canonicalMutable,sourcePath:canonicalMutable,mime:'video/mp4'}]};
 let released=false;
 const mockCdp={
  async call(method){
   if(method==='Runtime.evaluate')return {result:{objectId:'obj-1'}};
   if(method==='DOM.setFileInputFiles'){
    await writeFile(canonicalMutable,Buffer.concat([await readFile(canonicalMutable),Buffer.from('extra')]));
    return {};
   }
   if(method==='Runtime.releaseObject'){released=true;return {};}
   return {};
  }
 };
 await assert.rejects(bindMediaFile(mockCdp,root,canonicalMutable,'cand-1',{settings:mutableSettings}),/加载时改变/);
 assert.equal(released,true);
});

test('missing or renamed external file degrades cleanly on select, rotation, preview, tier switch, and safe deletion',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'cwb-direct-missing-'));
 const root=path.join(temp,'data'),ext=path.join(temp,'external');
 await mkdir(path.join(root,'media'),{recursive:true});await mkdir(ext);
 const {mp4Audio,pngSmall,pngBackup}=await createFixtures(ext);
 const settings=defaultSettings();normalizeLibrary(settings);
 let mountedId=null;
 const apply=async()=>{
  const entry=settings.library.find(e=>e.id===settings.selectedId);
  if(!entry){mountedId=null;return;}
  await resolveAuthorizedMedia(root,settings,entry.file);
  mountedId=entry.id;
 };
 const owner={};
 let pickedFile=null;
 const actions=createActions(root,settings,apply,undefined,{
  configureMedia:async()=>{},
  captureStatic:async entry=>{const f='media/still-'+entry.id+'.png';await writeFile(path.join(root,f),'still-bytes');return f;},
  pickMediaFile:async()=>({file:pickedFile,files:[pickedFile]})
 });

 // Import three direct-referenced wallpapers: healthy PNG, MP4 (to be moved), backup PNG.
 pickedFile=pngSmall;
 let p=await actions(owner,{action:'media-pick',operationId:'p1'});
 await actions(owner,{action:'wallpaper-engine',projectToken:p.projectToken,apply:true});
 const img1=settings.library[0];

 pickedFile=mp4Audio;
 p=await actions(owner,{action:'media-pick',operationId:'p2'});
 await actions(owner,{action:'wallpaper-engine',projectToken:p.projectToken,apply:false});
 const vid=settings.library[1];

 pickedFile=pngBackup;
 p=await actions(owner,{action:'media-pick',operationId:'p3'});
 await actions(owner,{action:'wallpaper-engine',projectToken:p.projectToken,apply:false});
 const img2=settings.library[2];
 assert.equal(mountedId,img1.id);

 // Switch to MP4, generate an economy variant and a static still, then switch back to balanced (direct).
 await actions(owner,{action:'select',selectedId:vid.id});
 assert.equal(mountedId,vid.id);
 await actions(owner,{action:'display-tier',selectedId:vid.id,tier:'economy'});
 const ecoVariant=vid.file;
 assert(ecoVariant.startsWith('media/variant-'));
 await actions(owner,{action:'display-tier',selectedId:vid.id,tier:'static'});
 const stillFile=vid.staticFile;
 assert(stillFile.startsWith('media/still-'));
 await actions(owner,{action:'display-tier',selectedId:vid.id,tier:'balanced'});
 assert.equal(vid.file,await realpath(mp4Audio));
 assert(!(await readdir(path.join(root,'media'))).includes(path.basename(ecoVariant)),'economy variant cleaned when returning to direct');

 // Switch back to img1, then rename/move external MP4 (simulating user move or Steam unsubscribe).
 await actions(owner,{action:'select',selectedId:img1.id});
 assert.equal(mountedId,img1.id);
 const movedPath=path.join(ext,'renamed-away.mp4');
 await rename(mp4Audio,movedPath);

 // 1. Manual select of missing external MP4 fails clearly and retains current healthy background (img1).
 await assert.rejects(actions(owner,{action:'select',selectedId:vid.id}),/移动、改名或被删除/);
 assert.equal(settings.selectedId,img1.id);
 assert.equal(mountedId,img1.id);

 // 2. Preview degrades cleanly with missing flag.
 const missingPrev=await libraryPreview(root,vid,{settings});
 assert.equal(missingPrev.preview,null);assert.equal(missingPrev.previewUnavailable,true);assert.equal(missingPrev.missing,true);

 // 3. Rotation skips missing external MP4 and lands on healthy img2.
 const rot=await actions(null,{action:'rotation-next'});
 assert.equal(settings.selectedId,img2.id);
 assert.equal(mountedId,img2.id);
 assert.equal(rot.rotation.skipped.length,1);
 assert.equal(rot.rotation.skipped[0].id,vid.id);
 assert.match(rot.rotation.skipped[0].error,/移动、改名或被删除/);

 // 4. Restore MP4 back, then delete the direct entry -> removes derived stillFile only, NEVER deletes external MP4!
 await rename(movedPath,mp4Audio);
 await actions(owner,{action:'delete',selectedId:vid.id});
 await stat(mp4Audio);
 assert(!(await readdir(path.join(root,'media'))).includes(path.basename(stillFile)),'derived managed still must be deleted');
 // Even if removeManagedFile is called directly with an absolute path inside root/media, it refuses deletion.
 const absoluteManaged=path.join(root,'media','protected.mp4');
 await writeFile(absoluteManaged,'keep-me');
 assert.equal(await removeManagedFile(root,{library:[]},absoluteManaged),false);
 await stat(absoluteManaged);
 await unlink(absoluteManaged);
});
