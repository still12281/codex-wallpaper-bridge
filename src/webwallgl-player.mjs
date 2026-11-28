import {wallpaperRenderKey} from './library-model.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {installFrameFreeze} from './freeze-frame.mjs';
import {installWallpaperPointer} from './wallpaper-pointer.mjs';
import {effectivePropertyValues} from './wallpaper-properties.mjs';
import {codexRuntimeSource} from './webwallgl-runtime.mjs';
import {createProjectReader} from './webwallgl-source.mjs';
import {installSceneResourceCache,callSceneResourceCache} from './scene-resource-cache.mjs';
import {transferSceneResource} from './scene-resource-transfer.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Browser functions are serialized into a sandbox execution world, not the Codex world.
function initializeRenderer(project,options,binding,dshSource){
 // Scene loading rebuilds its live properties from project metadata. Seed the
 // in-memory project before asset/script preparation; MountOptions alone is reset.
 if(project.general?.properties)for(const [name,value]of Object.entries(options.properties||{}))if(Object.hasOwn(project.general.properties,name))project.general.properties[name]={...project.general.properties[name],value};
 const state=globalThis.__cwbWebGL={ready:false,paused:false,diagnostics:[],requests:new Map(),sequence:0};
 if(options.fontAdapterExpected&&!options.fontBuffers)state.diagnostics.push({message:'当前引擎未匹配字体字节适配；内嵌字体可能受宿主限制',level:'warn'});state.complete=(id,error,bytes)=>{const pending=state.requests.get(id);if(!pending)return;clearTimeout(pending.timer);state.requests.delete(id);error?pending.reject(Error(error)):pending.resolve(bytes||null);};
 const inFlight=new Map(),read=name=>{if(inFlight.has(name))return inFlight.get(name);const promise=new Promise((resolve,reject)=>{const id=++state.sequence,timer=setTimeout(()=>state.complete(id,'壁纸资源读取超时'),60000);state.requests.set(id,{resolve,reject,timer,name});globalThis[binding](JSON.stringify({id,name}));});inFlight.set(name,promise);promise.finally(()=>inFlight.delete(name)).catch(()=>{});return promise;};
 try{void globalThis.caches}catch{Object.defineProperty(globalThis,'caches',{value:undefined,configurable:true});}
 const zeros=new Float32Array(64),silentSource={snapshot:()=>({left:zeros,right:zeros})};state.audioResponseEnabled=options.audioResponse===true;
 const host=document.getElementById('wp'),instance=WebWallGL.createScene(host,{fit:'cover',fps:options.fps,renderDpr:options.renderDpr||Math.min(1,options.maxWidth/innerWidth),videoTexScale:options.videoTexScale??.5,autoQuality:false,volume:0,scripts:options.scripts===true,bake:false,media:null,quality:options.quality||{},properties:options.properties||{},audio:state.audioResponseEnabled?silentSource:null,
  onReady:()=>{state.ready=true;globalThis[binding](JSON.stringify({status:'renderer-ready'}));},onError:error=>{state.error=String(error?.message||error);},onDiagnostic:(message,level)=>{if(/跳过效果.*编译失败|effect shader.*(?:缺少|missing)|webglcontextlost/i.test(String(message)))state.error='场景关键效果失败：'+String(message).slice(0,1800);state.diagnostics.push({message:String(message).slice(0,240),level});state.diagnostics=state.diagnostics.slice(-20);}});
 state.instance=instance;let freeze,drawWaiter;
 const getFreeze=()=>freeze||(freeze=globalThis.__cwbFrameFreeze(host.querySelector('canvas'),host));
 if(options.frameReady)globalThis.__cwbDidDraw=canvas=>{if(!state.paused&&canvas===host.querySelector('canvas'))drawWaiter?.();};
 if(options.frameReady)globalThis.__cwbFreshDrawPending=canvas=>!!drawWaiter&&canvas===host.querySelector('canvas');
 const nextFrame=done=>{if(options.frameReady){drawWaiter=()=>{drawWaiter=null;done();};return ()=>{drawWaiter=null;};}const id=requestAnimationFrame(()=>done());return ()=>cancelAnimationFrame(id);};
 const source={key:options.key,project:async()=>project,sceneDir:async()=>{if(!/\.json$/i.test(project.file||''))return null;return await read(project.file)?{entry:project.file,read}:null;},scenePkg:async()=>{for(const name of [...(/\.pkg$/i.test(project.file||'')?[project.file]:[]),'scene.pkg','scenes/scene.pkg','gifscene.pkg']){const bytes=await read(name);if(bytes)return bytes;}throw Error('项目没有可读取的场景包');}};
 host.addEventListener('webglcontextlost',()=>{state.error='壁纸图形上下文丢失，已停止采用此场景';},true);
 state.sample=()=>{const canvas=host.querySelector('canvas');return {ready:state.ready,error:state.error,paused:state.paused,frozen:!!freeze?.held,frameReadyHook:options.frameReady,width:canvas?.width||0,height:canvas?.height||0,backend:'dsh-v1.4.0',configuredFps:state.configuredFps||options.fps,fontBufferAdapter:options.fontBuffers===true,fontAdapterExpected:options.fontAdapterExpected,fontsLoaded:[...document.fonts].filter(f=>f.family.startsWith('wefont_')&&f.status==='loaded').length,videoTexScale:instance.getVideoTexScale?.(),qualityEffective:instance.getQuality?.(),audioResponseEnabled:state.audioResponseEnabled,systemAudioActive:!!state.externalAudio,spectrumUpdates:state.spectrumUpdates||0,lastSpectrumAt:state.lastSpectrumAt||0,spectrumAudit:state.spectrumAudit,stats:{...instance.stats},diagnostics:state.diagnostics};};
 state.pause=value=>{const paused=!!value;if(state.paused===paused)return;state.paused=paused;if(paused){getFreeze().hold();instance.pause();}else{freeze?.release(nextFrame);instance.resume();}};
 // DSH's renderer control plane uses the already configured scene and our
 // project capability instead of a network httpSource. Its source is vendored
 // unchanged; import.meta is only used for its fallback URL, rejected here.
 const engine=globalThis.WebWallGL;
 try{globalThis.WebWallGL={...engine,createScene:()=>instance,httpSource:()=>source};Function('URLSearchParams',dshSource.replaceAll('import.meta.url',JSON.stringify('about:blank')))(class extends URLSearchParams{constructor(){super('type=scene&src=project&mediaBase=cwb');}});}finally{globalThis.WebWallGL=engine;}
 const left=new Float32Array(64),right=new Float32Array(64),spectrumFrame={left,right,normalized:false};
 const raw=new Float32Array(128),response=new Float32Array(128),gain=new Float32Array(16),groups=new Float32Array(16);
 let lastDraw=0, lastArrival=0;
 const audit=()=>state.spectrumAudit??={frames:0,generation:0,sampleEnd:0,gaps:0,duplicates:0};
 const resetSpectrum=()=>{
  raw.fill(0);response.fill(0);gain.fill(0);left.fill(0);right.fill(0);
  lastDraw=0;lastArrival=0;
 };
 const snapshotSpectrum=()=>{
  if(!spectrumFrame.normalized)return spectrumFrame;
  const now=performance.now(),dt=lastDraw?Math.min(.25,Math.max(.0001,(now-lastDraw)/1000)):1/options.fps;
  lastDraw=now;
  let overall=0;
  for(let group=0;group<16;group++){
   let peak=0;
   for(let index=group*8;index<group*8+8;index++)peak=Math.max(peak,raw[index]);
   groups[group]=peak;overall=Math.max(overall,peak);
  }
  if(overall<.0001||now-lastArrival>400){
   left.fill(0);right.fill(0);
   return spectrumFrame;
  }
  if(gain[0]<.0001)gain.fill(1);
  const alpha=Math.min(20*dt,1),slew=Math.min(40*dt,1);
  for(let group=0;group<16;group++){
   const peak=Math.max(groups[group],overall/3),difference=peak-gain[group];
   gain[group]+=Math.max(-dt/2,Math.min(dt,difference));
   const divisor=Math.max(gain[group],.001);
   for(let index=group*8;index<group*8+8;index++){
    response[index]+=(raw[index]/divisor-response[index])*alpha;
    const output=index<64?left:right,position=index%64;
    output[position]+=Math.max(-slew,Math.min(slew,response[index]-output[position]));
   }
  }
  return spectrumFrame;
 };
 if(state.audioResponseEnabled)window.__wp.setAudioBridge(snapshotSpectrum);
 const syncOne=payload=>{
  if(payload.audioAvailable!==true){
   state.externalAudio=false;
   resetSpectrum();
   return;
  }
  if(Array.isArray(payload.left)&&Array.isArray(payload.right)){
   const stats=audit();
   if(stats.generation!==payload.generation){
    resetSpectrum();
    Object.assign(stats,{generation:payload.generation,frames:0,sampleEnd:0,gaps:0,duplicates:0,gapMaxMs:0,
      firstAt:performance.now(),lastAt:0,sampleRate:payload.sampleRate,targetRate:payload.targetRate});
   }
   if(payload.sampleEnd<=stats.sampleEnd){stats.duplicates++;return;}
   if(stats.sampleEnd){
    stats.gaps+=Math.max(0,Math.round((payload.sampleEnd-stats.sampleEnd)*payload.targetRate/payload.sampleRate)-1);
    stats.gapMaxMs=Math.max(stats.gapMaxMs,performance.now()-stats.lastAt);
   }
   stats.frames++;stats.sampleEnd=payload.sampleEnd;stats.lastAt=performance.now();
   raw.set(payload.left,0);raw.set(payload.right,64);
   lastArrival=stats.lastAt;
   spectrumFrame.normalized=options.nativeAudio===true;
   if(!spectrumFrame.normalized){left.set(payload.left);right.set(payload.right);}
  }else{
   spectrumFrame.normalized=false;
   for(let i=0;i<64;i++)left[i]=right[i]=(payload.bands[i]||0)/255;
  }
  state.externalAudio=true;
  state.spectrumUpdates=(state.spectrumUpdates||0)+1;
  state.lastSpectrumAt=Date.now();
 };
 const syncSpectrum=payload=>{
  if(!state.audioResponseEnabled)return;
  if(Array.isArray(payload.frames)){for(const frame of payload.frames)syncOne(frame);}
  else syncOne(payload);
 };
 const control=event=>{const message=event.data;if(event.source!==parent||message?.token!==options.controlToken)return;if(message.resource){state.complete(message.resource.id,null,message.resource.bytes);return;}if(typeof message.paused==='boolean')state.pause(message.paused);if(message.pointer)instance.pushPointer(...message.pointer);if(message.pointerLeave)instance.pointerLeave();if(message.wheel)instance.pushWheel(...message.wheel);if(Number.isFinite(message.volume))instance.setVolume(message.volume);if(message.properties)instance.setProperties(message.properties);if(message.systemMedia){state.mediaPayload=message.systemMedia;if(!state.mediaSource){state.mediaSource=WebWallGL.createMediaSource(message.systemMedia);instance.setMedia(state.mediaSource);}else state.mediaSource.set(message.systemMedia);}if(message.systemPosition)state.mediaSource?.set(message.systemPosition);if(message.systemSpectrum)syncSpectrum(message.systemSpectrum);};
 addEventListener('message',control);const report=setInterval(()=>parent.postMessage({token:options.controlToken,sample:state.sample()},'*'),1000);
 state.dispose=()=>{freeze?.dispose();delete globalThis.__cwbDidDraw;delete globalThis.__cwbFreshDrawPending;clearInterval(report);removeEventListener('message',control);instance.destroy({releasePkgCache:true});for(const request of state.requests.values()){clearTimeout(request.timer);request.reject(Error('Renderer disposed'));}state.requests.clear();};
 return true;
}

