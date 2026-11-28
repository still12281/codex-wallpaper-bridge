import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,realpath,unlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {createActions,normalizeLibrary} from '../src/wallpaper-actions.mjs';
import {defaultSettings,findFFmpeg} from '../src/runtime-paths.mjs';
import {nextRotation,rotationCandidates} from '../src/appearance-model.mjs';
import {planMedia,probeMedia} from '../src/media-preflight.mjs';

const execFileAsync=promisify(execFile);

async function makeTestMedia(dir){
 const ffmpeg=await findFFmpeg();
 const img=path.join(dir,'source-2k.png');
 const vid=path.join(dir,'source-1080p.mp4');
 await execFileAsync(ffmpeg,['-hide_banner','-y','-f','lavfi','-i','color=c=0x224488:s=2560x1440:d=1','-frames:v','1',img],{windowsHide:true});
 await execFileAsync(ffmpeg,['-hide_banner','-y','-f','lavfi','-i','testsrc2=size=1920x1080:rate=30:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',vid],{windowsHide:true});
 return {img,vid};
}

test('media-pick supports multi-select owner tokens, preserves single-file shape, and enforces limits',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-multi-pick-'));
 await mkdir(path.join(root,'media'));
 const f1=path.join(root,'a.png'),f2=path.join(root,'b.mp4');
 await writeFile(f1,'png-fixture');await writeFile(f2,'mp4-fixture');
 const owner={},other={},settings=defaultSettings();
 let response={files:[f1,f2]};
 const actions=createActions(root,settings,async()=>{},undefined,{pickMediaFile:async()=>response});

 const multi=await actions(owner,{action:'media-pick',operationId:'pick-multi'});
 assert.equal(multi.items.length,2);
 assert.equal(multi.projectToken,undefined);
 assert.equal(multi.items[0].name,'a.png');
 assert.equal(multi.items[1].name,'b.mp4');
 await assert.rejects(actions(other,{action:'wallpaper-engine',projectToken:multi.items[0].projectToken,apply:false}),/过期/);

 response={file:f1,files:[f1]};
 const single=await actions(owner,{action:'media-pick',operationId:'pick-single'});
 assert(single.projectToken);
 assert.equal(single.name,'a.png');
 assert.equal(single.items.length,1);
 // Picking again revokes prior owner tokens.
 await assert.rejects(actions(owner,{action:'wallpaper-engine',projectToken:multi.items[0].projectToken,apply:false}),/过期/);

 response={files:Array.from({length:101},()=>f1)};
 await assert.rejects(actions(owner,{action:'media-pick',operationId:'pick-too-many'}),/100/);

 response={files:[f1,'\\\\server\\share\\bad.png']};
 await assert.rejects(actions(owner,{action:'media-pick',operationId:'pick-unc'}),/本机媒体文件/);

 // Repeatedly cancelling multi-pick must release both job slots (>32) and picked tokens.
 response={files:[f1,f2]};
 for(let i=0;i<35;i++){
  const op='pick-cancel-'+i;
  const picked=await actions(owner,{action:'media-pick',operationId:op});
  const cancelled=await actions(owner,{action:'import-cancel',operationId:op});
  assert.equal(cancelled.cancelAccepted,true);
  await assert.rejects(actions(owner,{action:'wallpaper-engine',projectToken:picked.items[0].projectToken,apply:false,operationId:'after-cancel-'+i}),/过期/);
 }
});

