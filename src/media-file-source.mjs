import {realpath,stat} from 'node:fs/promises';
import path from 'node:path';
// Managed playback files only. The native picker/catalog authorizes imports;
// no arbitrary request path reaches this resolver or the opaque scene world.
export async function bindMediaFile(c,root,relative,candidateId,{isCurrent=()=>true}={}){
 const assertCurrent=()=>{if(!isCurrent())throw Object.assign(Error('已跳过先前的选择'),{code:'CWB_SELECTION_SUPERSEDED'});};
 const base=await realpath(root),file=await realpath(path.resolve(base,relative)),inside=path.relative(base,file);
 if(!inside||inside.startsWith('..')||path.isAbsolute(inside)||!/^media[\\/]/i.test(inside))throw Error('视频文件越过媒体目录');
 const before=await stat(file);if(!before.isFile()||!Number.isSafeInteger(before.size)||!before.size)throw Error('视频文件无效');
 let objectId;try{
  assertCurrent();const created=await c.call('Runtime.evaluate',{expression:'Object.assign(document.createElement("input"),{type:"file"})',returnByValue:false});objectId=created.result?.objectId;if(!objectId)throw Error('浏览器不支持本地视频文件通道');
  await c.call('DOM.setFileInputFiles',{objectId,files:[file]});assertCurrent();
  const afterPath=await realpath(path.resolve(base,relative)),after=await stat(afterPath);if(afterPath!==file||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)throw Error('视频在加载时改变，请重试');
  const loaded=await c.call('Runtime.callFunctionOn',{objectId,functionDeclaration:'function(id,size,modified){const state=window.__cwbPendingMedia,file=this.files[0];if(!state||state.candidateId!==id)throw Error("视频候选已过期");if(!file||file.size!==size||file.lastModified!==Math.trunc(modified))throw Error("视频在加载时改变");state.blobUrl=URL.createObjectURL(file);state.transport="native-media-file";return true}',arguments:[candidateId,before.size,before.mtimeMs].map(value=>({value})),returnByValue:true});
  if(loaded.exceptionDetails)throw Error(loaded.exceptionDetails.exception?.description||loaded.exceptionDetails.text);assertCurrent();return before.size;
 }finally{if(objectId){await c.call('DOM.setFileInputFiles',{objectId,files:[]},undefined,1000).catch(()=>{});await c.call('Runtime.releaseObject',{objectId},undefined,1000).catch(()=>{});}}
}
