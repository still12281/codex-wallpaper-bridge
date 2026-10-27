import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {installFrameFreeze} from './freeze-frame.mjs';
import {installWallpaperPointer} from './wallpaper-pointer.mjs';
import {effectivePropertyValues} from './wallpaper-properties.mjs';
import {createProjectReader} from './webwallgl-source.mjs';
import {installSceneResourceCache,callSceneResourceCache} from './scene-resource-cache.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Browser functions are serialized into a sandbox execution world, not the Codex world.
function initializeRenderer(project,options,binding,dshSource){
 // Scene loading rebuilds its live properties from project metadata. Seed the
 // in-memory project before asset/script preparation; MountOptions alone is reset.
 if(project.general?.properties)for(const [name,value]of Object.entries(options.properties||{}))if(Object.hasOwn(project.general.properties,name))project.general.properties[name]={...project.general.properties[name],value};
 const state=globalThis.__cwbWebGL={ready:false,paused:false,diagnostics:[],requests:new Map(),sequence:0};
 state.complete=(id,error,bytes)=>{const pending=state.requests.get(id);if(!pending)return;clearTimeout(pending.timer);state.requests.delete(id);error?pending.reject(Error(error)):pending.resolve(bytes||null);};
 const inFlight=new Map(),read=name=>{if(inFlight.has(name))return inFlight.get(name);const promise=new Promise((resolve,reject)=>{const id=++state.sequence,timer=setTimeout(()=>state.complete(id,'壁纸资源读取超时'),60000);state.requests.set(id,{resolve,reject,timer});globalThis[binding](JSON.stringify({id,name}));});inFlight.set(name,promise);promise.finally(()=>inFlight.delete(name)).catch(()=>{});return promise;};
 try{void globalThis.caches}catch{Object.defineProperty(globalThis,'caches',{value:undefined,configurable:true});}
 const zeros=new Float32Array(64),silentSource={snapshot:()=>({left:zeros,right:zeros})};state.audioResponseEnabled=options.audioResponse===true;
 const host=document.getElementById('wp'),instance=WebWallGL.createScene(host,{fit:'cover',fps:options.fps,renderDpr:options.renderDpr||Math.min(1,options.maxWidth/innerWidth),videoTexScale:options.videoTexScale??.5,autoQuality:false,volume:0,scripts:options.scripts===true,bake:false,media:null,quality:options.quality||{},properties:options.properties||{},audio:state.audioResponseEnabled?silentSource:null,
  onReady:()=>{state.ready=true;},onError:error=>{state.error=String(error?.message||error);},onDiagnostic:(message,level)=>{if(/跳过效果.*编译失败|effect shader.*(?:缺少|missing)|webglcontextlost/i.test(String(message)))state.error='场景关键效果失败：'+String(message).slice(0,1800);state.diagnostics.push({message:String(message).slice(0,240),level});state.diagnostics=state.diagnostics.slice(-20);}});
 state.instance=instance;let freeze;
 const getFreeze=()=>freeze||(freeze=globalThis.__cwbFrameFreeze(host.querySelector('canvas'),host));
 const source={key:options.key,project:async()=>project,sceneDir:async()=>{if(!/\.json$/i.test(project.file||''))return null;return await read(project.file)?{entry:project.file,read}:null;},scenePkg:async()=>{for(const name of [...(/\.pkg$/i.test(project.file||'')?[project.file]:[]),'scene.pkg','scenes/scene.pkg','gifscene.pkg']){const bytes=await read(name);if(bytes)return bytes;}throw Error('项目没有可读取的场景包');}};
 host.addEventListener('webglcontextlost',()=>{state.error='壁纸图形上下文丢失，已停止采用此场景';},true);
 state.sample=()=>{const canvas=host.querySelector('canvas');return {ready:state.ready,error:state.error,paused:state.paused,width:canvas?.width||0,height:canvas?.height||0,backend:'dsh-v1.4.0',configuredFps:state.configuredFps||options.fps,videoTexScale:instance.getVideoTexScale?.(),qualityEffective:instance.getQuality?.(),audioResponseEnabled:state.audioResponseEnabled,systemAudioActive:!!state.externalAudio,spectrumUpdates:state.spectrumUpdates||0,lastSpectrumAt:state.lastSpectrumAt||0,stats:{...instance.stats},diagnostics:state.diagnostics};};
 state.pause=value=>{state.paused=!!value;if(value){getFreeze().hold();instance.pause();}else{instance.resume();freeze?.release();}};
 // DSH's renderer control plane uses the already configured scene and our
 // project capability instead of a network httpSource. Its source is vendored
 // unchanged; import.meta is only used for its fallback URL, rejected here.
 const engine=globalThis.WebWallGL;
 try{globalThis.WebWallGL={...engine,createScene:()=>instance,httpSource:()=>source};Function('URLSearchParams',dshSource.replaceAll('import.meta.url',JSON.stringify('about:blank')))(class extends URLSearchParams{constructor(){super('type=scene&src=project&mediaBase=cwb');}});}finally{globalThis.WebWallGL=engine;}
 const bands=new Float32Array(64),spectrumFrame={left:bands,right:bands};
 if(state.audioResponseEnabled)window.__wp.setAudioBridge(()=>spectrumFrame);
 const syncSpectrum=payload=>{if(!state.audioResponseEnabled)return;state.externalAudio=payload.audioAvailable===true;bands.fill(0);if(state.externalAudio){for(let i=0;i<64;i++)bands[i]=(payload.bands[i]||0)/255;state.spectrumUpdates=(state.spectrumUpdates||0)+1;state.lastSpectrumAt=Date.now();}};
 const control=event=>{const message=event.data;if(event.source!==parent||message?.token!==options.controlToken)return;if(message.resource){state.complete(message.resource.id,null,message.resource.bytes);return;}if(typeof message.paused==='boolean')state.pause(message.paused);if(message.pointer)instance.pushPointer(...message.pointer);if(message.pointerLeave)instance.pointerLeave();if(message.wheel)instance.pushWheel(...message.wheel);if(Number.isFinite(message.volume))instance.setVolume(message.volume);if(message.properties)instance.setProperties(message.properties);if(message.systemMedia){state.mediaPayload=message.systemMedia;if(!state.mediaSource){state.mediaSource=WebWallGL.createMediaSource(message.systemMedia);instance.setMedia(state.mediaSource);}else state.mediaSource.set(message.systemMedia);}if(message.systemPosition)state.mediaSource?.set(message.systemPosition);if(message.systemSpectrum)syncSpectrum(message.systemSpectrum);};
 addEventListener('message',control);const report=setInterval(()=>parent.postMessage({token:options.controlToken,sample:state.sample()},'*'),1000);
 state.dispose=()=>{freeze?.dispose();clearInterval(report);removeEventListener('message',control);instance.destroy({releasePkgCache:true});for(const request of state.requests.values()){clearTimeout(request.timer);request.reject(Error('Renderer disposed'));}state.requests.clear();};
 return true;
}

