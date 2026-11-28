import {lstat,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
const ALLOWED_MEDIA_EXT=/^\.(mp4|webm|webp|png|jpg|jpeg|gif)$/i;
export const isUncPath=value=>typeof value==='string'&&(/^(?:\\\\|\/\/)/.test(value)||path.parse(value).root.startsWith(path.sep+path.sep));
const pathKey=value=>{const resolved=path.resolve(value);return process.platform==='win32'?resolved.toLowerCase():resolved;};
function registeredExternalPaths(settings){
 const allowed=new Set();
 for(const entry of settings?.library||[]){
  if(['realtime','webwallgl'].includes(entry?.mode))continue;
  for(const candidate of [entry?.file,entry?.sourcePath,entry?.customDisplay?.file]){
   if(typeof candidate==='string'&&path.isAbsolute(candidate)&&!isUncPath(candidate))allowed.add(pathKey(candidate));
  }
 }
 return allowed;
}
async function assertNoSymlinkSegments(target){
 let current=path.resolve(target);
 const {root}=path.parse(current);
 while(true){
  const info=await lstat(current);
  if(info.isSymbolicLink())throw Error('外部媒体路径不允许使用符号链接或目录联接');
  if(current===root)break;
  const parent=path.dirname(current);
  if(parent===current)break;
  current=parent;
 }
}
// Managed playback files and registered local external media only.
// No arbitrary request path reaches this resolver or the opaque scene world.
export async function resolveAuthorizedMedia(root,settings,target){
 if(typeof target!=='string'||!target.trim())throw Error('媒体路径无效');
 if(isUncPath(target))throw Error('不支持网络共享路径（UNC）');
 const missingError=managed=>Object.assign(Error(managed?'壁纸播放文件已丢失，请重新导入。':'原壁纸文件已移动、改名或被删除（如 Steam 取消订阅），请检查原文件或重新导入。'),{code:'CWB_MEDIA_MISSING'});
 if(!path.isAbsolute(target)){
  const base=await realpath(root);
  let file;try{file=await realpath(path.resolve(base,target));}catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')throw missingError(true);throw error;}
  const inside=path.relative(base,file);
  if(!inside||inside.startsWith('..')||path.isAbsolute(inside)||!/^media[\\/]/i.test(inside))throw Error('视频文件越过媒体目录');
  if(isUncPath(file)||!ALLOWED_MEDIA_EXT.test(path.extname(file)))throw Error('媒体文件格式不受支持');
  const info=await stat(file);
  if(!info.isFile()||!Number.isSafeInteger(info.size)||!info.size)throw Error('媒体文件无效');
  return {path:file,info,managed:true};
 }
 if(target.split(/[\\/]/).includes('..'))throw Error('外部媒体路径不允许包含相对跳转');
 if(!ALLOWED_MEDIA_EXT.test(path.extname(target)))throw Error('外部媒体文件格式不受支持');
 const allowed=registeredExternalPaths(settings);
 if(!allowed.has(pathKey(target)))throw Error('外部媒体路径未在已保存壁纸库中登记');
 try{await assertNoSymlinkSegments(target);}
 catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')throw missingError(false);throw error;}
 let file;try{file=await realpath(target);}catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')throw missingError(false);throw error;}
 if(isUncPath(file)||!ALLOWED_MEDIA_EXT.test(path.extname(file)))throw Error('外部媒体文件格式或路径不受支持');
 const info=await stat(file);
 if(!info.isFile()||!Number.isSafeInteger(info.size)||!info.size)throw Error('外部媒体文件无效');
 return {path:file,info,managed:false};
}
export async function bindMediaFile(c,root,target,candidateId,{isCurrent=()=>true,settings=null}={}){
 const assertCurrent=()=>{if(!isCurrent())throw Object.assign(Error('已跳过先前的选择'),{code:'CWB_SELECTION_SUPERSEDED'});};
 const resolved=await resolveAuthorizedMedia(root,settings,target);
 const file=resolved.path,before=resolved.info;
 let objectId;try{
  assertCurrent();const created=await c.call('Runtime.evaluate',{expression:'Object.assign(document.createElement("input"),{type:"file"})',returnByValue:false});objectId=created.result?.objectId;if(!objectId)throw Error('浏览器不支持本地视频文件通道');
  await c.call('DOM.setFileInputFiles',{objectId,files:[file]});assertCurrent();
  const afterResolved=await resolveAuthorizedMedia(root,settings,target);
  const afterPath=afterResolved.path,after=afterResolved.info;
  if(afterPath!==file||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)throw Error('视频在加载时改变，请重试');
  const loaded=await c.call('Runtime.callFunctionOn',{objectId,functionDeclaration:'function(id,size,modified){const state=window.__cwbPendingMedia,file=this.files[0];if(!state||state.candidateId!==id)throw Error("视频候选已过期");if(!file||file.size!==size||file.lastModified!==Math.trunc(modified))throw Error("视频在加载时改变");state.blobUrl=URL.createObjectURL(file);state.transport="native-media-file";return true}',arguments:[candidateId,before.size,before.mtimeMs].map(value=>({value})),returnByValue:true});
  if(loaded.exceptionDetails)throw Error(loaded.exceptionDetails.exception?.description||loaded.exceptionDetails.text);assertCurrent();return before.size;
 }finally{if(objectId){await c.call('DOM.setFileInputFiles',{objectId,files:[]},undefined,1000).catch(()=>{});await c.call('Runtime.releaseObject',{objectId},undefined,1000).catch(()=>{});}}
}
