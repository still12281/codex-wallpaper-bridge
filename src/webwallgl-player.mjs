import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProjectReader} from './webwallgl-source.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Browser functions are serialized into a sandbox execution world, not the Codex world.
function initializeRenderer(project,options,binding){
 const state=globalThis.__cwbWebGL={ready:false,paused:false,diagnostics:[],requests:new Map(),buffers:new Map(),sequence:0};
 state.receive=(id,data,offset,total)=>{let bytes=state.buffers.get(id);if(!bytes){bytes=new Uint8Array(total);state.buffers.set(id,bytes);}const chunk=atob(data);for(let i=0;i<chunk.length;i++)bytes[offset+i]=chunk.charCodeAt(i);};
 state.complete=(id,error,missing)=>{const pending=state.requests.get(id);if(!pending)return;clearTimeout(pending.timer);state.requests.delete(id);const bytes=state.buffers.get(id);state.buffers.delete(id);error?pending.reject(Error(error)):pending.resolve(missing?null:bytes||new Uint8Array());};
 const inFlight=new Map(),read=name=>{if(inFlight.has(name))return inFlight.get(name);const promise=new Promise((resolve,reject)=>{const id=++state.sequence,timer=setTimeout(()=>state.complete(id,'壁纸资源读取超时'),60000);state.requests.set(id,{resolve,reject,timer});globalThis[binding](JSON.stringify({id,name}));});inFlight.set(name,promise);promise.finally(()=>inFlight.delete(name)).catch(()=>{});return promise;};
 try{void globalThis.caches}catch{Object.defineProperty(globalThis,'caches',{value:undefined,configurable:true});}
 const host=document.getElementById('wp'),instance=WebWallGL.createScene(host,{fit:'cover',fps:options.fps,renderDpr:Math.min(1,options.maxWidth/innerWidth),videoTexScale:.5,volume:0,scripts:options.scripts===true,bake:false,media:null,
  onReady:()=>{state.ready=true;},onError:error=>{state.error=String(error?.message||error);},onDiagnostic:(message,level)=>{state.diagnostics.push({message:String(message).slice(0,240),level});state.diagnostics=state.diagnostics.slice(-20);}});
 state.instance=instance;
 const source={key:options.key,project:async()=>project,sceneDir:async()=>{if(!/\.json$/i.test(project.file||''))return null;return await read(project.file)?{entry:project.file,read}:null;},scenePkg:async()=>{for(const name of [...(/\.pkg$/i.test(project.file||'')?[project.file]:[]),'scene.pkg','scenes/scene.pkg','gifscene.pkg']){const bytes=await read(name);if(bytes)return bytes;}throw Error('项目没有可读取的场景包');}};
 state.sample=()=>{const canvas=host.querySelector('canvas');return {ready:state.ready,error:state.error,paused:state.paused,width:canvas?.width||0,height:canvas?.height||0,systemAudioActive:!!state.externalAudio,stats:{...instance.stats},diagnostics:state.diagnostics};};
 state.pause=value=>{state.paused=!!value;value?instance.pause():instance.resume();};
 const syncSpectrum=payload=>{state.spectrum=payload;if(payload.audioAvailable&&!state.externalAudio){state.externalAudio=true;instance.setAudio({snapshot:()=>{if(!state.spectrum?.audioAvailable)return null;const bands=state.spectrum.bands.map(n=>n/255);return {left:bands,right:bands};}});}else if(!payload.audioAvailable&&state.externalAudio){state.externalAudio=false;instance.setAudio(null);}};
 const control=event=>{const message=event.data;if(event.source!==parent||message?.token!==options.controlToken)return;if(typeof message.paused==='boolean')state.pause(message.paused);if(message.pointer)instance.pushPointer(...message.pointer);if(Number.isFinite(message.volume))instance.setVolume(message.volume);if(message.properties)instance.setProperties(message.properties);if(message.systemMedia){state.mediaPayload=message.systemMedia;if(!state.mediaSource){state.mediaSource=WebWallGL.createMediaSource(message.systemMedia);instance.setMedia(state.mediaSource);}else state.mediaSource.set(message.systemMedia);}if(message.systemPosition)state.mediaSource?.set(message.systemPosition);if(message.systemSpectrum)syncSpectrum(message.systemSpectrum);};
 addEventListener('message',control);const report=setInterval(()=>parent.postMessage({token:options.controlToken,sample:state.sample()},'*'),1000);
 state.dispose=()=>{clearInterval(report);removeEventListener('message',control);instance.destroy({releasePkgCache:true});for(const request of state.requests.values()){clearTimeout(request.timer);request.reject(Error('Renderer disposed'));}state.requests.clear();state.buffers.clear();};
 instance.load(source).catch(error=>{state.error=String(error?.stack||error);});
 return true;
}

