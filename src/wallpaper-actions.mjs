import {getPowerShell} from './runtime-paths.mjs';
import {fileURLToPath} from 'node:url';
import {open,writeFile,rename,mkdir,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createEngineCatalog} from './engine-library.mjs';
import {convertMedia} from './media-converter.mjs';
import {currentEngineSource,getCurrentEngineProject} from './wallpaper-engine-source.mjs';
import {commitConverted,removeManagedFile} from './media-store.mjs';
const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'};
export async function saveConfig(root,settings){const temp=path.join(root,'settings.next.json');await writeFile(temp,JSON.stringify(settings,null,2));await rename(temp,path.join(root,'settings.json'))}
export function normalizeLibrary(settings){
 settings.library??=[];settings.selectedId??=null;settings.pauseOnBlur??=true;settings.playback??={maxWidth:1280,fps:24};
 settings.engineSearch??={scope:'global',folder:'',kind:'engine'};
}
export function createActions(root,settings,apply){
 const uploads=new Map(),catalog=createEngineCatalog();
 return async(c,req)=>{
  if(req.action==='engine-list'){const search={scope:req.scope||'global',folder:req.folder||'',kind:req.kind||'engine'};const result=await catalog.search(search);settings.engineSearch=search;await saveConfig(root,settings);return result}
  if(req.action==='engine-pick-folder'){const result=await promisify(execFile)(getPowerShell(),['-NoProfile','-STA','-File',fileURLToPath(new URL('../windows/Pick-WallpaperFolder.ps1',import.meta.url)),'-InitialPath',settings.engineSearch?.folder||''],{windowsHide:true,timeout:150000});return JSON.parse(result.stdout)}
  if(req.action==='delete'){
   const index=settings.library.findIndex(e=>e.id===req.selectedId);if(index<0)throw Error('壁纸不存在');
   const entry=settings.library[index],selected=settings.selectedId;settings.library.splice(index,1);
   if(selected===entry.id)settings.selectedId=settings.library[Math.min(index,settings.library.length-1)]?.id||null;
   try{await apply();await saveConfig(root,settings)}catch(e){settings.library.splice(index,0,entry);settings.selectedId=selected;await apply();throw e}
   for(const file of [entry.file,entry.sourceFile,entry.sourcePath])await removeManagedFile(root,settings,file);
   return {config:settings,message:'已从 Codex 删除并清理专属缓存；Wallpaper Engine 原文件不变。'};
  }
  if(req.action==='playback'){
   const entry=settings.library.find(e=>e.id===settings.selectedId);if(!entry)throw Error('当前壁纸不存在');
   const input=entry.sourcePath||path.join(root,entry.sourceFile||entry.file);
   try{await stat(input)}catch{throw Error('原素材不可用，请重新导入后调整规格')}
   const profile={maxWidth:Number(req.maxWidth),fps:Number(req.fps)};
   if(entry.limits?.maxWidth===profile.maxWidth&&(!entry.mime.startsWith('video/')||entry.limits?.fps===profile.fps))return {config:settings,message:'当前已是所选规格，无需重新生成。'};
   const converted=await convertMedia(root,input,entry.sourceMime||entry.mime,entry.id,profile);
   const previous={...entry},oldProfile=settings.playback;settings.playback=profile;
   try{await commitConverted(root,settings,entry,converted,previous,apply,saveConfig)}catch(e){settings.playback=oldProfile;throw e}return {config:settings};
  }
  if(req.action==='wallpaper-engine'){
   const resolved=req.projectToken?await catalog.resolve(req.projectToken):(!req.workshopId?await getCurrentEngineProject():null);
   const workshopId=resolved?.workshopId||req.workshopId;
   const existing=settings.library.find(e=>(resolved&&e.sourceKey===resolved.sourceKey)||(workshopId&&e.workshopId===workshopId));
   if(existing){settings.selectedId=existing.id;await apply();await saveConfig(root,settings);return {config:settings,message:'已切换到已导入的壁纸，未重复生成。'}}
   const id=randomUUID();const source=resolved?.kind==='media'?{input:resolved.file,mime:resolved.mime,name:path.basename(resolved.file),source:'本地图片/视频',sourceKey:resolved.sourceKey,temporary:false}:await currentEngineSource(root,id,workshopId,resolved?.root);let converted;
   try{converted=await convertMedia(root,source.input,source.mime,id,settings.playback)}catch(e){if(source.temporary)await removeManagedFile(root,settings,source.input);throw e}
   const entry={id,name:source.name,source:source.source,sourcePath:source.input,sourceMime:source.mime,workshopId:source.workshopId,sourceKey:source.sourceKey};const previous=settings.selectedId;settings.library.push(entry);settings.selectedId=id;
   try{await commitConverted(root,settings,entry,converted,{...entry},apply,saveConfig)}catch(e){settings.library.pop();settings.selectedId=previous;await apply();throw e}return {config:settings};
  }
  if(req.action==='appearance'){
   if(!Number.isFinite(req.darkOverlay)||req.darkOverlay<.25||req.darkOverlay>.85)throw Error('遮罩浓度无效');
   settings.darkOverlay=settings.lightOverlay=req.darkOverlay;settings.pauseOnBlur=!!req.pauseOnBlur;await apply();await saveConfig(root,settings);return {config:settings};
  }
  if(req.action==='select'){
   if(!settings.library.some(e=>e.id===req.selectedId))throw Error('壁纸不存在');
   const previous=settings.selectedId;settings.selectedId=req.selectedId;
   try{await apply();await saveConfig(root,settings)}catch(e){settings.selectedId=previous;await apply();throw e}return {config:settings};
  }
  if(req.action==='import-start'){
   if(!types[req.mime]||!Number.isInteger(req.size)||req.size<1||req.size>250*1024*1024)throw Error('仅支持250MB以内的图片或视频');
   if([...uploads.values()].some(u=>u.owner===c))throw Error('已有文件正在导入');
   const id=randomUUID(),file='media/import-'+id+'.'+types[req.mime];await mkdir(path.join(root,'media'),{recursive:true});
   uploads.set(id,{id,file,owner:c,name:String(req.name).slice(0,120),mime:req.mime,size:req.size,received:0,handle:await open(path.join(root,file),'wx')});return {uploadId:id};
  }
  const u=uploads.get(req.uploadId);if(!u||u.owner!==c)throw Error('导入会话已失效');
  if(req.action==='import-chunk'){
   if(typeof req.data!=='string'||req.data.length>540000||!/^[A-Za-z0-9+/]*={0,2}$/.test(req.data))throw Error('导入数据无效');
   const chunk=Buffer.from(req.data,'base64');if(u.received+chunk.length>u.size)throw Error('导入长度超出声明');
   await u.handle.write(chunk,0,chunk.length,u.received);u.received+=chunk.length;return {};
  }
  if(req.action!=='import-end')throw Error('不支持的操作');
  if(u.received!==u.size)throw Error('文件未传输完整');await u.handle.close();uploads.delete(u.id);
  const converted=await convertMedia(root,path.join(root,u.file),u.mime,u.id,settings.playback);
  const entry={id:u.id,name:u.name,sourceFile:u.file,sourceMime:u.mime};const previous=settings.selectedId;settings.library.push(entry);settings.selectedId=entry.id;
  try{await commitConverted(root,settings,entry,converted,{...entry},apply,saveConfig)}catch(e){settings.library.pop();settings.selectedId=previous;await apply();throw e}return {config:settings};
 };
}