function createCandidate(id,limits){
 const layer=document.createElement('div');layer.id=id;layer.setAttribute('aria-hidden','true');layer.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0';
 layer.dataset.cwbRendererId=id;
 const shadow=layer.attachShadow({mode:'open'}),frame=document.createElement('iframe');frame.title='壁纸渲染';frame.tabIndex=-1;frame.setAttribute('sandbox','allow-scripts');frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none';
 const url=URL.createObjectURL(new Blob(['<!doctype html><meta charset="utf-8"><style>html,body,#wp{margin:0;width:100%;height:100%;overflow:hidden;background:#151923}canvas{display:block}</style><div id="wp"></div>'],{type:'text/html'}));frame.src=url;shadow.append(frame);document.body.prepend(layer);
 const resize=()=>{if(limits.exactResolution){const width=limits.maxWidth/2,height=limits.maxHeight/2,scale=Math.max(innerWidth/width,innerHeight/height);frame.style.width=width+'px';frame.style.height=height+'px';frame.style.left=(innerWidth-width*scale)/2+'px';frame.style.top=(innerHeight-height*scale)/2+'px';frame.style.transformOrigin='top left';frame.style.transform='scale('+scale+')';return;}const scale=Math.min(1,(limits.maxWidth||1280)/innerWidth,(limits.maxHeight||900)/innerHeight),width=Math.max(1,Math.floor(innerWidth*scale)),height=Math.max(1,Math.floor(innerHeight*scale));frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transformOrigin='top left';frame.style.transform='scale('+1/scale+')';};resize();const observer=new ResizeObserver(resize);observer.observe(layer);layer.__cwbCandidateDispose=()=>observer.disconnect();return {url};
}