function createCandidate(id,limits){
 const layer=document.createElement('div');layer.id=id;layer.setAttribute('aria-hidden','true');layer.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0';
 layer.dataset.cwbRendererId=id;
 const shadow=layer.attachShadow({mode:'open'}),frame=document.createElement('iframe');frame.title='壁纸渲染';frame.tabIndex=-1;frame.setAttribute('sandbox','allow-scripts');frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none';
 const url=URL.createObjectURL(new Blob(['<!doctype html><meta charset="utf-8"><style>html,body,#wp{margin:0;width:100%;height:100%;overflow:hidden;background:#151923}canvas{display:block}</style><div id="wp"></div>'],{type:'text/html'}));frame.src=url;shadow.append(frame);document.body.prepend(layer);
 const resize=()=>{if(limits.exactResolution){const width=limits.maxWidth/2,height=limits.maxHeight/2,scale=Math.max(innerWidth/width,innerHeight/height);frame.style.width=width+'px';frame.style.height=height+'px';frame.style.left=(innerWidth-width*scale)/2+'px';frame.style.top=(innerHeight-height*scale)/2+'px';frame.style.transformOrigin='top left';frame.style.transform='scale('+scale+')';return;}const scale=Math.min(1,(limits.maxWidth||1280)/innerWidth,(limits.maxHeight||900)/innerHeight),width=Math.max(1,Math.floor(innerWidth*scale)),height=Math.max(1,Math.floor(innerHeight*scale));frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transformOrigin='top left';frame.style.transform='scale('+1/scale+')';};resize();const observer=new ResizeObserver(resize);observer.observe(layer);layer.__cwbCandidateDispose=()=>observer.disconnect();return {url};
}

