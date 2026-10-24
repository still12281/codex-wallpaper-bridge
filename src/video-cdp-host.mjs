import {getDataRoot,loadSettings} from './runtime-paths.mjs';
import {readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {connectCdp} from './cdp-client.mjs';
import {paintShell,paintEmbedded} from './wallpaper-style.mjs';
import {installNativeWidgets} from './wallpaper-widgets.mjs';
import {normalizeLibrary,createActions,saveConfig} from './wallpaper-actions.mjs';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startRealtime} from './realtime-source.mjs';
import {installRealtime} from './realtime-player.mjs';
import {mountWebWallGL} from './webwallgl-player.mjs';
import {upstreamRuntime,decorateShell} from './upstream-adapters.mjs';
import {installFeaturePanel} from './feature-panel.mjs';
import {startSystemMedia} from './system-media.mjs';

const codeRoot=path.dirname(fileURLToPath(import.meta.url));
const root=getDataRoot();
const settings=await loadSettings(root);
const adapters=await upstreamRuntime();
normalizeLibrary(settings);await saveConfig(root,settings);
const arg=process.argv.indexOf('--cdp-port'),port=Number(process.argv[arg+1]);
if(arg<0||!Number.isInteger(port)||port<1024||port>65535)throw Error('Expected --cdp-port');
const testArg=process.argv.indexOf('--test-url');const appUrl=testArg>=0?process.argv[testArg+1]:'app://-/index.html';
const version=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();
const status={pid:process.pid,browserId:version.webSocketDebuggerUrl.split('/').pop(),source:'native-video-blob',phase:'connecting',cdpPort:port,wallpaperId:settings.wallpaperId,targets:[]};
const save=async()=>{status.memory=process.memoryUsage();status.updatedAt=new Date().toISOString();await writeFile(path.join(root,'runtime-status.json'),JSON.stringify(status,null,2))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sessions=new Map(),embeddedSessions=new Map();let busy=false,stopped=false,acting=false,actionQueue=Promise.resolve();
let realtime=null,realtimeKey=null,streamTimer=null,streaming=false;
const evaluateAsync=async(c,expression)=>{const result=await c.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value};
async function stopRealtime(){const previous=realtime;realtime=null;realtimeKey=null;if(previous)await previous.stop()}
async function ensureRealtime(entry){
 const key=JSON.stringify([entry.id,entry.projectRoot,entry.limits]);if(realtimeKey===key&&realtime&&!realtime.error&&!realtime.closed)return realtime;
 const next=await startRealtime(entry,root),previous=realtime;realtime=next;realtimeKey=key;
 if(previous)await previous.stop();return next;
}
async function stream(){
 if(stopped)return;
 if(streaming||busy||acting){streamTimer=setTimeout(stream,8);streamTimer.unref();return}streaming=true;const cycleStart=Date.now();
 try{
  const source=realtime;if(!source)return;let anyActive=false;
  if(source.error&&!source.recoveryQueued){
   source.recoveryQueued=true;const failure=source.error;
   actionQueue=actionQueue.then(async()=>{
    while(busy||streaming)await sleep(25);acting=true;
    try{
     if(realtime!==source)return;
     const fallback=settings.library.find(e=>e.id===settings.realtimeFallbackId&&e.mode!=='realtime');
     await stopRealtime();settings.selectedId=fallback?.id||null;await applySelected();await saveConfig(root,settings);
     const message=failure+(fallback?'；已恢复上一个图片/视频背景。':'；已停止实时背景，可重新选择壁纸。');
     for(const c of sessions.values())await c.evaluate('document.getElementById("codex-wallpaper-controls")?.__cwbRuntimeError?.('+JSON.stringify(message)+');true').catch(()=>{});
    }catch(error){status.streamError='实时故障恢复失败：'+error.message}
    finally{acting=false}
   });return;
  }
  await Promise.all([...sessions.values()].map(async c=>{
   if(!c.installed||!c.isRealtime)return;
   const now=Date.now(),sequence=source.sequence,frame=source.frame;
   if(c.capturePaused||!frame||c.captureSequence===sequence){if(now<(c.nextCapturePoll||0)){if(!c.capturePaused)anyActive=true;return}c.nextCapturePoll=now+250;const sample=await c.evaluate('window.__codexWallpaperBridge?.sample()').catch(()=>null);c.capturePaused=sample?.paused!==false;if(!c.capturePaused)anyActive=true;return}
   const called=await c.call('Runtime.callFunctionOn',{objectId:c.captureObjectId,functionDeclaration:'function(frame){return this.draw(frame)}',arguments:[{value:frame.toString('base64')}],awaitPromise:true,returnByValue:true});if(called.exceptionDetails)throw Error(called.exceptionDetails.exception?.description||called.exceptionDetails.text);const sample=called.result?.value;
   c.captureSequence=sequence;c.capturePaused=sample?.paused!==false;if(!c.capturePaused)anyActive=true;
  }));
  if(!source.error&&source.paused===anyActive)source.setPaused(!anyActive);
 }catch(error){status.streamError=error.message}
 finally{streaming=false;if(!stopped){streamTimer=setTimeout(stream,Math.max(1,Math.round(1000/(realtime?.profile.fps||24))-(Date.now()-cycleStart)));streamTimer.unref()}}
}
streamTimer=setTimeout(stream,1000);
async function applyAppearance(){
 const {paintShell}=await import('./wallpaper-style.mjs?v='+(await stat(path.join(codeRoot,'wallpaper-style.mjs'))).mtimeMs);
 for(const c of sessions.values())await c.evaluate('(()=>{const config='+JSON.stringify(settings)+';window.__codexWallpaperBridge?.setPauseOnBlur?.(config.pauseOnBlur);document.getElementById("codex-wallpaper-controls")?.__cwbRenderConfig?.(config);return ('+paintShell.toString()+')(config)})()');
}
async function applySelected(){for(const [id,c]of sessions){const key=JSON.stringify(settings.library.find(e=>e.id===settings.selectedId));if(c.activeKey===key&&await c.evaluate('!!window.__codexWallpaperBridge?.ready&&!window.__codexWallpaperBridge?.error')){c.installed=true;continue;}c.installed=false;try{await mount(c,{id});c.activeKey=key;}catch(error){await c.evaluate('window.__cwbPendingMedia?.dispose?.();document.getElementById("codex-wallpaper-bridge-pending")?.remove();delete window.__cwbPendingMedia;true').catch(()=>{});throw error;}}}
let mediaBackend=null,mediaKey='',mediaBusy=false,mediaError=null;
async function configureMedia(options){const key=JSON.stringify(options);if(mediaKey===key&&(!options.enabled||(mediaBackend&&!mediaBackend.state.error)))return;const next=options.enabled?await startSystemMedia(root,options):null,previous=mediaBackend;mediaBackend=next;mediaKey=key;mediaError=null;await previous?.stop();}
const actions=createActions(root,settings,applySelected,applyAppearance,{configureMedia,controlMedia:async command=>{if(!mediaBackend)throw Error('系统媒体未启用');await mediaBackend.control(command);}});
async function alignTaskbar(){if(appUrl!=='app://-/index.html'||process.platform!=='win32')return;try{await stat(path.join(root,'Align-Taskbar.exe'))}catch{return}try{const r=await promisify(execFile)(path.join(root,'Align-Taskbar.exe'),['--apply'],{windowsHide:true,timeout:8000});status.taskbar={updatedAt:new Date().toISOString(),result:r.stdout.trim()};}catch(e){status.taskbar={error:e.message}}}

function prepareLayer(size,mime){
 window.__cwbPendingMedia?.dispose?.();document.getElementById('codex-wallpaper-bridge-pending')?.remove();
 const layer=document.createElement('div');layer.id='codex-wallpaper-bridge-pending';layer.setAttribute('aria-hidden','true');
 layer.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0';
 const shadow=layer.attachShadow({mode:'open'});
 const video=document.createElement(mime.startsWith('video/')?'video':'img');if(video.tagName==='VIDEO'){video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto';video.disablePictureInPicture=true}video.tabIndex=-1;
 video.style.cssText='width:100%;height:100%;object-fit:cover;display:block;pointer-events:none';shadow.append(video);document.body.prepend(layer);
 const state=window.__cwbPendingMedia={installed:true,ready:false,mime,transport:'native-media-blob',bytes:new Uint8Array(size)};
 state.sample=()=>{const q=video.getVideoPlaybackQuality?.();return {ready:state.ready,paused:video.paused,time:video.currentTime,width:video.videoWidth||video.naturalWidth,height:video.videoHeight||video.naturalHeight,quality:q?{total:q.totalVideoFrames,dropped:q.droppedVideoFrames}:null,hidden:document.hidden,focused:document.hasFocus()}};
 return true;
}

function startVideo(config){
 const state=window.__cwbPendingMedia,video=document.getElementById('codex-wallpaper-bridge-pending').shadowRoot.firstElementChild;
 state.blobUrl=URL.createObjectURL(new Blob([state.bytes],{type:state.mime}));delete state.bytes;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const visibility=()=>{if(video.tagName!=='VIDEO')return;if(document.hidden||(config.pauseOnBlur&&!document.hasFocus())||reduced.matches)video.pause();else video.play().catch(e=>{state.error=String(e)})};
 state.setPauseOnBlur=value=>{config.pauseOnBlur=!!value;visibility()};
 document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',visibility);window.addEventListener('blur',visibility);reduced.addEventListener('change',visibility);
 state.dispose=()=>{video.pause?.();video.removeAttribute('src');video.load?.();URL.revokeObjectURL(state.blobUrl);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',visibility);window.removeEventListener('blur',visibility);reduced.removeEventListener('change',visibility)};
 video.addEventListener('error',()=>{state.error=video.error?.message||'Video decode error'});
 video.addEventListener(video.tagName==='VIDEO'?'loadeddata':'load',()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,16,16);const data=ctx.getImageData(0,0,16,16).data;let r=0,g=0,b=0;for(let i=0;i<data.length;i+=4){r+=data[i];g+=data[i+1];b+=data[i+2]}r/=256;g/=256;b/=256;const l=.2126*r+.7152*g+.0722*b,dark=l<145;const tint=v=>Math.round(dark?v*.18:220+v*.12);state.palette={r:tint(r),g:tint(g),b:tint(b),dark};state.ready=true;visibility()},{once:true});video.src=state.blobUrl;video.load?.();return true;
}

async function mount(c,target){
 await c.evaluate('window.__cwbPickerModel='+adapters.picker+';window.__cwbInstallFx='+adapters.fx+';window.__cwbDecorate='+decorateShell.toString()+';window.__cwbInstallFeatures='+installFeaturePanel.toString()+';true');
 await c.evaluate('window.__cwbApplyWidgets='+installNativeWidgets.toString()+';true');
 const styleVersion=(await stat(path.join(codeRoot,'wallpaper-style.mjs'))).mtimeMs;
 const {paintShell}=await import('./wallpaper-style.mjs?v='+styleVersion);
 const {installPanel}=await import('./wallpaper-panel.mjs?v='+(await stat(path.join(codeRoot,'wallpaper-panel.mjs'))).mtimeMs);
 const entry=settings.library.find(e=>e.id===settings.selectedId);
 if(entry?.mode==='webwallgl'){
  const previous=c.webPlayer,next=await mountWebWallGL(c,entry,{dataRoot:root,config:settings});c.webPlayer=next;await previous?.dispose();await stopRealtime();c.isRealtime=false;
  settings.palette=await c.evaluate('window.__codexWallpaperBridge.palette');await c.evaluate('('+paintShell.toString()+')('+JSON.stringify(settings)+')');await c.evaluate('('+installPanel.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(c.token)+')');c.installed=true;return;
 }
 if(!entry&&c.webPlayer){await c.webPlayer.dispose();c.webPlayer=null;}
 if(!entry){await stopRealtime();await c.evaluate('window.__cwbDecorations?.dispose();window.__cwbWidgets?.dispose?.();delete window.__cwbWidgets;window.__codexWallpaperBridge?.dispose?.();window.__cwbLayout?.dispose?.();delete window.__cwbLayout;document.getElementById("codex-wallpaper-bridge-layer")?.remove();document.getElementById("codex-wallpaper-bridge-style")?.remove();window.__codexWallpaperBridge={disabled:true,sample:()=>({ready:false,disabled:true,paused:true})};true');await c.evaluate('('+installPanel.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(c.token)+')');c.installed=true;setImmediate(()=>global.gc?.());return}
 if(entry.mode==='realtime'){
  const source=await ensureRealtime(entry);
  await evaluateAsync(c,'('+installRealtime.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(source.frame.toString('base64'))+','+JSON.stringify({name:source.name,fps:source.profile.fps})+')');
  if(c.webPlayer){await c.webPlayer.dispose();c.webPlayer=null;}
  if(c.captureObjectId)await c.call('Runtime.releaseObject',{objectId:c.captureObjectId}).catch(()=>{});c.captureObjectId=(await c.call('Runtime.evaluate',{expression:'window.__codexWallpaperBridge',returnByValue:false})).result.objectId;
  settings.palette=await c.evaluate('window.__codexWallpaperBridge.palette');await c.evaluate('('+paintShell.toString()+')('+JSON.stringify(settings)+')');await c.evaluate('('+installPanel.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(c.token)+')');
  c.captureSequence=source.sequence;c.isRealtime=true;c.capturePaused=false;c.nextCapturePoll=0;c.reportedCaptureError=false;c.installed=true;return;
 }
 c.isRealtime=false;
 const mediaPath=path.resolve(root,entry.file);const mediaLimit=Math.min(128*1024*1024,entry.limits?.maxBytes||32*1024*1024);if(!mediaPath.startsWith(root+path.sep)||(await stat(mediaPath)).size>mediaLimit)throw Error('Unsupported local media path or size');
 const media=await readFile(mediaPath);status.mediaBytes=media.length;
 status.phase='loading-lightweight-video';delete status.error;await save();
 await c.evaluate('('+prepareLayer.toString()+')('+media.length+','+JSON.stringify(entry.mime)+')');
 const size=512*1024;
 for(let offset=0;offset<media.length;offset+=size){
  const base64=media.subarray(offset,offset+size).toString('base64');
  await c.evaluate('(()=>{const s=atob('+JSON.stringify(base64)+'),a=window.__cwbPendingMedia.bytes;for(let i=0;i<s.length;i++)a['+offset+'+i]=s.charCodeAt(i);return true})()');
 }
 await c.evaluate('('+startVideo.toString()+')('+JSON.stringify(settings)+')');
 for(let i=0;i<40;i++){
  const current=await c.evaluate('({error:window.__cwbPendingMedia?.error,...window.__cwbPendingMedia?.sample()})');
  if(current.error){await c.evaluate('window.__cwbPendingMedia?.dispose?.();document.getElementById("codex-wallpaper-bridge-pending")?.remove();delete window.__cwbPendingMedia;true');throw Error(current.error);}
  if(current.ready){await c.evaluate('(()=>{const old=window.__codexWallpaperBridge;old?.dispose?.();document.getElementById("codex-wallpaper-bridge-layer")?.remove();const pending=document.getElementById("codex-wallpaper-bridge-pending");pending.id="codex-wallpaper-bridge-layer";window.__codexWallpaperBridge=window.__cwbPendingMedia;delete window.__cwbPendingMedia;return true})()');if(c.webPlayer){await c.webPlayer.dispose();c.webPlayer=null;}await stopRealtime();settings.palette=await c.evaluate('window.__codexWallpaperBridge.palette');if(!acting)await saveConfig(root,settings);await c.evaluate('('+paintShell.toString()+')('+JSON.stringify(settings)+')');await c.evaluate('('+installPanel.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(c.token)+')');c.installed=true;setImmediate(()=>global.gc?.());return}
  await sleep(100);
 }
 await c.evaluate('window.__cwbPendingMedia?.dispose?.();document.getElementById("codex-wallpaper-bridge-pending")?.remove();delete window.__cwbPendingMedia;true');throw Error('Lightweight video did not decode a first frame');
}

async function tick(){
 if(busy||stopped||acting||streaming)return;busy=true;
 try{
  const list=await(await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(2000)})).json();
  const targets=list.filter(t=>t.type==='page'&&(t.url===appUrl||(appUrl==='app://-/index.html'&&t.url.startsWith('app://-/detached-window.html'))));
  const webTargets=list.filter(t=>t.type==='webview'&&t.url.startsWith('https://chatgpt.com/'));
  for(const [id,c]of embeddedSessions)if(!webTargets.some(t=>t.id===id)){c.close();embeddedSessions.delete(id)}
  for(const target of webTargets){try{let c=embeddedSessions.get(target.id);if(!c||c.ws.readyState!==1){c=await connectCdp(target.webSocketDebuggerUrl);embeddedSessions.set(target.id,c)}await c.call('Emulation.setDefaultBackgroundColorOverride',settings.surfaceSync?.embedded===false?{}:{color:{r:0,g:0,b:0,a:0}});await c.evaluate('('+paintEmbedded.toString()+')('+JSON.stringify(settings)+')')}catch(error){status.embeddedError=error.message}}
  if(!targets.length){await stopRealtime();status.phase='waiting-for-target';status.targets=[];await save()}
  for(const [id,c]of sessions)if(!targets.some(t=>t.id===id)){c.close();sessions.delete(id)}
  for(const target of targets){
   if(!new RegExp('^ws://127\\.0\\.0\\.1:'+port+'/devtools/page/[A-Za-z0-9-]+$').test(target.webSocketDebuggerUrl))continue;
   let c=sessions.get(target.id);if(!c||c.ws.readyState!==1){c=await connectCdp(target.webSocketDebuggerUrl);sessions.set(target.id,c);c.token=randomUUID();await c.call('Runtime.addBinding',{name:'__codexWallpaperSend'});c.ws.addEventListener('message',event=>{let e;try{e=JSON.parse(event.data)}catch{return}if(e.method!=='Runtime.bindingCalled'||e.params.name!=='__codexWallpaperSend')return;let req;try{req=JSON.parse(e.params.payload)}catch{return}if(req.token!==c.token)return;actionQueue=actionQueue.then(async()=>{while(busy||streaming)await sleep(25);acting=true;try{const result=await actions(c,req);await c.evaluate('window.__cwbReply?.('+Number(req.id)+','+JSON.stringify({ok:true,...result})+')')}catch(error){await c.evaluate('window.__cwbReply?.('+Number(req.id)+','+JSON.stringify({ok:false,error:error.message})+')').catch(()=>{})}finally{acting=false}})})}
   if(!await c.evaluate(target.url.startsWith('app://-/detached-window.html')?'!!document.body':'!!document.querySelector("aside.app-shell-left-panel")&&!!document.querySelector("main[data-app-shell-main-surface],main[class*=\\"_MainContentSurface_\\"],main.main-surface")'))continue;
   const tree=await c.call('Page.getFrameTree');
   if(c.loaderId!==tree.frameTree.frame.loaderId){c.loaderId=tree.frameTree.frame.loaderId;c.installed=false;c.failed=false;c.retryAt=0;c.failures=0;await c.call('Runtime.addBinding',{name:'__codexWallpaperSend'});await alignTaskbar()}
   if(c.retryAt&&Date.now()<c.retryAt)continue;
   try{
    if(c.webPlayer&&c.installed){const failure=await c.evaluate('window.__codexWallpaperBridge?.error');if(failure){const fallback=settings.library.find(e=>e.id===settings.realtimeFallbackId&&!['webwallgl','realtime'].includes(e.mode));settings.selectedId=fallback?.id||null;await mount(c,target);await saveConfig(root,settings);await c.evaluate('document.getElementById("codex-wallpaper-controls")?.__cwbRuntimeError?.('+JSON.stringify('WebGL 场景错误：'+failure+'；已恢复可用背景。')+');true');}}
    const healthy=await c.evaluate('(()=>{const s=window.__codexWallpaperBridge,controls=document.getElementById("codex-wallpaper-controls");if(!s||s.error||!controls?.isConnected)return false;if(s.disabled)return true;const layer=document.getElementById("codex-wallpaper-bridge-layer");return !!(layer?.isConnected&&layer.shadowRoot?.firstElementChild?.isConnected&&document.getElementById("codex-wallpaper-bridge-style")?.isConnected)})()');
    if(!healthy)c.installed=false;
    if(!c.installed){await mount(c,target);c.activeKey=JSON.stringify(settings.library.find(e=>e.id===settings.selectedId));}
    const observed=await c.evaluate('window.__codexWallpaperBridge?.sample()');
    if(!observed){c.installed=false;continue}
    status.phase=observed.disabled?'background-disabled':observed.mode==='realtime'?(realtime?.error?'realtime-source-error':realtime?.paused?'realtime-capture-paused':Date.now()-realtime.lastFrameAt>10000?'realtime-no-new-frames':'realtime-capture-active'):'background-rendered';status.targets=[{targetId:target.id,installed:true,...observed}];status.realtime=realtime?{sourceWindow:realtime.name,sequence:realtime.sequence,lastFrameAt:realtime.lastFrameAt,hwnd:realtime.hwnd,error:realtime.error,profile:realtime.profile}:null;await save();
    if(observed.mode==='realtime'){
     const age=Math.max(0,Math.floor((Date.now()-(realtime?.lastFrameAt||Date.now()))/1000));
     const note=`实时输出：${observed.width} × ${observed.height}，采集上限 ${observed.captureFps} FPS，已绘制 ${observed.frames} 帧。`+(observed.paused?'当前暂停采集/绘制，源引擎仍可能运行。':age>10?`已 ${age} 秒没有新画面，请检查源窗口或 Wallpaper Engine 暂停规则。`:'');
     await c.evaluate('document.getElementById("codex-wallpaper-controls")?.__cwbCaptureStats?.('+JSON.stringify(note)+');true');
    }
    c.failures=0;c.retryAt=0;delete status.error;
   }catch(error){c.installed=false;c.failures=(c.failures||0)+1;c.retryAt=Date.now()+Math.min(30000,1000*2**Math.min(c.failures-1,5));status.phase='background-retrying';status.error=error.message;status.retryAt=new Date(c.retryAt).toISOString();await save()}
  }
 }catch(error){status.phase='waiting-for-cdp';status.error=error.message;await save()}
 finally{busy=false}
}
let rotationAt=0,rotationKey='',rotating=false;
const rotationTimer=setInterval(()=>{
 const key=JSON.stringify([settings.rotation,settings.selectedId]);
 if(rotationKey!==key){rotationKey=key;rotationAt=Date.now()+(settings.rotation.intervalSeconds||60)*1000;}
 if(!settings.rotation.enabled||rotating||Date.now()<rotationAt||busy||acting||streaming)return;
 rotating=true;actionQueue=actionQueue.then(async()=>{
  let acquired=false;
  try{
   while((busy||streaming)&&!stopped)await sleep(25);if(stopped||!settings.rotation.enabled)return;
   acting=true;acquired=true;
   const active=await Promise.all([...sessions.values()].map(c=>c.evaluate('!document.hidden&&document.hasFocus()').catch(()=>false)));
   if(!active.some(Boolean))return;
   await actions(null,{action:'rotation-next'});
   for(const c of sessions.values())await c.evaluate('document.getElementById("codex-wallpaper-controls")?.__cwbRenderConfig?.('+JSON.stringify(settings)+');true');
   rotationAt=Date.now()+(settings.rotation.intervalSeconds||60)*1000;delete status.rotationError;
  }catch(error){status.rotationError=error.message;rotationAt=Date.now()+(settings.rotation.intervalSeconds||60)*1000;}
  finally{if(acquired)acting=false;rotating=false;}
 });
},1000);rotationTimer.unref();
await configureMedia(settings.systemMedia).catch(error=>{mediaError=error.message;});
let spectrumBusy=false;
const spectrumTimer=setInterval(async()=>{if(spectrumBusy||stopped||busy||acting||streaming||![...sessions.values()].some(c=>c.webPlayer))return;spectrumBusy=true;try{const {audioAvailable=false,bands=[]}=mediaBackend?.payload()||{};for(const c of sessions.values())if(c.webPlayer)await c.evaluate('window.__codexWallpaperBridge?.setSystemSpectrum?.('+JSON.stringify({audioAvailable,bands})+');true').catch(()=>{});}finally{spectrumBusy=false;}},100);spectrumTimer.unref();
const mediaTimer=setInterval(async()=>{if(mediaBusy||stopped||busy||acting||streaming)return;mediaBusy=true;try{const payload=mediaBackend?.payload()||{hasMedia:false,audioAvailable:false,sources:[],error:mediaError,capabilities:{}};for(const c of sessions.values())await c.evaluate('window.__codexWallpaperBridge?.setSystemMedia?.('+JSON.stringify(payload)+');document.getElementById("codex-wallpaper-controls")?.__cwbSystemMedia?.('+JSON.stringify(payload)+');true').catch(()=>{});}finally{mediaBusy=false;}},1000);mediaTimer.unref();
await save();await tick();const timer=setInterval(tick,5000);
 const stop=()=>{stopped=true;clearInterval(timer);clearInterval(rotationTimer);clearInterval(mediaTimer);clearInterval(spectrumTimer);clearTimeout(streamTimer);Promise.all([...sessions.values()].map(async c=>{await c.evaluate('window.__cwbDecorations?.dispose();true').catch(()=>{});await c.webPlayer?.dispose();c.close();})).then(()=>Promise.all([stopRealtime(),mediaBackend?.stop()])).finally(()=>process.exit(0))};process.on('SIGINT',stop);process.on('SIGTERM',stop);
