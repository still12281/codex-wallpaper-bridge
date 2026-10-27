// Serialized into the trusted app page. The opaque wallpaper receives only
// validated resource bytes; it never obtains access to this cache or app data.
export function installSceneResourceCache(){
 if(window.__cwbSceneResources?.version===6)return;
 const limit=512*1024*1024,maxFile=256*1024*1024,buffers=new Map(),stats={hits:0,misses:0,bytesFromCache:0,bytesTransferred:0,bytesFromFile:0,evictions:0,cacheErrors:0};
 const cachePromise=Promise.resolve().then(()=>caches.open('codex-wallpaper-resources-v1')).catch(()=>{stats.cacheErrors++;return null;});
 // Cache API keys are identifiers only. No network fetch is made to this URL.
 const url=key=>{if(!/^[a-f0-9]{64}$/.test(key))throw Error('资源缓存键无效');return 'https://cwb-cache.invalid/resource/'+key;};
 const take=id=>{const value=buffers.get(id);if(!value)throw Error('资源缓冲已失效');return value;};
 const abort=id=>{const value=buffers.get(id);if(value)clearTimeout(value.timer);buffers.delete(id);value?.reader?.abort();};
 const deliver=(bytes,info)=>{if(info.media){if(!window.__cwbPendingMedia||window.__cwbPendingMedia.candidateId!==info.candidateId)throw Error('壁纸候选已关闭');window.__cwbPendingMedia.bytes=bytes;return;}const frame=document.querySelector('[data-cwb-renderer-id="'+info.rendererId+'"]')?.shadowRoot?.querySelector('iframe');if(!frame)throw Error('壁纸渲染页已关闭');frame.contentWindow.postMessage({token:info.token,resource:{id:info.id,bytes}},'*',[bytes.buffer]);};
 const prune=async(cache,incoming,size)=>{const keys=await cache.keys();let total=size;const entries=[];for(const key of keys){if(key.url===incoming)continue;const response=await cache.match(key),size=Number(response?.headers.get('Content-Length'))||0;entries.push({key,size});total+=size;}while(entries.length>=128||total>limit){const oldest=entries.shift();if(!oldest)break;await cache.delete(oldest.key);total-=oldest.size;stats.evictions++;}};
 window.__cwbSceneResources={version:6,stats,abort,
  begin(id,key,size){url(key);if(!Number.isSafeInteger(size)||size<0||size>512*1024*1024)throw Error('资源缓冲大小无效');abort(id);buffers.set(id,{key,bytes:new Uint8Array(size),timer:setTimeout(()=>abort(id),120000)});},
  receive(id,data,offset){const {bytes}=take(id);if(typeof bytes.setFromBase64==='function')stats.bytesTransferred+=bytes.subarray(offset).setFromBase64(data).written;else{const chunk=atob(data);for(let i=0;i<chunk.length;i++)bytes[offset+i]=chunk.charCodeAt(i);stats.bytesTransferred+=chunk.length;}},
  async readFile(id,key,file,size,modified){
   url(key);if(!file||!Number.isSafeInteger(size)||size<0||size>512*1024*1024||file.size!==size||file.lastModified!==Math.trunc(modified))throw Error('壁纸资源在加载时改变，请重试');
   abort(id);const reader=new FileReader(),value={key,bytes:null,reader,timer:setTimeout(()=>abort(id),120000)};buffers.set(id,value);
   try{
    const bytes=await new Promise((resolve,reject)=>{
     reader.onload=()=>resolve(new Uint8Array(reader.result));reader.onerror=()=>reject(reader.error||Error('壁纸文件读取失败'));reader.onabort=()=>reject(Error('壁纸资源读取已取消'));reader.readAsArrayBuffer(file);
    });
    if(buffers.get(id)!==value)throw Error('壁纸资源读取已取消');if(bytes.length!==size)throw Error('壁纸资源在加载时改变，请重试');
    value.bytes=bytes;stats.bytesFromFile+=size;return true;
   }catch(error){if(buffers.get(id)===value)abort(id);throw error;}
   finally{value.reader=null;reader.onload=reader.onerror=reader.onabort=null;}
  },
  async cached(key,size,info){const cache=await cachePromise;if(cache&&size<=maxFile)try{const response=await cache.match(url(key));if(response){const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length===size){deliver(bytes,info);stats.hits++;stats.bytesFromCache+=size;return true;}await cache.delete(url(key));}}catch{stats.cacheErrors++;}stats.misses++;return false;},
  async complete(id,info){const value=take(id);abort(id);const cache=await cachePromise;if(cache&&value.bytes.length<=maxFile)try{const put=async()=>{await prune(cache,url(value.key),value.bytes.length);await cache.put(url(value.key),new Response(value.bytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(value.bytes.length)}}));};if(navigator.locks?.request)await navigator.locks.request('codex-wallpaper-resource-cache',put);else await put();}catch{stats.cacheErrors++;}deliver(value.bytes,info);return true;}
 };
}

export async function callSceneResourceCache(client,method,args,{isCurrent}={}){
 let timer;const operation=client.call('Runtime.evaluate',{expression:'window.__cwbSceneResources['+JSON.stringify(method)+'](...'+JSON.stringify(args)+')',awaitPromise:true,returnByValue:true},undefined,60000);
 let result;try{result=await(isCurrent?Promise.race([operation,new Promise((resolve,reject)=>{timer=setInterval(()=>{if(!isCurrent())reject(Object.assign(Error('已跳过先前的选择'),{code:'CWB_SELECTION_SUPERSEDED'}));},25);})]):operation);}finally{clearInterval(timer);}
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
 return result.result?.value;
}
