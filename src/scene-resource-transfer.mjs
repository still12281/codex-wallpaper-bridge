// Only the host's project capability supplies a canonical path. The detached
// input lives in the trusted page; no author receives a File, path or DOM node.
// This avoids Base64/JSON copies without adding a server or changing CSP.
export async function transferSceneResource(c,reader,name,metadata,{handle,key,isCurrent=()=>true}){
 const assertCurrent=()=>{if(!isCurrent())throw Object.assign(Error('已跳过先前的选择'),{code:'CWB_SELECTION_SUPERSEDED'});};
 const unchanged=async()=>{assertCurrent();if((await reader.metadata(name))?.etag!==metadata.etag)throw Error('壁纸资源在加载时改变，请重试');};
 let objectId;
 try{
  await unchanged();const file=await reader.localFile(name);if(!file||file.size!==metadata.size)throw Error('壁纸资源在加载时改变，请重试');await unchanged();
  const created=await c.call('Runtime.evaluate',{expression:'Object.assign(document.createElement("input"),{type:"file"})',returnByValue:false});objectId=created.result?.objectId;if(created.exceptionDetails||!objectId)throw Error('无法创建壁纸文件读取器');
  try{await c.call('DOM.setFileInputFiles',{objectId,files:[file.path]});}catch(error){
   // Older/restricted CDP implementations keep the existing byte transfer.
   // File/version/cancellation errors below never retry through this fallback.
   await unchanged();if(!/wasn.t found|not found|not supported|not allowed|not available|Method not found/i.test(error.message))throw error;
   const bytes=await reader.read(name);if(!bytes||bytes.length!==metadata.size)throw Error('壁纸资源在加载时改变，请重试');await unchanged();
   await c.evaluate('window.__cwbSceneResources.begin('+JSON.stringify(handle)+','+JSON.stringify(key)+','+bytes.length+');true');
   for(let offset=0;offset<bytes.length;offset+=4*1024*1024){assertCurrent();await c.evaluate('window.__cwbSceneResources.receive('+JSON.stringify(handle)+','+JSON.stringify(bytes.subarray(offset,offset+4*1024*1024).toString('base64'))+','+offset+');true');}
   await unchanged();return 'cdp-base64';
  }
  assertCurrent();let timer;const operation=c.call('Runtime.callFunctionOn',{objectId,functionDeclaration:'function(id,key,size,modified){return window.__cwbSceneResources.readFile(id,key,this.files[0],size,modified)}',arguments:[handle,key,file.size,file.modified].map(value=>({value})),awaitPromise:true,returnByValue:true},undefined,60000);
  let loaded;try{loaded=await Promise.race([operation,new Promise((resolve,reject)=>{timer=setInterval(()=>{if(!isCurrent()){c.evaluate('window.__cwbSceneResources?.abort('+JSON.stringify(handle)+');true').catch(()=>{});reject(Object.assign(Error('已跳过先前的选择'),{code:'CWB_SELECTION_SUPERSEDED'}));}},25);})]);}finally{clearInterval(timer);}
  if(loaded.exceptionDetails)throw Error(loaded.exceptionDetails.exception?.description||loaded.exceptionDetails.text);await unchanged();return 'browser-file';
 }finally{
  if(objectId){await c.call('DOM.setFileInputFiles',{objectId,files:[]},undefined,1000).catch(()=>{});await c.call('Runtime.releaseObject',{objectId},undefined,1000).catch(()=>{});}
 }
}