test('batch save optional per-batch realtime authorization leaves default unconfirmed and never creates global bypass',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-batch-auth-'));
 const p1=path.join(root,'scene-1'),p2=path.join(root,'scene-2');
 await mkdir(p1);await mkdir(p2);
 await writeFile(path.join(p1,'project.json'),JSON.stringify({type:'scene',title:'Scene One',file:'scene.json'}));
 await writeFile(path.join(p2,'project.json'),JSON.stringify({type:'scene',title:'Scene Two',file:'scene.json'}));
 const settings=defaultSettings();
 settings.library=[{id:'img',name:'Still',file:'media/still.png',mime:'image/png'}];
 settings.selectedId='img';
 normalizeLibrary(settings);
 let applies=0;
 const actions=createActions(root,settings,async()=>{applies++;}),owner={};
 const scan1=await actions(owner,{action:'engine-list',scope:'folder',folder:p1});
 const scan2=await actions(owner,{action:'engine-list',scope:'folder',folder:p2});

 // Authorized in this batch -> immediately eligible for rotation without applying now.
 const r1=await actions(owner,{action:'wallpaper-engine',projectToken:scan1.wallpapers[0].token,renderMode:'webwallgl',apply:false,authorizeRealtime:true});
 assert.equal(r1.confirmation,undefined);
 assert.equal(applies,0);
 assert.equal(settings.selectedId,'img');
 const e1=settings.library.find(e=>e.name.startsWith('Scene One'));
 assert(e1&&e1.needsRunConfirmation===undefined);
 assert.deepEqual(rotationCandidates(settings).map(g=>g.id),['img',e1.id]);

 // Subsequent save without authorizeRealtime still requires confirmation.
 const r2=await actions(owner,{action:'wallpaper-engine',projectToken:scan2.wallpapers[0].token,renderMode:'webwallgl',apply:false});
 assert.equal(r2.confirmation,undefined);
 const e2=settings.library.find(e=>e.name.startsWith('Scene Two'));
 assert(e2&&e2.needsRunConfirmation===true);
 assert.deepEqual(rotationCandidates(settings).map(g=>g.id),['img',e1.id]);
});

test('realtime-authorize-batch confirms multiple pending realtime entries, skips broken projects, and requires explicit confirm',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-rot-approve-'));
 const good1=path.join(root,'good-1'),good2=path.join(root,'good-2');
 await mkdir(good1);await mkdir(good2);
 await writeFile(path.join(good1,'project.json'),JSON.stringify({type:'scene',title:'Good 1'}));
 await writeFile(path.join(good2,'project.json'),JSON.stringify({type:'web',title:'Good 2',file:'index.html'}));
 const settings=defaultSettings();
 settings.library=[
  {id:'still',name:'Still',file:'media/still.png',mime:'image/png'},
  {id:'s1',name:'Good 1',mode:'webwallgl',projectRoot:good1,needsRunConfirmation:true},
  {id:'s2',name:'Good 2',mode:'realtime',engine:'wallpaper-engine',projectRoot:good2,needsRunConfirmation:true},
  {id:'bad',name:'Missing',mode:'webwallgl',projectRoot:path.join(root,'missing'),needsRunConfirmation:true}
 ];
 settings.selectedId='still';
 normalizeLibrary(settings);
 let applies=0;
 const actions=createActions(root,settings,async()=>{applies++;});

 await assert.rejects(actions({},{action:'realtime-authorize-batch',ids:['s1','s2']}),/明确确认/);
 const res=await actions({},{action:'realtime-authorize-batch',ids:['s1','s2','bad'],confirmed:true});
 assert.deepEqual(res.authorized,['s1','s2']);
 assert.equal(res.skipped.length,1);
 assert.equal(res.skipped[0].id,'bad');
 assert.equal(applies,0);
 assert.equal(settings.library.find(e=>e.id==='s1').needsRunConfirmation,undefined);
 assert.equal(settings.library.find(e=>e.id==='s2').needsRunConfirmation,undefined);
 assert.equal(settings.library.find(e=>e.id==='bad').needsRunConfirmation,true);
 assert.deepEqual(rotationCandidates(settings).map(g=>g.id),['still','s1','s2']);
 assert.equal(nextRotation(settings).id,'s1');
 const persisted=JSON.parse(await readFile(path.join(root,'settings.json'),'utf8'));
 assert.equal(persisted.library.find(e=>e.id==='s1').needsRunConfirmation,undefined);
 assert.equal(persisted.library.find(e=>e.id==='bad').needsRunConfirmation,true);
});