function createCandidate(id,limits){
 const layer=document.createElement('div');layer.id=id;layer.setAttribute('aria-hidden','true');layer.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0';
 layer.dataset.cwbRendererId=id;
 const shadow=layer.attachShadow({mode:'open'}),frame=document.createElement('iframe');frame.title='壁纸渲染';frame.tabIndex=-1;frame.setAttribute('sandbox','allow-scripts');frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none';
 const url=URL.createObjectURL(new Blob(['<!doctype html><meta charset="utf-8"><style>html,body,#wp{margin:0;width:100%;height:100%;overflow:hidden;background:#151923}canvas{display:block}</style><div id="wp"></div>'],{type:'text/html'}));frame.src=url;shadow.append(frame);document.body.prepend(layer);
 const resize=()=>{const scale=Math.min(1,(limits.maxWidth||1280)/innerWidth,(limits.maxHeight||900)/innerHeight),width=Math.max(1,Math.floor(innerWidth*scale)),height=Math.max(1,Math.floor(innerHeight*scale));frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transformOrigin='top left';frame.style.transform='scale('+1/scale+')';};resize();const observer=new ResizeObserver(resize);observer.observe(layer);layer.__cwbCandidateDispose=()=>observer.disconnect();return {url};
}

export async function mountWebWallGL(c,entry,{dataRoot,config,probe=false}){
 const reader=await createProjectReader(entry.projectRoot);
 if(reader.project.type==='web')throw Error('当前沙箱资源通道尚未通过网页脚本验收，请选择原生实时模式');
 const enginePath=process.env.CODEX_WALLPAPER_WEBWALLGL||path.join(dataRoot,'engines','webwallgl-3.0.0','webwallgl.global.min.js');
 let engine;try{engine=await readFile(enginePath,'utf8');}catch{throw Error('WebWallGL 未准备，请先运行 npm run prepare:webwallgl');}
 const id='cwb-webgl-'+randomUUID(),binding='cwbAsset'+randomUUID().replaceAll('-',''),controlToken=randomUUID(),candidate=await c.evaluate('('+createCandidate.toString()+')('+JSON.stringify(id)+','+JSON.stringify(entry.limits||{})+')');
 let contextId,sessionId,closed=false,listener,transferQueue=Promise.resolve();const pending=new Set();
 const evaluate=expression=>c.evaluate(expression,contextId,sessionId);
 const cleanup=async()=>{if(closed)return;closed=true;if(listener)c.ws.removeEventListener('message',listener);await evaluate('globalThis.__cwbWebGL?.dispose();true').catch(()=>{});await c.evaluate('(()=>{const s=window.__codexWallpaperBridge;if(s?.rendererId==='+JSON.stringify(id)+'){s.dispose?.();delete window.__codexWallpaperBridge}const layer=document.querySelector('+JSON.stringify('[data-cwb-renderer-id="'+id+'"]')+');layer?.__cwbCandidateDispose?.();layer?.remove();URL.revokeObjectURL('+JSON.stringify(candidate.url)+');return true})()').catch(()=>{});};
 try{
  let frame;
  for(let i=0;i<40;i++){
   const tree=await c.call('Page.getFrameTree');const find=node=>node.frame.url===candidate.url?node.frame:(node.childFrames||[]).map(find).find(Boolean);frame=find(tree.frameTree);
   if(!frame){const {targetInfos}=await c.call('Target.getTargets');const child=targetInfos.find(t=>t.type==='iframe'&&t.url===candidate.url);if(child){({sessionId}=await c.call('Target.attachToTarget',{targetId:child.targetId,flatten:true}));frame=(await c.call('Page.getFrameTree',{},sessionId)).frameTree.frame;}}
   if(frame)break;await sleep(100);
  }
  if(!frame){const tree=await c.call('Page.getFrameTree'),inventory=(await c.call('Target.getTargets')).targetInfos,dom=await c.evaluate('(()=>{const layer=document.getElementById('+JSON.stringify(id)+');return {ready:document.readyState,url:location.href,layer:!!layer,frame:layer?.shadowRoot?.querySelector("iframe")?.src}})()');throw Error('壁纸沙箱 iframe 未导航：'+JSON.stringify({dom,tree:tree.frameTree,targets:inventory.filter(t=>t.type==='iframe')}));}
  ({executionContextId:contextId}=await c.call('Page.createIsolatedWorld',{frameId:frame.id,worldName:id},sessionId));
  await c.call('Runtime.addBinding',{name:binding,executionContextId:contextId},sessionId);
  listener=event=>{let msg;try{msg=JSON.parse(event.data);}catch{return;}if(msg.method!=='Runtime.bindingCalled'||msg.params.name!==binding||msg.sessionId!==sessionId||msg.params.executionContextId!==contextId)return;
   let request;try{request=JSON.parse(msg.params.payload);}catch{return;}if(!Number.isInteger(request.id)||pending.has(request.id))return;if(pending.size>=512){evaluate('__cwbWebGL.complete('+request.id+',"壁纸资源请求过多");true').catch(()=>{});return;}pending.add(request.id);
   transferQueue=transferQueue.then(async()=>{try{if(closed)return;const bytes=await reader.read(request.name);if(closed)return;if(bytes)for(let offset=0;offset<bytes.length;offset+=512*1024){if(closed)return;await evaluate('__cwbWebGL.receive('+request.id+','+JSON.stringify(bytes.subarray(offset,offset+512*1024).toString('base64'))+','+offset+','+bytes.length+');true');}if(!closed)await evaluate('__cwbWebGL.complete('+request.id+',null,'+!bytes+');true');}catch(error){if(!closed)await evaluate('__cwbWebGL.complete('+request.id+','+JSON.stringify(error.message)+');true').catch(()=>{});}finally{pending.delete(request.id);}}).catch(()=>{});
  };c.ws.addEventListener('message',listener);
  await evaluate(engine);await evaluate('('+initializeRenderer.toString()+')('+JSON.stringify(reader.project)+','+JSON.stringify({fps:entry.limits?.fps||24,maxWidth:entry.limits?.maxWidth||1280,scripts:entry.scripts===true,key:entry.workshopId||entry.id,controlToken})+','+JSON.stringify(binding)+')');
  const end=Date.now()+90000;let sample;
  while(Date.now()<end){sample=await evaluate('__cwbWebGL.sample()');if(sample.error)throw Error(sample.error);if(sample.ready&&sample.width>0)break;await sleep(200);}
  if(!sample?.ready||!sample.width)throw Error('WebWallGL 等待首帧超时');
  const player={id,reader,async sample(){return evaluate('__cwbWebGL.sample()');},async setSystemSpectrum(payload){const systemSpectrum={audioAvailable:payload.audioAvailable===true,bands:(payload.bands||[]).slice(0,64).map(n=>Math.max(0,Math.min(255,Number(n)||0)))};return c.evaluate('document.querySelector('+JSON.stringify('[data-cwb-renderer-id="'+id+'"]')+').shadowRoot.querySelector("iframe").contentWindow.postMessage('+JSON.stringify({token:controlToken,systemSpectrum})+',"*");true');},async signature(){const result=await c.call('Runtime.evaluate',{expression:'new Promise(resolve=>requestAnimationFrame(()=>resolve(document.querySelector("#wp canvas").toDataURL())))',awaitPromise:true,returnByValue:true,contextId},sessionId);return result.result?.value;},async pause(value){return evaluate('__cwbWebGL.pause('+!!value+');true');},async pointer(u,v,buttons=0){return evaluate('__cwbWebGL.instance.pushPointer('+u+','+v+','+buttons+');true');},dispose:cleanup};
  if(probe)return player;
  const palette=await evaluate('(()=>{try{const tiny=document.createElement("canvas");tiny.width=tiny.height=8;const ctx=tiny.getContext("2d");ctx.drawImage(document.querySelector("#wp canvas"),0,0,8,8);const d=ctx.getImageData(0,0,8,8).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}r/=64;g/=64;b/=64;const dark=.2126*r+.7152*g+.0722*b<145,t=v=>Math.round(dark?v*.18:220+v*.12);return {r:t(r),g:t(g),b:t(b),dark}}catch{return null}})()');
  await c.evaluate('('+adoptRenderer.toString()+')('+JSON.stringify({id,url:candidate.url,controlToken,palette:palette||config.palette,pauseOnBlur:!!config.pauseOnBlur,supportsAudio:reader.project.general?.supportsaudioprocessing!==false})+')');
  // cleanup must target the adopted layer after a successful swap.
  player.dispose=cleanup;
  return player;
 }catch(error){await cleanup();throw error;}
}

