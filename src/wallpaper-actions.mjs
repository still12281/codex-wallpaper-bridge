import {getPowerShell} from './runtime-paths.mjs';
import {fileURLToPath} from 'node:url';
import {open,writeFile,rename,mkdir,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {libraryPreview,hashMedia,duplicateEntry} from './library-preview.mjs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createEngineCatalog} from './engine-library.mjs';
import {convertMedia} from './media-converter.mjs';
import {currentEngineSource,getCurrentEngineProject,inspectEngineProject} from './wallpaper-engine-source.mjs';
import {commitConverted,removeManagedFile} from './media-store.mjs';
import {describeProject,realtimeProfile,findWorkshopProject} from './realtime-source.mjs';
import {sanitizeVisual,appearanceSnapshot,parsePreset,nextRotation} from './appearance-model.mjs';
import {AUDIO_FPS_OPTIONS,normalizeAudioFps} from './system-media.mjs';
import {DISPLAY_TIERS,effectiveMediaSettings} from './display-tiers.mjs';
const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'};
export async function saveConfig(root,settings){const temp=path.join(root,'settings.next.json');await writeFile(temp,JSON.stringify(settings,null,2));await rename(temp,path.join(root,'settings.json'))}
export function normalizeLibrary(settings){
 settings.library??=[];settings.selectedId??=null;settings.pauseOnBlur??=true;settings.playback??={maxWidth:1280,fps:24};
 settings.engineSearch??={scope:'global',folder:'',kind:'engine'};
 settings.surfaceSync={code:settings.surfaceSync?.code!==false,embedded:settings.surfaceSync?.embedded!==false};
 settings.visual=sanitizeVisual(settings.visual);settings.presets??=[];settings.hiddenWallpaperIds??=[];settings.rotation??={enabled:false,intervalSeconds:60,order:'sequential',ids:[]};
 settings.systemMedia??={enabled:false,audio:false};
 settings.systemMedia.audioFps=normalizeAudioFps(settings.systemMedia.audioFps);
}
export function createActions(root,settings,apply,applyAppearance=apply,services={}){
 const uploads=new Map(),catalog=createEngineCatalog(),confirmations=new Map();
 const populateHashes=async()=>{for(const entry of settings.library){if(entry.contentHash||['realtime','webwallgl'].includes(entry.mode))continue;const source=entry.sourceFile;if(!source)continue;try{entry.contentHash=await hashMedia(path.resolve(root,source));}catch{}}};
 const duplicate=(entry,applyNow,policy)=>policy==='skip'?{config:settings,duplicateSkipped:entry.name,message:'已跳过重复壁纸：'+entry.name}:{duplicate:{existingId:entry.id,name:entry.name,apply:applyNow},message:'该壁纸已在我的壁纸中。'};
 const requestRealtime=async(c,projectRoot,applyNow,profile,renderer='native',duplicatePolicy,nativeFull=false)=>{
  const project=await describeProject(projectRoot);
  if(!['scene','web'].includes(project.type))throw Error('此项目不支持实时模式');
  if(renderer==='webwallgl'&&project.type!=='scene')throw Error('网页 WebWallGL 资源通道尚未通过验收，请选择原生实时模式');
  const limits={...realtimeProfile(profile||settings.playback),...(profile?.exactResolution?{exactResolution:true}:{})},token=randomUUID();
  for(const [id,p]of confirmations)if(p.expires<Date.now()||p.owner===c)confirmations.delete(id);
  confirmations.set(token,{owner:c,expires:Date.now()+300000,project,applyNow,limits,renderer,duplicatePolicy,nativeFull});
  return {confirmation:{token,name:project.name,apply:applyNow,limits,renderer},message:'此壁纸需要实时渲染，请确认后继续。'};
 };
 return async function action(c,req){
  if(req.action==='display-native'){
   const entry=settings.library.find(e=>e.id===settings.selectedId);if(!entry)throw Error('请先选择壁纸');
   const projectRoot=entry.projectRoot||(entry.workshopId?await findWorkshopProject(entry.workshopId):null);if(!projectRoot)throw Error('当前素材没有完整场景引用；请从 Wallpaper Engine 项目导入');
   const profile=services.nativeProfile?await services.nativeProfile(c,projectRoot):{maxWidth:3840,maxHeight:2160,fps:30,jpegQuality:92};
   return requestRealtime(c,projectRoot,true,profile,'native','use',true);
  }
  if(req.action==='display-renderer'){
   if(!['native','webwallgl'].includes(req.renderMode))throw Error('请选择渲染方式');
   const entry=settings.library.find(e=>e.id===settings.selectedId);if(!entry)throw Error('请先选择壁纸');const projectRoot=entry.projectRoot||(entry.workshopId?await findWorkshopProject(entry.workshopId):null);if(!projectRoot)throw Error('此素材没有完整场景');
   const profile=entry.displayTier==='full'?(services.nativeProfile?await services.nativeProfile(c,projectRoot):{maxWidth:3840,maxHeight:2160,fps:30,jpegQuality:92}):{...(entry.limits||settings.playback)};
   if(req.renderMode==='webwallgl'){delete profile.jpegQuality;if(entry.displayTier==='full')profile.exactResolution=true;}
   return requestRealtime(c,projectRoot,true,profile,req.renderMode,'use',entry.displayTier==='full');
  }
  if(req.action==='scene-quality'){
   const entry=settings.library.find(e=>e.id===settings.selectedId);if(entry?.mode!=='webwallgl'||entry.displayTier==='static')throw Error('请先启用 WebGL 动态场景，再调整场景画质');
   const {particles,postProcessing,antiAliasing,videoTexScale}=req;
   if(!['low','medium','high'].includes(particles)||!['low','medium','high'].includes(postProcessing)||!['off','fxaa','msaa2','msaa4'].includes(antiAliasing)||![.5,.75,1].includes(videoTexScale))throw Error('场景画质参数无效');
   const previous=structuredClone(entry);entry.quality={particles,postProcessing,antiAliasing};entry.videoTexScale=videoTexScale;entry.displayTier='custom';delete entry.customDisplay;
   try{await apply();await services.configureMedia?.(effectiveMediaSettings(settings));await saveConfig(root,settings)}catch(error){Object.keys(entry).forEach(k=>delete entry[k]);Object.assign(entry,previous);await apply();await services.configureMedia?.(effectiveMediaSettings(settings));throw error;}
   return {config:settings,message:'已应用自定义场景画质；效果链保持开启。'};
  }
  if(req.action==='display-tier'){
   const tier=DISPLAY_TIERS[req.tier],entry=settings.library.find(e=>e.id===settings.selectedId);if(!tier||!entry)throw Error('请选择壁纸和有效显示档位');
   if(req.tier==='full'&&entry.mode!=='webwallgl'&&(entry.projectRoot||entry.workshopId)){
    const projectRoot=entry.projectRoot||await findWorkshopProject(entry.workshopId),project=await describeProject(projectRoot);
    if(['scene','web'].includes(project.type))return action(c,{action:'display-native'});
   }
   const previous=structuredClone(entry);let created;
   try{
    const customKeys=['limits','quality','videoTexScale','file','mime'];
    if(req.tier!=='custom'&&(!entry.displayTier||entry.displayTier==='custom'))entry.customDisplay=Object.fromEntries(customKeys.filter(k=>entry[k]!==undefined).map(k=>[k,structuredClone(entry[k])]));
    if(req.tier==='custom'&&entry.customDisplay){for(const k of customKeys){if(k in entry.customDisplay)entry[k]=entry.customDisplay[k];else delete entry[k];}delete entry.customDisplay;}
    if(req.tier==='static'){
     if(!entry.staticFile||entry.displayTier!=='static'){if(typeof services.captureStatic!=='function')throw Error('当前环境不支持生成静态画面');created=await services.captureStatic(entry);entry.staticFile=created;}
    }else if(req.tier!=='custom'){
     const limits=realtimeProfile(req.tier==='full'?{...tier,maxHeight:2160}:tier);if(req.tier==='full'&&entry.mode==='webwallgl')limits.exactResolution=true;
     if(['webwallgl','realtime'].includes(entry.mode)){entry.limits=limits;entry.quality={antiAliasing:req.tier==='full'?(entry.customDisplay?.quality?.antiAliasing||entry.quality?.antiAliasing||'fxaa'):'off',particles:tier.particles,postProcessing:tier.postProcessing};entry.videoTexScale=tier.videoTexScale;}
     else if(entry.mime?.startsWith('video/')||entry.mime==='image/gif'){
      const converted=await convertMedia(root,entry.sourcePath||path.join(root,entry.sourceFile||entry.file),entry.sourceMime||entry.mime,entry.id,limits);
      created='media/variant-'+randomUUID()+'.mp4';await rename(path.join(root,converted.file),path.join(root,created));entry.file=created;entry.mime=converted.mime;entry.limits=converted.limits;
     }
    }
    entry.displayTier=req.tier;await apply();await services.configureMedia?.(effectiveMediaSettings(settings));await saveConfig(root,settings);
   }catch(error){for(const k of Object.keys(entry))delete entry[k];Object.assign(entry,previous);await services.configureMedia?.(effectiveMediaSettings(settings));await apply();if(created)await removeManagedFile(root,settings,created);throw error;}
   return {config:settings,message:'已应用“'+tier.name+'”。'+tier.description+'；渲染器兼容范围不因档位改变。'};
  }
  if(req.action==='library-preview'){const entry=settings.library.find(e=>e.id===req.selectedId);if(!entry)throw Error('壁纸不存在');return libraryPreview(root,entry);}
  if(req.action==='duplicate-use'){
   const entry=settings.library.find(e=>e.id===req.existingId);if(!entry||typeof req.apply!=='boolean')throw Error('已有壁纸不存在');if(!req.apply)return {config:settings,message:'已保留已有壁纸，未重复导入。'};return action(c,{action:'select',selectedId:entry.id});
  }
  if(req.action==='system-media-config'){
   if(typeof req.enabled!=='boolean'||typeof req.audio!=='boolean'||typeof services.configureMedia!=='function')throw Error('系统媒体配置不可用');
   const audioFps=req.audioFps===undefined?normalizeAudioFps(settings.systemMedia?.audioFps):Number(req.audioFps);if(!AUDIO_FPS_OPTIONS.includes(audioFps))throw Error('音频响应档位无效');
   const previous=settings.systemMedia;settings.systemMedia={enabled:req.enabled,audio:req.audio,audioFps};
   try{await services.configureMedia(effectiveMediaSettings(settings));if(previous?.audio!==req.audio)await apply();await saveConfig(root,settings);}catch(error){settings.systemMedia=previous;await services.configureMedia(effectiveMediaSettings(settings));if(previous?.audio!==req.audio)await apply();throw error;}
   return {config:settings,message:req.audio?'音频响应已开启，频谱更新上限 '+audioFps+' 次/秒；实际响应受渲染帧率和音频组件限制。':'音频响应已关闭；歌曲信息按独立开关设置。'};
  }
  if(req.action==='system-media-control'){if(typeof services.controlMedia!=='function')throw Error('系统媒体未启用');if(typeof req.sourceId!=='string'||!req.sourceId||req.sourceId.length>200)throw Error('播放器身份已失效，请等待媒体信息刷新');await services.controlMedia(req.command,req.sourceId);return {message:'已向当前播放器执行操作。'};}
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
   if(existing&&pending.duplicatePolicy!=='use')return duplicate(existing,pending.applyNow,pending.duplicatePolicy);
   const entry=existing||{id:randomUUID(),name:project.name+(mode==='webwallgl'?' · WebGL':' · 实时'),mode,scripts:mode==='webwallgl',projectRoot:project.root,sourceKey:project.sourceKey,workshopId:project.workshopId,source:mode==='webwallgl'?'WebWallGL 沙箱场景':'Wallpaper Engine 原生实时场景',limits:pending.limits};
   const previous=settings.selectedId,previousLimits=entry.limits,previousFallback=settings.realtimeFallbackId,previousEntry=existing?structuredClone(entry):null;if(existing)entry.limits=pending.limits;if(pending.nativeFull){entry.displayTier='full';delete entry.customDisplay;if(mode==='webwallgl'){entry.quality={postProcessing:'high',particles:'high',antiAliasing:'fxaa'};entry.videoTexScale=1;}}if(!existing)settings.library.push(entry);if(pending.applyNow){if(settings.library.some(e=>e.id===previous&&!['realtime','webwallgl'].includes(e.mode)))settings.realtimeFallbackId=previous;settings.selectedId=entry.id}
   try{if(pending.applyNow)await apply();await saveConfig(root,settings)}catch(error){settings.selectedId=previous;settings.realtimeFallbackId=previousFallback;if(previousEntry){for(const k of Object.keys(entry))delete entry[k];Object.assign(entry,previousEntry);}else entry.limits=previousLimits;if(!existing)settings.library.splice(settings.library.indexOf(entry),1);if(pending.applyNow)await apply();throw error}
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
   for(const file of [entry.file,entry.sourceFile,entry.sourcePath,entry.staticFile])await removeManagedFile(root,settings,file);
   return {config:settings,message:'已从 Codex 删除并清理专属缓存；Wallpaper Engine 原文件不变。'};
  }
  if(req.action==='playback'){
   const entry=settings.library.find(e=>e.id===settings.selectedId);if(!entry)throw Error('当前壁纸不存在');
   if(['realtime','webwallgl'].includes(entry.mode)){
    const previous=entry.limits,oldProfile=settings.playback,previousTier=entry.displayTier,previousCustom=entry.customDisplay;
    const profile=entry.mode==='realtime'?{...req,...(previous?.maxHeight?{maxHeight:Math.floor(Number(req.maxWidth)*previous.maxHeight/previous.maxWidth/2)*2}:{}),...(previous?.jpegQuality?{jpegQuality:previous.jpegQuality}:{})}:req;
    entry.limits=realtimeProfile(profile);entry.displayTier='custom';delete entry.customDisplay;settings.playback={maxWidth:entry.limits.maxWidth,fps:entry.limits.fps};
    try{await apply();await services.configureMedia?.(effectiveMediaSettings(settings));await saveConfig(root,settings)}catch(error){entry.limits=previous;entry.displayTier=previousTier;if(previousCustom)entry.customDisplay=previousCustom;settings.playback=oldProfile;await apply();await services.configureMedia?.(effectiveMediaSettings(settings));throw error}
    return {config:settings,message:'已更新实时输出分辨率与采集帧率；Wallpaper Engine 全局帧率未修改。'};
   }
   const input=entry.sourcePath||path.join(root,entry.sourceFile||entry.file);
   try{await stat(input)}catch{throw Error('原素材不可用，请重新导入后调整规格')}
   const profile={maxWidth:Number(req.maxWidth),fps:Number(req.fps)};
   if(entry.displayTier!=='static'&&entry.limits?.maxWidth===profile.maxWidth&&(!entry.mime.startsWith('video/')||entry.limits?.fps===profile.fps))return {config:settings,message:'当前已是所选规格，无需重新生成。'};
   const converted=await convertMedia(root,input,entry.sourceMime||entry.mime,entry.id,profile);
   const previous={...entry},oldProfile=settings.playback;settings.playback=profile;entry.displayTier='custom';delete entry.customDisplay;
   try{await commitConverted(root,settings,entry,converted,previous,apply,saveConfig)}catch(e){settings.playback=oldProfile;throw e}return {config:settings};
  }
  if(req.action==='wallpaper-engine'){
   const applyNow=req.apply!==false;
   const resolved=req.projectToken?await catalog.resolve(req.projectToken):(!req.workshopId?await getCurrentEngineProject():null);
   const workshopId=resolved?.workshopId||req.workshopId;
   const projectRoot=resolved?.root||(workshopId?await findWorkshopProject(workshopId):null);
   if((req.renderMode||'auto')==='auto'&&projectRoot&&resolved?.kind!=='media'){
    const inspection=await inspectEngineProject(projectRoot);
    if(inspection.needsRealtime){const project=await describeProject(projectRoot),renderer=inspection.mode==='webwallgl'?'webwallgl':'native',existing=duplicateEntry(settings,{mode:renderer==='webwallgl'?'webwallgl':'realtime',sourceKey:project.sourceKey});if(existing)return duplicate(existing,applyNow,req.duplicatePolicy);return requestRealtime(c,projectRoot,applyNow,req.profile,renderer,req.duplicatePolicy)}
   }
   if(['realtime','webwallgl'].includes(req.renderMode)&&projectRoot){const project=await describeProject(projectRoot);if(['scene','web'].includes(project.type)){const existing=duplicateEntry(settings,{mode:req.renderMode,sourceKey:project.sourceKey});if(existing)return duplicate(existing,applyNow,req.duplicatePolicy);return requestRealtime(c,projectRoot,applyNow,req.profile,req.renderMode==='webwallgl'?'webwallgl':'native',req.duplicatePolicy)}}
   let contentHash;if(resolved?.kind==='media'){contentHash=await hashMedia(resolved.file);await populateHashes();}const existing=duplicateEntry(settings,{sourceKey:resolved?.sourceKey,workshopId,contentHash});
   if(existing){
    return duplicate(existing,applyNow,req.duplicatePolicy);
   }
   const id=randomUUID();let source,converted;
   try{source=resolved?.kind==='media'?{input:resolved.file,mime:resolved.mime,name:path.basename(resolved.file),source:'本地图片/视频',sourceKey:resolved.sourceKey,temporary:false}:await currentEngineSource(root,id,workshopId,resolved?.root)}catch(error){if(error.code==='REALTIME_REQUIRED')return requestRealtime(c,projectRoot,applyNow,req.profile,'native',req.duplicatePolicy);throw error}
   const requestedProfile=req.profile?realtimeProfile(req.profile):settings.playback;
   try{contentHash??=await hashMedia(source.input);converted=await convertMedia(root,source.input,source.mime,id,requestedProfile)}catch(e){if(source.temporary)await removeManagedFile(root,settings,source.input);throw e}
   const entry={id,name:source.name,source:source.source,sourcePath:source.input,sourceMime:source.mime,workshopId:source.workshopId,sourceKey:source.sourceKey,...(contentHash?{contentHash}:{})};const previous=settings.selectedId;settings.library.push(entry);if(applyNow)settings.selectedId=id;
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
   if(settings.selectedId===req.selectedId&&(!services.isSelectedHealthy||await services.isSelectedHealthy(c)))return {config:settings,message:'当前已使用此壁纸。'};
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
  const contentHash=await hashMedia(path.join(root,u.file));
  await populateHashes();
  const existingUpload=duplicateEntry(settings,{contentHash});if(existingUpload){await removeManagedFile(root,settings,u.file);return duplicate(existingUpload,true,req.duplicatePolicy);}
  const converted=await convertMedia(root,path.join(root,u.file),u.mime,u.id,req.profile?realtimeProfile(req.profile):settings.playback);
  const entry={id:u.id,name:u.name,sourceFile:u.file,sourceMime:u.mime,contentHash};const previous=settings.selectedId;settings.library.push(entry);settings.selectedId=entry.id;
  try{await commitConverted(root,settings,entry,converted,{...entry},apply,saveConfig)}catch(e){settings.library.pop();settings.selectedId=previous;await apply();throw e}return {config:settings};
 };
}