export function summarizeFrameNavigationFailure({dom,frameTree,targetInfos,candidateUrl}){
 const countFrames=node=>node?(node.childFrames||[]).reduce((sum,child)=>sum+1+countFrames(child),0):0;
 const countMatchedFrames=node=>node?(node.frame?.url===candidateUrl?1:0)+(node.childFrames||[]).reduce((sum,child)=>sum+countMatchedFrames(child),0):0;
 const iframeTargets=(targetInfos||[]).filter(t=>t?.type==='iframe');
 return {reason:'wallpaper-frame-not-navigated',readyState:dom?.ready||null,layerFound:!!dom?.layer,framePresent:!!dom?.framePresent,frameMatchesCandidate:!!dom?.frameMatchesCandidate,frameTreeChildCount:countFrames(frameTree),frameTreeMatches:countMatchedFrames(frameTree),iframeTargetCount:iframeTargets.length,iframeTargetMatches:iframeTargets.filter(t=>t.url===candidateUrl).length};
}

export async function mountWebWallGL(c,entry,{dataRoot,config,probe=false,isCurrent=()=>true,selectionStamp,reconnect=false,reuse=null}){
 const started=performance.now(),startup={stages:{},resources:{requests:0,cacheHits:0,queueMs:0,transferMs:0}};
 const mark=stage=>{startup.stages[stage]=performance.now()-started;};
 let adopted=false;const assertCurrent=()=>{if(!adopted&&!isCurrent())throw Object.assign(Error('已跳过先前的选择'),{code:'CWB_SELECTION_SUPERSEDED'});};assertCurrent();
 const key=createHash('sha256').update(wallpaperRenderKey(entry,config.systemMedia?.audio===true)).digest('hex');
 if(reconnect){
  const current=await c.evaluate('(()=>{const s=window.__codexWallpaperBridge,l=document.getElementById("codex-wallpaper-bridge-layer");return s?.ready&&!s.error&&s.reuse?.key==='+JSON.stringify(key)+'&&s.rendererId===l?.dataset.cwbRendererId&&s.reuse.url===l.shadowRoot?.firstElementChild?.src?s.reuse:null})()');
  if(current&&/^cwb-webgl-[a-f0-9-]{36}$/.test(current.id)&&/^cwbAsset[a-f0-9]{32}$/.test(current.binding)&&/^[a-f0-9-]{36}$/.test(current.controlToken)){
   const player=await mountWebWallGL(c,entry,{dataRoot,config,isCurrent,selectionStamp,reuse:current}).catch(error=>{if(error.code==='CWB_SELECTION_SUPERSEDED')throw error;return null;});
   if(player)return player;
  }
  if(await c.evaluate('document.hidden'))return null;
 }
 const reader=await createProjectReader(entry.projectRoot);const properties=effectivePropertyValues(reader.project,entry.userProperties||{});
 if(reader.project.type==='web')throw Error('当前沙箱资源通道尚未通过网页脚本验收，请选择原生实时模式');
 const enginePath=process.env.CODEX_WALLPAPER_WEBWALLGL||path.join(dataRoot,'engines','webwallgl-3.0.0','webwallgl.global.min.js');
 const engineRead=()=>readFile(enginePath,'utf8').catch(()=>{throw Error('WebWallGL 未准备，请先运行 npm run prepare:webwallgl');});
 let engine,dshSource;
 if(!reuse){
  await c.evaluate('window.__cwbInstallWallpaperPointer='+installWallpaperPointer.toString()+';('+installSceneResourceCache.toString()+')();true');
  [engine,dshSource]=await Promise.all([engineRead(),readFile(new URL('../vendor/dsh-wallpaper/renderer.js',import.meta.url),'utf8')]);mark('sourcePrepared');
 }
 const id=reuse?.id||'cwb-webgl-'+randomUUID(),binding=reuse?.binding||'cwbAsset'+randomUUID().replaceAll('-',''),controlToken=reuse?.controlToken||randomUUID();
 const candidate=reuse||await c.evaluate('('+createCandidate.toString()+')('+JSON.stringify(id)+','+JSON.stringify(entry.limits||{})+')');
 let contextId,sessionId,closed=false,listener,transferQueue=Promise.resolve(),readyNotice=false,readyWaiter;const pending=new Set();
 const noticeReady=()=>{readyNotice=true;readyWaiter?.();};
 const waitForReady=async()=>{if(readyNotice){readyNotice=false;return;}await new Promise(resolve=>{const done=()=>{clearTimeout(timer);readyWaiter=null;readyNotice=false;resolve();},timer=setTimeout(done,200);readyWaiter=done;});};
 const evaluate=expression=>c.evaluate(expression,contextId,sessionId);
 const cacheCall=(method,args)=>callSceneResourceCache(c,method,args,{isCurrent:()=>adopted||isCurrent()});
 const cleanup=async()=>{if(closed)return;closed=true;if(listener)c.ws.removeEventListener('message',listener);if(reuse&&!adopted){if(sessionId)await c.call('Target.detachFromTarget',{sessionId},undefined,1000).catch(()=>{});return;}for(const requestId of pending)await c.evaluate('window.__cwbSceneResources?.abort('+JSON.stringify(binding+'-'+requestId)+');true').catch(()=>{});const connected=await c.evaluate('!!document.querySelector('+JSON.stringify('[data-cwb-renderer-id="'+id+'"]')+')').catch(()=>false);if(connected)await c.call('Runtime.evaluate',{expression:'globalThis.__cwbWebGL?.dispose();true',contextId,returnByValue:true},sessionId,1000).catch(()=>{});if(sessionId)await c.call('Target.detachFromTarget',{sessionId},undefined,1000).catch(()=>{});await c.evaluate('(()=>{const s=window.__codexWallpaperBridge;if(s?.rendererId==='+JSON.stringify(id)+'){s.dispose?.();delete window.__codexWallpaperBridge}const layer=document.querySelector('+JSON.stringify('[data-cwb-renderer-id="'+id+'"]')+');layer?.__cwbCandidateDispose?.();layer?.remove();URL.revokeObjectURL('+JSON.stringify(candidate.url)+');return true})()').catch(()=>{});};
 try{
  let frame;
  for(let i=0;i<(reuse?1:40);i++){
   const tree=await c.call('Page.getFrameTree');const find=node=>node.frame.url===candidate.url?node.frame:(node.childFrames||[]).map(find).find(Boolean);frame=find(tree.frameTree);
   if(!frame){const {targetInfos}=await c.call('Target.getTargets');const child=targetInfos.find(t=>t.type==='iframe'&&t.url===candidate.url);if(child){({sessionId}=await c.call('Target.attachToTarget',{targetId:child.targetId,flatten:true}));frame=(await c.call('Page.getFrameTree',{},sessionId)).frameTree.frame;}}
   if(frame)break;await sleep(100);
  }
  if(!frame){const tree=await c.call('Page.getFrameTree'),inventory=(await c.call('Target.getTargets')).targetInfos,dom=await c.evaluate('(()=>{const layer=document.getElementById('+JSON.stringify(id)+');const frame=layer?.shadowRoot?.querySelector("iframe");return {ready:document.readyState,layer:!!layer,framePresent:!!frame,frameMatchesCandidate:frame?.src==='+JSON.stringify(candidate.url)+'};})()');throw Error('壁纸沙箱 iframe 未导航：'+JSON.stringify(summarizeFrameNavigationFailure({dom,frameTree:tree.frameTree,targetInfos:inventory,candidateUrl:candidate.url})));}
  mark('frameReady');({executionContextId:contextId}=await c.call('Page.createIsolatedWorld',{frameId:frame.id,worldName:id},sessionId));
  await c.call('Runtime.addBinding',{name:binding,executionContextId:contextId},sessionId);
  const handleRequest=request=>{
   if(request.status==='renderer-ready'){noticeReady();return;}if(!Number.isInteger(request.id)||pending.has(request.id))return;if(pending.size>=512){evaluate('__cwbWebGL.complete('+request.id+',"壁纸资源请求过多");true').catch(()=>{});return;}pending.add(request.id);
   const queuedAt=performance.now();startup.resources.requests++;
   transferQueue=transferQueue.then(async()=>{startup.resources.queueMs+=performance.now()-queuedAt;const handle=binding+'-'+request.id;try{
    if(closed)return;assertCurrent();const metadata=await reader.metadata(request.name);if(!metadata){await evaluate('__cwbWebGL.complete('+request.id+',null,null);true');return;}
    const key=createHash('sha256').update(JSON.stringify([reader.root,request.name,metadata.etag])).digest('hex'),info={rendererId:id,token:controlToken,id:request.id};
    if(await cacheCall('cached',[key,metadata.size,info])){startup.resources.cacheHits++;return;}
    if(closed)return;const transferStart=performance.now();await transferSceneResource(c,reader,request.name,metadata,{handle,key,isCurrent:()=>!closed&&(adopted||isCurrent())});startup.resources.transferMs+=performance.now()-transferStart;
    if(!closed)await cacheCall('complete',[handle,info]);
   }catch(error){await c.evaluate('window.__cwbSceneResources?.abort('+JSON.stringify(handle)+');true').catch(()=>{});if(!closed)await evaluate('__cwbWebGL.complete('+request.id+','+JSON.stringify(error.message)+');true').catch(()=>{});}finally{pending.delete(request.id);if(!pending.size)setImmediate(()=>global.gc?.());}}).catch(()=>{});
  };
  listener=event=>{let msg;try{msg=JSON.parse(event.data);}catch{return;}if(msg.method!=='Runtime.bindingCalled'||msg.params.name!==binding||msg.sessionId!==sessionId||msg.params.executionContextId!==contextId)return;
   let request;try{request=JSON.parse(msg.params.payload);}catch{return;}handleRequest(request);
  };c.ws.addEventListener('message',listener);
  if(!reuse){const runtimeSource=codexRuntimeSource(engine);await evaluate(runtimeSource.source+'\n;globalThis.__cwbFrameFreeze='+installFrameFreeze.toString()+';('+initializeRenderer.toString()+')('+JSON.stringify(reader.project)+','+JSON.stringify({fps:entry.limits?.fps||24,maxWidth:entry.limits?.maxWidth||1280,renderDpr:entry.limits?.exactResolution?2:undefined,fontBuffers:runtimeSource.fontBuffers,nativeAudio:runtimeSource.nativeAudio,frameReady:runtimeSource.frameReady,fontAdapterExpected:engine.includes('new FontFace('),scripts:entry.scripts===true,quality:entry.quality,properties,videoTexScale:entry.videoTexScale,audioResponse:config.systemMedia?.audio===true,key:entry.workshopId||entry.id,controlToken})+','+JSON.stringify(binding)+','+JSON.stringify(dshSource)+')');mark('engineInitialized');}
  const end=Date.now()+90000;let sample;
  do{assertCurrent();sample=await evaluate('globalThis.__cwbWebGL?.sample()');if(sample?.error)throw Error(sample.error);if(sample?.ready&&sample.width>0)break;if(!reuse)await waitForReady();}while(Date.now()<end&&!reuse);
  if(!sample?.ready||!sample.width)throw Error('WebWallGL 等待首帧超时');
  mark('rendererReady');
 const player={id,entryId:entry.id,reader,async assetStats(){return c.evaluate('({...window.__cwbSceneResources.stats})');},async sample(){return evaluate('__cwbWebGL.sample()');},async graphics(){return evaluate('(()=>{const canvas=document.querySelector("#wp canvas"),gl=canvas.getContext("webgl2")||canvas.getContext("webgl"),ext=gl?.getExtension("WEBGL_debug_renderer_info");return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,lost:gl?.isContextLost()}})()');},async setSystemSpectrum(payload){const systemSpectrum={audioAvailable:payload.audioAvailable===true,bands:(payload.bands||[]).slice(0,64).map(n=>Math.max(0,Math.min(255,Number(n)||0)))};return c.evaluate('document.querySelector('+JSON.stringify('[data-cwb-renderer-id="'+id+'"]')+').shadowRoot.querySelector("iframe").contentWindow.postMessage('+JSON.stringify({token:controlToken,systemSpectrum})+',"*");true');},async signature(){const result=await c.call('Runtime.evaluate',{expression:'new Promise(resolve=>requestAnimationFrame(()=>resolve(document.querySelector("#wp canvas").toDataURL())))',awaitPromise:true,returnByValue:true,contextId},sessionId);return result.result?.value;},async pause(value){return evaluate('__cwbWebGL.pause('+!!value+');true');},async setProperties(values){return evaluate('__cwbWebGL.instance.setProperties('+JSON.stringify(values)+');JSON.parse(JSON.stringify(__cwbWebGL.instance.getProperties()))');},async getProperties(){return evaluate('__cwbWebGL.instance.getProperties()');},async setFps(fps){return evaluate('__cwbWebGL.instance.setFps('+Number(fps)+');__cwbWebGL.configuredFps='+Number(fps)+';true');},async pointer(u,v,buttons=0){return evaluate('__cwbWebGL.instance.pushPointer('+u+','+v+','+buttons+');true');},dispose:cleanup};
  player.startup=startup;if(probe)return player;
  if(reuse){
   const requests=await evaluate('Array.from(__cwbWebGL.requests,([id,{name}])=>({id,name}))');
   assertCurrent();adopted=true;startup.reusedScene=true;
   for(const request of requests)if(typeof request.name==='string')handleRequest(request);
   return player;
  }
  const palette=await evaluate('(()=>{try{const tiny=document.createElement("canvas");tiny.width=tiny.height=8;const ctx=tiny.getContext("2d");ctx.drawImage(document.querySelector("#wp canvas"),0,0,8,8);const d=ctx.getImageData(0,0,8,8).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}r/=64;g/=64;b/=64;const dark=.2126*r+.7152*g+.0722*b<145,t=v=>Math.round(dark?v*.18:220+v*.12);return {r:t(r),g:t(g),b:t(b),dark}}catch{return null}})()');
  assertCurrent();const accepted=await c.evaluate('('+adoptRenderer.toString()+')('+JSON.stringify({selectionStamp,entryId:entry.id,id,url:candidate.url,controlToken,binding,key,palette:palette||config.palette,fps:entry.limits?.fps||24,type:reader.project.type,pauseOnBlur:!!config.pauseOnBlur,supportsAudio:reader.project.general?.supportsaudioprocessing!==false})+')');
  if(!accepted)throw Object.assign(Error('已跳过先前的选择'),{code:'CWB_SELECTION_SUPERSEDED'});adopted=true;mark('adopted');
  // cleanup must target the adopted layer after a successful swap.
  player.dispose=cleanup;
  return player;
 }catch(error){await cleanup();throw error;}
}