export async function mountWebWallGL(c,entry,{dataRoot,config,probe=false,isCurrent=()=>true,selectionStamp}){
 let adopted=false;const assertCurrent=()=>{if(!adopted&&!isCurrent())throw Object.assign(Error('已跳过先前的选择'),{code:'CWB_SELECTION_SUPERSEDED'});};assertCurrent();
 const reader=await createProjectReader(entry.projectRoot);const properties=effectivePropertyValues(reader.project,entry.userProperties||{});
 await c.evaluate('window.__cwbInstallWallpaperPointer='+installWallpaperPointer.toString()+';true');
 await c.evaluate('('+installSceneResourceCache.toString()+')();true');
 if(reader.project.type==='web')throw Error('当前沙箱资源通道尚未通过网页脚本验收，请选择原生实时模式');
 const enginePath=process.env.CODEX_WALLPAPER_WEBWALLGL||path.join(dataRoot,'engines','webwallgl-3.0.0','webwallgl.global.min.js');
 let engine;try{engine=await readFile(enginePath,'utf8');}catch{throw Error('WebWallGL 未准备，请先运行 npm run prepare:webwallgl');}
 const dshSource=await readFile(new URL('../vendor/dsh-wallpaper/renderer.js',import.meta.url),'utf8');
 const id='cwb-webgl-'+randomUUID(),binding='cwbAsset'+randomUUID().replaceAll('-',''),controlToken=randomUUID(),candidate=await c.evaluate('('+createCandidate.toString()+')('+JSON.stringify(id)+','+JSON.stringify(entry.limits||{})+')');
 let contextId,sessionId,closed=false,listener,transferQueue=Promise.resolve();const pending=new Set();
 const evaluate=expression=>c.evaluate(expression,contextId,sessionId);
 const cacheCall=(method,args)=>callSceneResourceCache(c,method,args,{isCurrent:()=>adopted||isCurrent()});
 const cleanup=async()=>{if(closed)return;closed=true;if(listener)c.ws.removeEventListener('message',listener);for(const requestId of pending)await c.evaluate('window.__cwbSceneResources?.abort('+JSON.stringify(binding+'-'+requestId)+');true').catch(()=>{});const connected=await c.evaluate('!!document.querySelector('+JSON.stringify('[data-cwb-renderer-id="'+id+'"]')+')').catch(()=>false);if(connected)await c.call('Runtime.evaluate',{expression:'globalThis.__cwbWebGL?.dispose();true',contextId,returnByValue:true},sessionId,1000).catch(()=>{});if(sessionId)await c.call('Target.detachFromTarget',{sessionId},undefined,1000).catch(()=>{});await c.evaluate('(()=>{const s=window.__codexWallpaperBridge;if(s?.rendererId==='+JSON.stringify(id)+'){s.dispose?.();delete window.__codexWallpaperBridge}const layer=document.querySelector('+JSON.stringify('[data-cwb-renderer-id="'+id+'"]')+');layer?.__cwbCandidateDispose?.();layer?.remove();URL.revokeObjectURL('+JSON.stringify(candidate.url)+');return true})()').catch(()=>{});};
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
   transferQueue=transferQueue.then(async()=>{let bytes;const handle=binding+'-'+request.id;try{
    if(closed)return;assertCurrent();const metadata=await reader.metadata(request.name);if(!metadata){await evaluate('__cwbWebGL.complete('+request.id+',null,null);true');return;}
    const key=createHash('sha256').update(JSON.stringify([reader.root,request.name,metadata.etag])).digest('hex'),info={rendererId:id,token:controlToken,id:request.id};
    if(await cacheCall('cached',[key,metadata.size,info]))return;
    if(closed)return;bytes=await reader.read(request.name);if(closed)return;if(!bytes||bytes.length!==metadata.size||(await reader.metadata(request.name))?.etag!==metadata.etag)throw Error('壁纸资源在加载时改变，请重试');
    await c.evaluate('window.__cwbSceneResources.begin('+JSON.stringify(handle)+','+JSON.stringify(key)+','+bytes.length+');true');
    for(let offset=0;offset<bytes.length;offset+=4*1024*1024){if(closed)return;assertCurrent();await c.evaluate('window.__cwbSceneResources.receive('+JSON.stringify(handle)+','+JSON.stringify(bytes.subarray(offset,offset+4*1024*1024).toString('base64'))+','+offset+');true');}
    if(!closed)await cacheCall('complete',[handle,info]);
   }catch(error){await c.evaluate('window.__cwbSceneResources?.abort('+JSON.stringify(handle)+');true').catch(()=>{});if(!closed)await evaluate('__cwbWebGL.complete('+request.id+','+JSON.stringify(error.message)+');true').catch(()=>{});}finally{bytes=null;pending.delete(request.id);if(!pending.size)setImmediate(()=>global.gc?.());}}).catch(()=>{});
  };c.ws.addEventListener('message',listener);
  await evaluate(engine);await evaluate('globalThis.__cwbFrameFreeze='+installFrameFreeze.toString()+';true');await evaluate('('+initializeRenderer.toString()+')('+JSON.stringify(reader.project)+','+JSON.stringify({fps:entry.limits?.fps||24,maxWidth:entry.limits?.maxWidth||1280,renderDpr:entry.limits?.exactResolution?2:undefined,scripts:entry.scripts===true,quality:entry.quality,properties,videoTexScale:entry.videoTexScale,audioResponse:config.systemMedia?.audio===true,key:entry.workshopId||entry.id,controlToken})+','+JSON.stringify(binding)+','+JSON.stringify(dshSource)+')');
  const end=Date.now()+90000;let sample;
  while(Date.now()<end){assertCurrent();sample=await evaluate('__cwbWebGL.sample()');if(sample.error)throw Error(sample.error);if(sample.ready&&sample.width>0)break;await sleep(200);}
  if(!sample?.ready||!sample.width)throw Error('WebWallGL 等待首帧超时');
 const player={id,entryId:entry.id,reader,async assetStats(){return c.evaluate('({...window.__cwbSceneResources.stats})');},async sample(){return evaluate('__cwbWebGL.sample()');},async graphics(){return evaluate('(()=>{const canvas=document.querySelector("#wp canvas"),gl=canvas.getContext("webgl2")||canvas.getContext("webgl"),ext=gl?.getExtension("WEBGL_debug_renderer_info");return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,lost:gl?.isContextLost()}})()');},async setSystemSpectrum(payload){const systemSpectrum={audioAvailable:payload.audioAvailable===true,bands:(payload.bands||[]).slice(0,64).map(n=>Math.max(0,Math.min(255,Number(n)||0)))};return c.evaluate('document.querySelector('+JSON.stringify('[data-cwb-renderer-id="'+id+'"]')+').shadowRoot.querySelector("iframe").contentWindow.postMessage('+JSON.stringify({token:controlToken,systemSpectrum})+',"*");true');},async signature(){const result=await c.call('Runtime.evaluate',{expression:'new Promise(resolve=>requestAnimationFrame(()=>resolve(document.querySelector("#wp canvas").toDataURL())))',awaitPromise:true,returnByValue:true,contextId},sessionId);return result.result?.value;},async pause(value){return evaluate('__cwbWebGL.pause('+!!value+');true');},async setProperties(values){return evaluate('__cwbWebGL.instance.setProperties('+JSON.stringify(values)+');JSON.parse(JSON.stringify(__cwbWebGL.instance.getProperties()))');},async getProperties(){return evaluate('__cwbWebGL.instance.getProperties()');},async setFps(fps){return evaluate('__cwbWebGL.instance.setFps('+Number(fps)+');__cwbWebGL.configuredFps='+Number(fps)+';true');},async pointer(u,v,buttons=0){return evaluate('__cwbWebGL.instance.pushPointer('+u+','+v+','+buttons+');true');},dispose:cleanup};
  if(probe)return player;
  const palette=await evaluate('(()=>{try{const tiny=document.createElement("canvas");tiny.width=tiny.height=8;const ctx=tiny.getContext("2d");ctx.drawImage(document.querySelector("#wp canvas"),0,0,8,8);const d=ctx.getImageData(0,0,8,8).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}r/=64;g/=64;b/=64;const dark=.2126*r+.7152*g+.0722*b<145,t=v=>Math.round(dark?v*.18:220+v*.12);return {r:t(r),g:t(g),b:t(b),dark}}catch{return null}})()');
  assertCurrent();const accepted=await c.evaluate('('+adoptRenderer.toString()+')('+JSON.stringify({selectionStamp,entryId:entry.id,id,url:candidate.url,controlToken,palette:palette||config.palette,fps:entry.limits?.fps||24,type:reader.project.type,pauseOnBlur:!!config.pauseOnBlur,supportsAudio:reader.project.general?.supportsaudioprocessing!==false})+')');
  if(!accepted)throw Object.assign(Error('已跳过先前的选择'),{code:'CWB_SELECTION_SUPERSEDED'});adopted=true;
  // cleanup must target the adopted layer after a successful swap.
  player.dispose=cleanup;
  return player;
 }catch(error){await cleanup();throw error;}
}