test('delete-batch and delete-all remove managed files, preserve external sources, and avoid starting adjacent realtime entries',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-del-batch-'));
 const mediaDir=path.join(root,'media');await mkdir(mediaDir);
 const extFile=path.join(root,'external-keep.png');
 await writeFile(extFile,'external');
 for(const name of ['a.png','b.png','c.mp4','c-custom.mp4','d.png'])await writeFile(path.join(mediaDir,name),name);
 const settings=defaultSettings();
 settings.library=[
  {id:'a-vid',name:'Alpha',workshopId:'100',file:'media/a.png',mime:'image/png',sourcePath:extFile},
  {id:'a-gpu',name:'Alpha · WebGL',workshopId:'100',mode:'webwallgl',projectRoot:path.join(root,'alpha-proj')},
  {id:'b',name:'Beta',file:'media/b.png',mime:'image/png'},
  {id:'c',name:'Gamma',file:'media/c.mp4',mime:'video/mp4',customDisplay:{file:'media/c-custom.mp4'}},
  {id:'rt',name:'Delta',mode:'webwallgl',projectRoot:path.join(root,'delta-proj')},
  {id:'d',name:'Epsilon',file:'media/d.png',mime:'image/png'}
 ];
 settings.selectedId='a-vid';
 settings.realtimeFallbackId='b';
 settings.rotation={enabled:true,intervalSeconds:60,order:'sequential',ids:['a-vid','b','c','d']};
 normalizeLibrary(settings);
 let applies=0;
 const actions=createActions(root,settings,async()=>{applies++;});

 // Batch delete Alpha (logical group -> removes both a-vid and a-gpu), Beta, Gamma.
 const batchRes=await actions({},{action:'delete-batch',ids:['a-vid','b','c'],allVersions:true});
 assert.equal(batchRes.removedCount,3);
 assert.equal(applies,1);
 // Must fall back to non-realtime Epsilon rather than adjacent realtime Delta.
 assert.equal(settings.selectedId,'d');
 assert.equal(settings.realtimeFallbackId,undefined);
 assert.deepEqual(settings.rotation.ids,['d']);
 assert.deepEqual(settings.library.map(e=>e.id),['rt','d']);
 assert.deepEqual((await readdir(mediaDir)).sort(),['d.png']);
 // External source untouched.
 assert.equal(await readFile(extFile,'utf8'),'external');

 // delete-all requires explicit confirmation.
 await assert.rejects(actions({},{action:'delete-all'}),/明确确认/);
 const allRes=await actions({},{action:'delete-all',confirmed:true});
 assert.equal(allRes.removedCount,2);
 assert.equal(applies,2);
 assert.deepEqual(settings.library,[]);
 assert.equal(settings.selectedId,null);
 assert.deepEqual(settings.rotation.ids,[]);
 assert.deepEqual(await readdir(mediaDir),[]);
 assert.equal(await readFile(extFile,'utf8'),'external');
});

