import {getPowerShell} from './runtime-paths.mjs';
import {fileURLToPath} from 'node:url';
import {open,writeFile,rename,mkdir,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createEngineCatalog} from './engine-library.mjs';
import {convertMedia} from './media-converter.mjs';
import {currentEngineSource,getCurrentEngineProject,inspectEngineProject} from './wallpaper-engine-source.mjs';
import {commitConverted,removeManagedFile} from './media-store.mjs';
import {describeProject,realtimeProfile,findWorkshopProject} from './realtime-source.mjs';
import {sanitizeVisual,appearanceSnapshot,parsePreset,nextRotation} from './appearance-model.mjs';
const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'};
export async function saveConfig(root,settings){const temp=path.join(root,'settings.next.json');await writeFile(temp,JSON.stringify(settings,null,2));await rename(temp,path.join(root,'settings.json'))}
export function normalizeLibrary(settings){
 settings.library??=[];settings.selectedId??=null;settings.pauseOnBlur??=true;settings.playback??={maxWidth:1280,fps:24};
 settings.engineSearch??={scope:'global',folder:'',kind:'engine'};
 settings.surfaceSync={code:settings.surfaceSync?.code!==false,embedded:settings.surfaceSync?.embedded!==false};
 settings.visual=sanitizeVisual(settings.visual);settings.presets??=[];settings.hiddenWallpaperIds??=[];settings.rotation??={enabled:false,intervalSeconds:60,order:'sequential',ids:[]};
 settings.systemMedia??={enabled:false,audio:false};
}
export function createActions(root,settings,apply,applyAppearance=apply,services={}){
 const uploads=new Map(),catalog=createEngineCatalog(),confirmations=new Map();
 const requestRealtime=async(c,projectRoot,applyNow,profile,renderer='native')=>{
  const project=await describeProject(projectRoot);
  if(!['scene','web'].includes(project.type))throw Error('此项目不支持实时模式');
  if(renderer==='webwallgl'&&project.type!=='scene')throw Error('网页 WebWallGL 资源通道尚未通过验收，请选择原生实时模式');
  const limits=realtimeProfile(profile||settings.playback),token=randomUUID();
  for(const [id,p]of confirmations)if(p.expires<Date.now()||p.owner===c)confirmations.delete(id);
  confirmations.set(token,{owner:c,expires:Date.now()+300000,project,applyNow,limits,renderer});
  return {confirmation:{token,name:project.name,apply:applyNow,limits,renderer},message:'此壁纸需要实时渲染，请确认后继续。'};
 };
 return async(c,req)=>{
  if(req.action==='system-media-config'){
   if(typeof req.enabled!=='boolean'||typeof req.audio!=='boolean'||typeof services.configureMedia!=='function')throw Error('系统媒体配置不可用');const previous=settings.systemMedia;settings.systemMedia={enabled:req.enabled,audio:req.audio};try{await services.configureMedia(settings.systemMedia);await saveConfig(root,settings);}catch(error){settings.systemMedia=previous;await services.configureMedia(previous);throw error;}return {config:settings,message:req.enabled?'系统媒体联动已启用，采集状态以面板显示为准。':'系统媒体联动已关闭。'};
  }
  if(req.action==='system-media-control'){if(typeof services.controlMedia!=='function')throw Error('系统媒体未启用');await services.controlMedia(req.command);return {message:'已向当前播放器执行操作。'};}
  if(req.action==='visual'){
   const previous=settings.visual;settings.visual=sanitizeVisual({...previous,...req.values});try{await applyAppearance();await saveConfig(root,settings);}catch(error){settings.visual=previous;await applyAppearance();throw error;}return {config:settings};
  }
  if(req.action==='preset-export'){const name=String(req.name||'我的外观').trim().slice(0,80)||'我的外观';return {preset:JSON.stringify({format:'codex-wallpaper-appearance',version:1,name,appearance:appearanceSnapshot(settings)},null,2)};}
  if(req.action==='preset-save'||req.action==='preset-import'){
   const preset=req.action==='preset-import'?parsePreset(req.json):{name:String(req.name||'我的外观').trim().slice(0,80)||'我的外观',appearance:appearanceSnapshot(settings)};if(settings.presets.length>=50)throw Error('最多保存50个外观预设');const entry={id:randomUUID(),...preset};settings.presets.push(entry);try{await saveConfig(root,settings);}catch(error){settings.presets.pop();throw error;}return {config:settings,message:'外观预设已保存，未切换当前外观。'};
  }
  if(req.action==='preset-apply'){
   const preset=settings.presets.find(p=>p.id===req.presetId);if(!preset)throw Error('预设不存在');const checked=parsePreset(JSON.stringify({format:'codex-wallpaper-appearance',version:1,...preset})),previous=appearanceSnapshot(settings);Object.assign(settings,checked.appearance);try{await applyAppearance();await saveConfig(root,settings);}catch(error){Object.assign(settings,previous);await applyAppearance();throw error;}return {config:settings,message:'已应用整套外观；壁纸和素材库保持不变。'};
  }
  if(req.action==='preset-delete'){const index=settings.presets.findIndex(p=>p.id===req.presetId);if(index<0)throw Error('预设不存在');const [removed]=settings.presets.splice(index,1);try{await saveConfig(root,settings);}catch(error){settings.presets.splice(index,0,removed);throw error;}return {config:settings};}
  if(req.action==='library-visibility'){
   if(!Array.isArray(req.ids)||req.ids.length>3000||req.ids.some(id=>typeof id!=='string'||id.length>128)||typeof req.hidden!=='boolean')throw Error('隐藏项目无效');const previous=settings.hiddenWallpaperIds,ids=new Set(previous);for(const id of req.ids)req.hidden?ids.add(id):ids.delete(id);if(ids.size>6000)throw Error('隐藏记录达到上限');settings.hiddenWallpaperIds=[...ids];try{await saveConfig(root,settings);}catch(error){settings.hiddenWallpaperIds=previous;throw error;}return {config:settings,message:req.hidden?'已隐藏所选壁纸，原文件保持不变。':'已恢复所选壁纸。'};
  }
  if(req.action==='rotation-config'){
   if(typeof req.enabled!=='boolean'||!Number.isInteger(req.intervalSeconds)||req.intervalSeconds<10||req.intervalSeconds>86400||!['sequential','shuffle'].includes(req.order)||!Array.isArray(req.ids)||req.ids.length>3000||req.ids.some(id=>!settings.library.some(e=>e.id===id&&!['realtime','webwallgl'].includes(e.mode))))throw Error('轮播参数无效');
   const previous=settings.rotation;settings.rotation={enabled:req.enabled,intervalSeconds:req.intervalSeconds,order:req.order,ids:[...new Set(req.ids)]};try{await saveConfig(root,settings);}catch(error){settings.rotation=previous;throw error;}return {config:settings,message:'轮播设置已保存；仅轮播已导入的图片和视频，后台自动等待。'};
  }
  if(req.action==='rotation-next'){
   const next=nextRotation(settings);if(!next)return {config:settings,message:'至少需要两张未隐藏的图片或视频。'};const previous=settings.selectedId;settings.selectedId=next.id;try{await apply();await saveConfig(root,settings);}catch(error){settings.selectedId=previous;await apply();throw error;}return {config:settings};
  }
  if(req.action==='engine-preview')return {preview:await catalog.preview(req.projectToken)};
  if(req.action==='wallpaper-engine-confirm'){
   const pending=confirmations.get(req.confirmationToken);
   if(!pending||pending.owner!==c||pending.expires<Date.now()||req.confirmed!==true)throw Error('实时导入确认已失效，请重新选择');
   confirmations.delete(req.confirmationToken);
   const project=await describeProject(pending.project.root);
   if(project.sourceKey!==pending.project.sourceKey)throw Error('壁纸项目已改变，请重新确认');
   const mode=pending.renderer==='webwallgl'?'webwallgl':'realtime';
   const existing=settings.library.find(e=>e.mode===mode&&e.sourceKey===project.sourceKey);
   if(existing&&!pending.applyNow)return {config:settings,message:'该实时壁纸已保存，当前背景保持不变。'};
   const entry=existing||{id:randomUUID(),name:project.name+(mode==='webwallgl'?' · WebGL':' · 实时'),mode,scripts:mode==='webwallgl',projectRoot:project.root,sourceKey:project.sourceKey,workshopId:project.workshopId,source:mode==='webwallgl'?'WebWallGL 沙箱场景':'Wallpaper Engine 原生实时场景',limits:pending.limits};
   const previous=settings.selectedId,previousLimits=entry.limits,previousFallback=settings.realtimeFallbackId;if(existing)entry.limits=pending.limits;if(!existing)settings.library.push(entry);if(pending.applyNow){if(settings.library.some(e=>e.id===previous&&!['realtime','webwallgl'].includes(e.mode)))settings.realtimeFallbackId=previous;settings.selectedId=entry.id}
   try{if(pending.applyNow)await apply();await saveConfig(root,settings)}catch(error){settings.selectedId=previous;settings.realtimeFallbackId=previousFallback;entry.limits=previousLimits;if(!existing)settings.library.splice(settings.library.indexOf(entry),1);if(pending.applyNow)await apply();throw error}
   return {config:settings,message:pending.applyNow?'已保存并应用实时壁纸。':'实时壁纸已保存；未启动渲染，当前背景保持不变。'};
  }
  if(req.action==='engine-list'){const search={scope:req.scope||'global',folder:req.folder||'',kind:req.kind||'engine'};const result=await catalog.search(search);settings.engineSearch=search;await saveConfig(root,settings);return result}
  if(req.action==='engine-inspect'){const item=await catalog.resolve(req.projectToken);if(req.renderMode==='webwallgl'&&item.kind!=='media'){const project=await describeProject(item.root);return {inspection:{supported:project.type==='scene',needsRealtime:true,mode:'webwallgl',label:project.type==='scene'?'WebWallGL 沙箱实时渲染':'当前网页不能用 WebGL 模式导入',reason:project.type==='scene'?'不启动 Wallpaper Engine 源窗口；执行场景脚本，效果兼容性取决于此项目。':'请改为原生实时模式，网页资源通道尚未通过验收。'}};}return {inspection:item.kind==='media'?{supported:true,needsRealtime:false,mode:'media',label:'不需要实时渲染',reason:item.mime.startsWith('video/')?'当前选中的是视频，生成副本后直接播放。':'当前选中的是图片，可直接导入。'}:await inspectEngineProject(item.root,req.renderMode)}}
  if(req.action==='engine-pick-folder'){const result=await promisify(execFile)(getPowerShell(),['-NoProfile','-STA','-File',fileURLToPath(new URL('../windows/Pick-WallpaperFolder.ps1',import.meta.url)),'-InitialPath',settings.engineSearch?.folder||''],{windowsHide:true,timeout:150000});return JSON.parse(result.stdout)}
  if(req.action==='delete'){
   const index=settings.library.findIndex(e=>e.id===req.selectedId);if(index<0)throw Error('壁纸不存在');
   const entry=settings.library[index],selected=settings.selectedId;settings.library.splice(index,1);
   const wasActive=selected===entry.id;if(wasActive)settings.selectedId=settings.library.find(e=>!['realtime','webwallgl'].includes(e.mode))?.id||null;
   try{if(wasActive)await apply();await saveConfig(root,settings)}catch(e){settings.library.splice(index,0,entry);settings.selectedId=selected;if(wasActive)await apply();throw e}
   for(const file of [entry.file,entry.sourceFile,entry.sourcePath])await removeManagedFile(root,settings,file);
   return {config:settings,message:'已从 Codex 删除并清理专属缓存；Wallpaper Engine 原文件不变。'};
  }
  if(req.action==='playback'){
   const entry=settings.library.find(e=>e.id===settings.selectedId);if(!entry)throw Error('当前壁纸不存在');
   if(['realtime','webwallgl'].includes(entry.mode)){
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
   if(['realtime','webwallgl'].includes(req.renderMode)&&projectRoot){const project=await describeProject(projectRoot);if(['scene','web'].includes(project.type))return requestRealtime(c,projectRoot,applyNow,req.profile,req.renderMode==='webwallgl'?'webwallgl':'native')}
   const existing=settings.library.find(e=>!['realtime','webwallgl'].includes(e.mode)&&((resolved&&e.sourceKey===resolved.sourceKey)||(workshopId&&e.workshopId===workshopId)));
   if(existing){
    if(!applyNow)return {config:settings,message:'该壁纸已在“我的壁纸”中，未重复导入；当前背景保持不变。'};
    const previous=settings.selectedId;settings.selectedId=existing.id;
    try{await apply();await saveConfig(root,settings)}catch(e){settings.selectedId=previous;await apply();throw e}
    return {config:settings,message:'已切换到已导入的壁纸，未重复生成。'};
   }
   const id=randomUUID();let source,converted;
   try{source=resolved?.kind==='media'?{input:resolved.file,mime:resolved.mime,name:path.basename(resolved.file),source:'本地图片/视频',sourceKey:resolved.sourceKey,temporary:false}:await currentEngineSource(root,id,workshopId,resolved?.root)}catch(error){if(error.code==='REALTIME_REQUIRED')return requestRealtime(c,projectRoot,applyNow,req.profile);throw error}
   const requestedProfile=req.profile?realtimeProfile(req.profile):settings.playback;
   try{converted=await convertMedia(root,source.input,source.mime,id,requestedProfile)}catch(e){if(source.temporary)await removeManagedFile(root,settings,source.input);throw e}
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
   const keys=['code','embedded'];
   if(!keys.includes(req.region)||typeof req.enabled!=='boolean')throw Error('分区设置无效');
   const previous={...settings.surfaceSync};settings.surfaceSync={...previous,[req.region]:req.enabled};
   try{await applyAppearance();await saveConfig(root,settings)}catch(error){settings.surfaceSync=previous;await applyAppearance();throw error}
   return {config:settings,message:'已即时切换并保存；关闭开关可恢复该分区原生底色。'};
  }
  if(req.action==='select'){
   const selected=settings.library.find(e=>e.id===req.selectedId);if(!selected)throw Error('壁纸不存在');
   if(['realtime','webwallgl'].includes(selected.mode))return requestRealtime(c,selected.projectRoot,true,selected.limits,selected.mode==='webwallgl'?'webwallgl':'native');
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
  const converted=await convertMedia(root,path.join(root,u.file),u.mime,u.id,req.profile?realtimeProfile(req.profile):settings.playback);
  const entry={id:u.id,name:u.name,sourceFile:u.file,sourceMime:u.mime};const previous=settings.selectedId;settings.library.push(entry);settings.selectedId=entry.id;
  try{await commitConverted(root,settings,entry,converted,{...entry},apply,saveConfig)}catch(e){settings.library.pop();settings.selectedId=previous;await apply();throw e}return {config:settings};
 };
}