function adoptRenderer(info){
 if(info.selectionStamp&&(window.__cwbSelectionStamp!==info.selectionStamp||window.__cwbDesiredWallpaperId!==info.entryId))return false;
 const layer=document.getElementById(info.id),frame=layer.shadowRoot.querySelector('iframe');window.__codexWallpaperBridge?.dispose?.();document.getElementById('codex-wallpaper-bridge-layer')?.remove();layer.id='codex-wallpaper-bridge-layer';layer.style.opacity='1';
 const state=window.__codexWallpaperBridge={rendererId:info.id,ready:true,mode:'webwallgl',supportsAudio:info.supportsAudio,transport:'sandbox-webgl',palette:info.palette,pauseOnBlur:info.pauseOnBlur,receivedAt:Date.now(),detail:{}};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),send=message=>frame.contentWindow?.postMessage({token:info.controlToken,...message},'*');
 let manualPause=null;
 const visibility=()=>{state.paused=manualPause===null?(document.hidden||(state.pauseOnBlur&&!document.hasFocus())||reduced.matches):manualPause;send({paused:state.paused});if(state.paused)send({systemSpectrum:{audioAvailable:false,bands:[]}});window.__cwbMediaActivity?.report();};
 state.pause=value=>{manualPause=typeof value==='boolean'?value:null;visibility();};
 const receive=event=>{if(event.source===frame.contentWindow&&event.data?.token===info.controlToken&&event.data.sample){state.detail=event.data.sample;state.error=state.detail.error;state.ready=state.detail.ready&&!state.error;state.receivedAt=Date.now();window.__cwbMediaActivity?.report();}};
 const disposePointer=window.__cwbInstallWallpaperPointer(send,{fps:info.fps,type:info.type});
 addEventListener('message',receive);document.addEventListener('visibilitychange',visibility);addEventListener('focus',visibility);addEventListener('blur',visibility);reduced.addEventListener('change',visibility);
 state.setPauseOnBlur=value=>{state.pauseOnBlur=!!value;visibility();};state.setVolume=value=>send({volume:value});state.setProperties=properties=>send({properties});state.setSystemMedia=systemMedia=>send({systemMedia});state.setSystemSpectrum=systemSpectrum=>send({systemSpectrum});state.setSystemPosition=systemPosition=>send({systemPosition});
 state.sample=()=>({...state.detail,ready:state.ready,error:state.error,mode:'webwallgl',transport:'sandbox-webgl',paused:state.paused,hidden:document.hidden,focused:document.hasFocus()});
 state.dispose=()=>{disposePointer();removeEventListener('message',receive);document.removeEventListener('visibilitychange',visibility);removeEventListener('focus',visibility);removeEventListener('blur',visibility);reduced.removeEventListener('change',visibility);layer.__cwbCandidateDispose?.();layer.remove();URL.revokeObjectURL(info.url);};visibility();return true;
}