test('display-tier upgrades static images from source and cleans orphan variant files across repeated video/image tier switches',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-tier-media-'));
 const mediaDir=path.join(root,'media');await mkdir(mediaDir);
 const {img,vid}=await makeTestMedia(root);
 const settings=defaultSettings();
 normalizeLibrary(settings);
 const owner={},actions=createActions(root,settings,async()=>{},undefined,{configureMedia:async()=>{},pickMediaFile:async()=>({file:img,files:[img]})});

 // 1. Import 2560x1440 static image at balanced 1280 width -> downscaled copy.
 const pickedImg=await actions(owner,{action:'media-pick',operationId:'pick-img'});
 await actions(owner,{action:'wallpaper-engine',projectToken:pickedImg.projectToken,apply:true,profile:{maxWidth:1280,fps:24}});
 const imgEntry=settings.library[0];
 assert.equal(imgEntry.limits.maxWidth,1280);
 const downscaledProbe=await probeMedia(path.join(root,imgEntry.file));
 assert.equal(downscaledProbe.width,1280);
 const originalCopy=imgEntry.file;

 // Switch static image to qhd (2560) -> compatible 2K original is referenced directly without copying into media/.
 await actions(owner,{action:'display-tier',selectedId:imgEntry.id,tier:'qhd'});
 assert.equal(imgEntry.displayTier,'qhd');
 assert.equal(imgEntry.limits.maxWidth,2560);
 assert.equal(imgEntry.customDisplay.file,originalCopy);
 assert.equal(imgEntry.file,await realpath(img));
 assert.equal(imgEntry.importInfo.route,'direct');
 const upgradedProbe=await probeMedia(path.resolve(root,imgEntry.file));
 assert.equal(upgradedProbe.width,2560);
 assert.deepEqual(await readdir(mediaDir),[path.basename(originalCopy)]);

 // Switch static image to economy (960) -> generates managed variant, preserves customDisplay and original source.
 await actions(owner,{action:'display-tier',selectedId:imgEntry.id,tier:'economy'});
 assert.equal(imgEntry.displayTier,'economy');
 const economyProbe=await probeMedia(path.resolve(root,imgEntry.file));
 assert.equal(economyProbe.width,960);
 const filesAfterEconomy=await readdir(mediaDir);
 assert(filesAfterEconomy.includes(path.basename(originalCopy)),'customDisplay backup should be preserved');
 assert(filesAfterEconomy.includes(path.basename(imgEntry.file)),'active economy file should exist');

 // Switch back to custom -> economy variant must be deleted, leaving only originalCopy.
 const economyFile=imgEntry.file;
 await actions(owner,{action:'display-tier',selectedId:imgEntry.id,tier:'custom'});
 assert.equal(imgEntry.file,originalCopy);
 assert.equal(imgEntry.customDisplay,undefined);
 const filesAfterCustom=await readdir(mediaDir);
 assert(!filesAfterCustom.includes(path.basename(economyFile)),'economy variant should be deleted on return to custom');
 assert.deepEqual(filesAfterCustom,[path.basename(originalCopy)]);

 // 2. Video repeated display-tier switches direct-read compatible tiers and leave zero orphan variants.
 const videoActions=createActions(root,settings,async()=>{},undefined,{configureMedia:async()=>{},pickMediaFile:async()=>({file:vid,files:[vid]})});
 const pickedVid=await videoActions(owner,{action:'media-pick',operationId:'pick-vid'});
 await videoActions(owner,{action:'wallpaper-engine',projectToken:pickedVid.projectToken,apply:true,profile:{maxWidth:1280,fps:24}});
 const vidEntry=settings.library[1];
 const vidOriginal=vidEntry.file;

 await videoActions(owner,{action:'display-tier',selectedId:vidEntry.id,tier:'economy'});
 const vidEco=vidEntry.file;
 assert.notEqual(vidEco,vidOriginal);
 // Economy tier conversion should populate conversion cache for instant reuse on return.
 const ecoPlan=await planMedia(root,vidEntry.sourcePath,'video/mp4',{maxWidth:960,fps:12});
 assert.equal(ecoPlan.route,'cache');

 // Switching to smooth (1920/30) matches the 1080p30 source -> direct external reference and economy variant cleaned.
 await videoActions(owner,{action:'display-tier',selectedId:vidEntry.id,tier:'smooth'});
 assert.equal(vidEntry.file,await realpath(vid));
 assert.equal(vidEntry.importInfo.route,'direct');
 let dirFiles=await readdir(mediaDir);
 assert(!dirFiles.includes(path.basename(vidEco)),'video economy variant should be removed after switching to smooth: '+dirFiles);
 assert(dirFiles.includes(path.basename(vidOriginal)));
 assert.deepEqual(dirFiles.sort(),[path.basename(originalCopy),path.basename(vidOriginal)].sort());

 await videoActions(owner,{action:'display-tier',selectedId:vidEntry.id,tier:'balanced'});
 const vidBal=vidEntry.file;
 assert(vidBal.startsWith('media/variant-'));
 dirFiles=await readdir(mediaDir);
 assert(dirFiles.includes(path.basename(vidBal)));

 await videoActions(owner,{action:'display-tier',selectedId:vidEntry.id,tier:'custom'});
 dirFiles=await readdir(mediaDir);
 assert(!dirFiles.includes(path.basename(vidBal)),'video balanced variant should be removed on return to custom: '+dirFiles);
 assert.deepEqual(dirFiles.sort(),[path.basename(originalCopy),path.basename(vidOriginal)].sort());

 // 3. Missing source image fails cleanly without deleting active file.
 await unlink(img);
 await actions(owner,{action:'select',selectedId:imgEntry.id});
 await assert.rejects(actions(owner,{action:'display-tier',selectedId:imgEntry.id,tier:'qhd'}),/原素材不可用/);
 assert.equal(imgEntry.file,originalCopy);
 assert((await readdir(mediaDir)).includes(path.basename(originalCopy)));
});