function adoptRenderer(info){
 const layer=document.getElementById(info.id),frame=layer.shadowRoot.querySelector('iframe');window.__codexWallpaperBridge?.dispose?.();document.getElementById('codex-wallpaper-bridge-layer')?.remove();layer.id='codex-wallpaper-bridge-layer';layer.style.opacity='1';
 const state=window.__codexWallpaperBridge={rendererId:info.id,ready:true,mode:'webwallgl',supportsAudio:info.supportsAudio,transport:'sandbox-webgl',palette:info.palette,pauseOnBlur:info.pauseOnBlur,receivedAt:Date.now(),detail:{}};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),send=message=>frame.contentWindow?.postMessage({token:info.controlToken,...message},'*');
 const visibility=()=>{state.paused=document.hidden||(state.pauseOnBlur&&!document.hasFocus())||reduced.matches;send({paused:state.paused});if(state.paused)send({systemSpectrum:{audioAvailable:false,bands:[]}});window.__cwbMediaActivity?.report();};
 const receive=event=>{if(event.source===frame.contentWindow&&event.data?.token===info.controlToken&&event.data.sample){state.detail=event.data.sample;state.error=state.detail.error;state.ready=state.detail.ready&&!state.error;state.receivedAt=Date.now();window.__cwbMediaActivity?.report();}};
 let pointerFrame=0,latest=null;
 const pointer=event=>{latest=[Math.max(0,Math.min(1,event.clientX/innerWidth)),Math.max(0,Math.min(1,event.clientY/innerHeight)),event.composedPath().some(n=>n?.matches?.('button,input,select,textarea,a,[role="button"],#codex-wallpaper-controls'))?0:event.buttons];if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;send({pointer:latest});});};
 addEventListener('message',receive);document.addEventListener('visibilitychange',visibility);addEventListener('focus',visibility);addEventListener('blur',visibility);reduced.addEventListener('change',visibility);document.addEventListener('pointermove',pointer,{passive:true});document.addEventListener('pointerdown',pointer,{passive:true});
 state.setPauseOnBlur=value=>{state.pauseOnBlur=!!value;visibility();};state.setVolume=value=>send({volume:value});state.setProperties=properties=>send({properties});state.setSystemMedia=systemMedia=>send({systemMedia});state.setSystemSpectrum=systemSpectrum=>send({systemSpectrum});state.setSystemPosition=systemPosition=>send({systemPosition});
 state.sample=()=>({...state.detail,ready:state.ready,error:state.error,mode:'webwallgl',transport:'sandbox-webgl',paused:state.paused,hidden:document.hidden,focused:document.hasFocus()});
 state.dispose=()=>{cancelAnimationFrame(pointerFrame);removeEventListener('message',receive);document.removeEventListener('visibilitychange',visibility);removeEventListener('focus',visibility);removeEventListener('blur',visibility);reduced.removeEventListener('change',visibility);document.removeEventListener('pointermove',pointer);document.removeEventListener('pointerdown',pointer);layer.__cwbCandidateDispose?.();layer.remove();URL.revokeObjectURL(info.url);};visibility();return true;
}
