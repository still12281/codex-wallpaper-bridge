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
import {describeProject,realtimeProfile,findWorkshopProject} from './realtime-source.mjs';
const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'};
export async function saveConfig(root,settings){const temp=path.join(root,'settings.next.json');await writeFile(temp,JSON.stringify(settings,null,2));await rename(temp,path.join(root,'settings.json'))}
export function normalizeLibrary(settings){
 settings.library??=[];settings.selectedId??=null;settings.pauseOnBlur??=true;settings.playback??={maxWidth:1280,fps:24};
 settings.engineSearch??={scope:'global',folder:'',kind:'engine'};
 settings.surfaceSync={composer:true,context:true,menus:false,settings:true,wallpaperPanel:true,...settings.surfaceSync};
}
export function createActions(root,settings,apply,applyAppearance=apply){
 const uploads=new Map(),catalog=createEngineCatalog(),confirmations=new Map();
 const requestRealtime=async(c,projectRoot,applyNow,profile)=>{
  const project=await describeProject(projectRoot);
  if(!['scene','web'].includes(project.type))throw Error('此项目不支持实时模式');
  const limits=realtimeProfile(profile||settings.playback),token=randomUUID();
  for(const [id,p]of confirmations)if(p.expires<Date.now()||p.owner===c)confirmations.delete(id);
  confirmations.set(token,{owner:c,expires:Date.now()+300000,project,applyNow,limits});
  return {confirmation:{token,name:project.name,apply:applyNow,limits},message:'此壁纸需要实时渲染，请确认后继续。'};
 };
 return async(c,req)=>{
  if(req.action==='wallpaper-engine-confirm'){
   const pending=confirmations.get(req.confirmationToken);
   if(!pending||pending.owner!==c||pending.expires<Date.now()||req.confirmed!==true)throw Error('实时导入确认已失效，请重新选择');
   confirmations.delete(req.confirmationToken);
   const project=await describeProject(pending.project.root);
   if(project.sourceKey!==pending.project.sourceKey)throw Error('壁纸项目已改变，请重新确认');
   const existing=settings.library.find(e=>e.mode==='realtime'&&e.sourceKey===project.sourceKey);
   if(existing&&!pending.applyNow)return {config:settings,message:'该实时壁纸已保存，当前背景保持不变。'};
   const entry=existing||{id:randomUUID(),name:project.name+' · 实时',mode:'realtime',projectRoot:project.root,sourceKey:project.sourceKey,workshopId:project.workshopId,source:'Wallpaper Engine 原生实时场景',limits:pending.limits};
   const previous=settings.selectedId,previousLimits=entry.limits,previousFallback=settings.realtimeFallbackId;if(existing)entry.limits=pending.limits;if(!existing)settings.library.push(entry);if(pending.applyNow){if(settings.library.some(e=>e.id===previous&&e.mode!=='realtime'))settings.realtimeFallbackId=previous;settings.selectedId=entry.id}
   try{if(pending.applyNow)await apply();await saveConfig(root,settings)}catch(error){settings.selectedId=previous;settings.realtimeFallbackId=previousFallback;entry.limits=previousLimits;if(!existing)settings.library.splice(settings.library.indexOf(entry),1);if(pending.applyNow)await apply();throw error}
   return {config:settings,message:pending.applyNow?'已保存并应用实时壁纸。':'实时壁纸已保存；未启动渲染，当前背景保持不变。'};
  }
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
   if(entry.mode==='realtime'){
    const previous=entry.limits,oldProfile=settings.playback;entry.limits=realtimeProfile(req);settings.playback={maxWidth:entry.limits.maxWidth,fps:entry.limits.fps};
    try{await apply();await saveConfig(root,settings)}catch(error){entry.limits=previous;settings.playback=oldProfile;await apply();throw error}
    return {config:settings,message:'已更新实时输出分辨率与采集帧率；Wallpaper Engine 全局帧率未修改。'};
   }
   const input=entry.sourcePath||path.join(root,entry.sourceFile||entry.file);
   try{await stat(input)}catch{throw Error('原素材不可用，请重新导入后调整规格')}
   const profile={maxWidth:Number(req.maxWidth),fps:Number(req.fps)};
   if(entry.limits?.maxWidth===profile.maxWidth&&(!entry.mime.startsWith('video/')||entry.limits?.fps===profile.fps))return {config:settings,message:'当前已是所选规格，无需重新生成。'};
   const converted=await convertMedia(root,input,entry.sourceMime||entry.mime,entry.id,profile);
   const previous={...entry},oldProfile=settings.playback;settings.playback=profile;
   try{await commitConverted(root,settings,entry,converted,previous,apply,saveConfig)}catch(e){settings.playback=oldProfile;throw e}return {config:settings};
  }
  if(req.action==='wallpaper-engine'){
   const applyNow=req.apply!==false;
   const resolved=req.projectToken?await catalog.resolve(req.projectToken):(!req.workshopId?await getCurrentEngineProject():null);
   const workshopId=resolved?.workshopId||req.workshopId;
   const projectRoot=resolved?.root||(workshopId?await findWorkshopProject(workshopId):null);
   if(req.renderMode==='realtime'&&projectRoot){const project=await describeProject(projectRoot);if(['scene','web'].includes(project.type))return requestRealtime(c,projectRoot,applyNow,req.profile)}
   const existing=settings.library.find(e=>e.mode!=='realtime'&&((resolved&&e.sourceKey===resolved.sourceKey)||(workshopId&&e.workshopId===workshopId)));
   if(existing){
    if(!applyNow)return {config:settings,message:'该壁纸已在“我的壁纸”中，未重复导入；当前背景保持不变。'};
    const previous=settings.selectedId;settings.selectedId=existing.id;
    try{await apply();await saveConfig(root,settings)}catch(e){settings.selectedId=previous;await apply();throw e}
    return {config:settings,message:'已切换到已导入的壁纸，未重复生成。'};
   }
   const id=randomUUID();let source,converted;
   try{source=resolved?.kind==='media'?{input:resolved.file,mime:resolved.mime,name:path.basename(resolved.file),source:'本地图片/视频',sourceKey:resolved.sourceKey,temporary:false}:await currentEngineSource(root,id,workshopId,resolved?.root)}catch(error){if(error.code==='REALTIME_REQUIRED')return requestRealtime(c,projectRoot,applyNow,req.profile);throw error}
   try{converted=await convertMedia(root,source.input,source.mime,id,settings.playback)}catch(e){if(source.temporary)await removeManagedFile(root,settings,source.input);throw e}
   const entry={id,name:source.name,source:source.source,sourcePath:source.input,sourceMime:source.mime,workshopId:source.workshopId,sourceKey:source.sourceKey};const previous=settings.selectedId;settings.library.push(entry);if(applyNow)settings.selectedId=id;
   const refresh=applyNow?apply:async()=>{};
   try{await commitConverted(root,settings,entry,converted,{...entry},refresh,saveConfig)}catch(e){settings.library.pop();settings.selectedId=previous;if(applyNow)await apply();throw e}
   return {config:settings,message:applyNow?'已导入“我的壁纸”并应用。':'已保存到“我的壁纸”；当前背景保持不变，可稍后从列表选择应用。'};
  }
  if(req.action==='appearance'){
   if(!Number.isFinite(req.darkOverlay)||req.darkOverlay<.25||req.darkOverlay>.85)throw Error('遮罩浓度无效');
   settings.darkOverlay=settings.lightOverlay=req.darkOverlay;settings.pauseOnBlur=!!req.pauseOnBlur;await applyAppearance();await saveConfig(root,settings);return {config:settings};
  }
  if(req.action==='surface-sync'){
   const keys=['composer','context','menus','settings','wallpaperPanel'];
   if(!keys.includes(req.region)||typeof req.enabled!=='boolean')throw Error('分区设置无效');
   const previous={...settings.surfaceSync};settings.surfaceSync={...previous,[req.region]:req.enabled};
   try{await applyAppearance();await saveConfig(root,settings)}catch(error){settings.surfaceSync=previous;await applyAppearance();throw error}
   return {config:settings,message:'已即时切换并保存；关闭开关可恢复该分区原生底色。'};
  }
  if(req.action==='select'){
   const selected=settings.library.find(e=>e.id===req.selectedId);if(!selected)throw Error('壁纸不存在');
   if(selected.mode==='realtime')return requestRealtime(c,selected.projectRoot,true,selected.limits);
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