function adoptRenderer(info){
 if(info.selectionStamp&&(window.__cwbSelectionStamp!==info.selectionStamp||window.__cwbDesiredWallpaperId!==info.entryId))return false;
 const layer=document.getElementById(info.id),frame=layer.shadowRoot.querySelector('iframe');window.__codexWallpaperBridge?.dispose?.();document.getElementById('codex-wallpaper-bridge-layer')?.remove();layer.id='codex-wallpaper-bridge-layer';layer.style.opacity='1';
 const state=window.__codexWallpaperBridge={rendererId:info.id,reuse:{id:info.id,key:info.key,url:info.url,binding:info.binding,controlToken:info.controlToken},ready:true,mode:'webwallgl',supportsAudio:info.supportsAudio,transport:'sandbox-webgl',palette:info.palette,pauseOnBlur:info.pauseOnBlur,receivedAt:Date.now(),detail:{}};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),send=message=>frame.contentWindow?.postMessage({token:info.controlToken,...message},'*');
 let manualPause=null;
 const visibility=()=>{const paused=manualPause===null?(document.hidden||(state.pauseOnBlur&&!document.hasFocus())||reduced.matches):manualPause;if(state.paused===paused)return;state.paused=paused;send({paused});if(state.paused)send({systemSpectrum:{audioAvailable:false,bands:[]}});window.__cwbMediaActivity?.report();};
 state.pause=value=>{manualPause=typeof value==='boolean'?value:null;visibility();};
 const receive=event=>{if(event.source===frame.contentWindow&&event.data?.token===info.controlToken&&event.data.sample){state.detail=event.data.sample;state.error=state.detail.error;state.ready=state.detail.ready&&!state.error;state.receivedAt=Date.now();window.__cwbMediaActivity?.report();}};
 const disposePointer=window.__cwbInstallWallpaperPointer(send,{fps:info.fps,type:info.type,bounds:()=>frame.getBoundingClientRect()});
 addEventListener('message',receive);document.addEventListener('visibilitychange',visibility);addEventListener('focus',visibility);addEventListener('blur',visibility);reduced.addEventListener('change',visibility);
 state.setPauseOnBlur=value=>{state.pauseOnBlur=!!value;visibility();};state.setVolume=value=>send({volume:value});state.setProperties=properties=>send({properties});state.setSystemMedia=systemMedia=>send({systemMedia});state.setSystemSpectrum=systemSpectrum=>send({systemSpectrum});state.setSystemPosition=systemPosition=>send({systemPosition});
 state.sample=()=>({...state.detail,ready:state.ready,error:state.error,mode:'webwallgl',transport:'sandbox-webgl',paused:state.paused,hidden:document.hidden,focused:document.hasFocus()});
 state.dispose=()=>{disposePointer();removeEventListener('message',receive);document.removeEventListener('visibilitychange',visibility);removeEventListener('focus',visibility);removeEventListener('blur',visibility);reduced.removeEventListener('change',visibility);layer.__cwbCandidateDispose?.();layer.remove();URL.revokeObjectURL(info.url);};visibility();return true;
}
