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
import {startRealtime,nativeFullProfile} from './realtime-source.mjs';
import {installRealtime} from './realtime-player.mjs';
import {installFrameFreeze} from './freeze-frame.mjs';
import {mountWebWallGL} from './webwallgl-player.mjs';
import {upstreamRuntime,decorateShell} from './upstream-adapters.mjs';
import {installFeaturePanel} from './feature-panel.mjs';
import {startSystemMedia,spectrumInterval} from './system-media.mjs';
import {createMediaPower,installMediaActivity} from './media-power.mjs';
import {displaySettings,effectiveEntry,effectiveMediaSettings} from './display-tiers.mjs';

const codeRoot=path.dirname(fileURLToPath(import.meta.url));
const root=getDataRoot();
const settings=await loadSettings(root);
const adapters=await upstreamRuntime();
normalizeLibrary(settings);await saveConfig(root,settings);
const arg=process.argv.indexOf('--cdp-port'),port=Number(process.argv[arg+1]);
if(arg<0||!Number.isInteger(port)||port<1024||port>65535)throw Error('Expected --cdp-port');
const testArg=process.argv.indexOf('--test-url');const appUrl=testArg>=0?process.argv[testArg+1]:'app://-/index.html';
const version=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();
// The browser connection is a lifetime signal, not a process-scanning timer.
const browserLifetime=await connectCdp(version.webSocketDebuggerUrl);
const status={pid:process.pid,browserId:version.webSocketDebuggerUrl.split('/').pop(),source:'native-video-blob',phase:'connecting',cdpPort:port,wallpaperId:settings.wallpaperId,targets:[]};
const save=async()=>{status.mediaPower=mediaPower?.snapshot()??null;status.memory=process.memoryUsage();status.updatedAt=new Date().toISOString();await writeFile(path.join(root,'runtime-status.json'),JSON.stringify(status,null,2))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sessions=new Map(),embeddedSessions=new Map();let busy=false,stopped=false,acting=false,actionQueue=Promise.resolve();
let realtime=null,realtimeKey=null,streamTimer=null,streaming=false,timer=null,rotationTimer=null,spectrumTimer=null,mediaPower=null;
function scheduleStream(delay){clearTimeout(streamTimer);if(stopped)return;streamTimer=setTimeout(stream,delay);streamTimer.unref();}
async function stop(){
 if(stopped)return;stopped=true;
 clearInterval(timer);clearInterval(rotationTimer);clearInterval(spectrumTimer);clearTimeout(streamTimer);
 // Native capture cleanup can need 2s for Python plus 8s for its owned engine window.
 const deadline=setTimeout(()=>process.exit(0),12000);deadline.unref();
 const cleanups=[];
 for(const c of [...sessions.values(),...embeddedSessions.values()]){try{cleanups.push(Promise.resolve(c.webPlayer?.dispose()));c.close()}catch{}}
 browserLifetime.close();
 try{await Promise.allSettled([...cleanups,stopRealtime(),mediaPower?.stop()]);status.phase='stopped';status.targets=[];await save();}finally{process.exit(0)}
}
browserLifetime.ws.addEventListener('close',()=>void stop(),{once:true});
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
const evaluateAsync=async(c,expression)=>{const result=await c.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value};
async function stopRealtime(){const previous=realtime;realtime=null;realtimeKey=null;if(previous)await previous.stop()}
async function ensureRealtime(entry){
 const key=JSON.stringify([entry.id,entry.projectRoot,entry.limits]);if(realtimeKey===key&&realtime&&!realtime.error&&!realtime.closed)return realtime;
 const next=await startRealtime(entry,root);next.key=key;return next;
}
async function stream(){
 if(stopped)return;
 if(streaming||busy||acting){scheduleStream(8);return}streaming=true;const cycleStart=Date.now();
 try{
  const source=realtime;if(!source)return;let anyActive=false;
  if(!source.paused&&Date.now()-Math.max(source.lastFrameAt,source.resumedAt||0)>10000)source.error='原生采集活动期间超过 10 秒没有新画面';
  if(source.error&&!source.recoveryQueued){
   source.recoveryQueued=true;const failure=source.error;
   actionQueue=actionQueue.then(async()=>{
    while(busy||streaming)await sleep(25);acting=true;
    try{
     if(realtime!==source)return;
     const fallback=settings.library.find(e=>e.id===settings.realtimeFallbackId&&!['realtime','webwallgl'].includes(e.mode));
     await stopRealtime();settings.selectedId=fallback?.id||null;await applySelected();await saveConfig(root,settings);
     const message=failure+(fallback?'；已恢复上一个图片/视频背景。':'；已停止实时背景，可重新选择壁纸。');
     for(const c of sessions.values())await c.evaluate('document.getElementById("codex-wallpaper-controls")?.__cwbRuntimeError?.('+JSON.stringify(message)+');true').catch(()=>{});
    }catch(error){status.streamError='实时故障恢复失败：'+error.message}
    finally{acting=false}
   });return;
  }
  await Promise.all([...sessions.values()].map(async c=>{
   if(!c.installed||!c.isRealtime||c.captureBlocked)return;
   if(c.drawInFlight>=2){if(!c.capturePaused)anyActive=true;return;}
   const now=Date.now(),sequence=source.sequence,frame=source.frame;
   if(c.capturePaused||!frame||c.captureSequence===sequence||c.captureSentSequence===sequence){if(now>=(c.nextCapturePoll||0)&&!c.sampleInFlight){c.nextCapturePoll=now+250;c.sampleInFlight=true;const objectId=c.captureObjectId;c.call('Runtime.evaluate',{expression:'window.__codexWallpaperBridge?.sample()',returnByValue:true},undefined,1000).then(r=>{if(c.captureObjectId!==objectId)return;c.capturePaused=r.result?.value?.paused!==false;if(!c.capturePaused)scheduleStream(0);}).catch(()=>{c.capturePaused=true;}).finally(()=>{c.sampleInFlight=false;});}if(!c.capturePaused)anyActive=true;return;}
   if(source.base64Sequence!==sequence){source.base64=frame.toString('base64');source.base64Sequence=sequence;}
   const objectId=c.captureObjectId,generation=c.captureGeneration,started=Date.now();c.drawInFlight=(c.drawInFlight||0)+1;c.captureSentSequence=sequence;anyActive=true;
   c.call('Runtime.callFunctionOn',{objectId,functionDeclaration:'function(frame,info){return this.draw(frame,info)}',arguments:[{value:source.base64},{value:{...source.frameInfo,sequence}}],awaitPromise:true,returnByValue:true},undefined,1500).then(called=>{if(called.exceptionDetails)throw Error(called.exceptionDetails.exception?.description||called.exceptionDetails.text);if(c.captureGeneration!==generation)return;const sample=called.result?.value;c.captureSequence=Math.max(c.captureSequence||0,sequence);c.capturePaused=sample?.paused!==false;c.captureTiming={roundtripMs:Date.now()-started,...sample?.timing};if(!c.captureBlocked)delete c.captureError;}).catch(error=>{if(c.captureGeneration===generation){const first=!c.captureBlocked;c.captureError=error.message+'；已暂停向此窗口追加画面，请重新应用壁纸。';c.captureBlocked=true;if(first)c.call('Runtime.evaluate',{expression:'document.getElementById("codex-wallpaper-controls")?.__cwbRuntimeError?.('+JSON.stringify(c.captureError)+');true'},undefined,1000).catch(()=>{});}}).finally(()=>{if(c.captureGeneration!==generation)return;c.drawInFlight=Math.max(0,(c.drawInFlight||1)-1);if(!c.captureBlocked&&source===realtime&&!c.capturePaused&&source.sequence!==c.captureSentSequence)scheduleStream(0);});
  }));
  if(!source.error&&source.paused===anyActive)source.setPaused(!anyActive);
 }catch(error){status.streamError=error.message}
 finally{streaming=false;const interval=!realtime?1000:realtime.paused?250:1000/realtime.profile.fps;scheduleStream(Math.max(1,interval-(Date.now()-cycleStart)));}
}
streamTimer=setTimeout(stream,1000);
async function applyAppearance(){
 const {paintShell}=await import('./wallpaper-style.mjs?v='+(await stat(path.join(codeRoot,'wallpaper-style.mjs'))).mtimeMs);
 for(const c of sessions.values())await c.evaluate('(()=>{const config='+JSON.stringify(settings)+';window.__codexWallpaperBridge?.setPauseOnBlur?.(config.pauseOnBlur);document.getElementById("codex-wallpaper-controls")?.__cwbRenderConfig?.(config);return ('+paintShell.toString()+')('+JSON.stringify(displaySettings(settings))+')})()');
}
function activeWallpaperKey(){const entry=settings.library.find(e=>e.id===settings.selectedId);return JSON.stringify([entry,entry?.mode==='webwallgl'?!!settings.systemMedia?.audio:null]);}
async function applySelected(){for(const [id,c]of sessions){const key=activeWallpaperKey();if(!c.captureBlocked&&c.activeKey===key&&await c.evaluate('!!window.__codexWallpaperBridge?.ready&&!window.__codexWallpaperBridge?.error')){c.installed=true;continue;}c.installed=false;try{await mount(c,{id});c.activeKey=key;}catch(error){await c.evaluate('window.__cwbPendingMedia?.dispose?.();document.getElementById("codex-wallpaper-bridge-pending")?.remove();delete window.__cwbPendingMedia;true').catch(()=>{});throw error;}}await configureMedia(settings.systemMedia);}
mediaPower=createMediaPower({start:options=>startSystemMedia(root,options),sessions:()=>sessions.values(),send:async(c,kind,payload)=>{const data=JSON.stringify(payload);if(kind==='panel')await c.evaluate('document.getElementById("codex-wallpaper-controls")?.__cwbSystemMedia?.('+data+');true');else await c.evaluate('window.__codexWallpaperBridge?.'+({metadata:'setSystemMedia',position:'setSystemPosition',spectrum:'setSystemSpectrum'})[kind]+'?.('+data+');true');}});
const configureMedia=async options=>{const effective=effectiveMediaSettings({...settings,systemMedia:options});await mediaPower.configure(effective);if(spectrumTimer){clearInterval(spectrumTimer);spectrumTimer=setInterval(pumpSpectrum,spectrumInterval(effective.audioFps));spectrumTimer.unref();}};
async function reportMedia(c){await c.evaluate('('+installMediaActivity.toString()+')('+JSON.stringify(c.token)+');true');}
async function captureStatic(entry){
 const c=[...sessions.values()].find(c=>c.installed);if(!c)throw Error('当前壁纸尚未显示，无法保存静态画面');let data;
 if(c.webPlayer){const old=await c.webPlayer.sample();await c.webPlayer.pause(false);try{await sleep(150);data=await c.webPlayer.signature();}finally{await c.webPlayer.pause(old.paused);}}
 else data=await evaluateAsync(c,'(()=>{const root=document.getElementById("codex-wallpaper-bridge-layer")?.shadowRoot,source=root?.querySelector("video,img,canvas");if(!source)throw Error("当前画面不可用");const canvas=document.createElement("canvas");canvas.width=source.videoWidth||source.naturalWidth||source.width;canvas.height=source.videoHeight||source.naturalHeight||source.height;if(!canvas.width||!canvas.height)throw Error("当前画面尚未加载");canvas.getContext("2d").drawImage(source,0,0);return canvas.toDataURL("image/png")})()');
 if(!data?.startsWith('data:image/png;base64,'))throw Error('静态画面生成失败，当前背景保持不变');const bytes=Buffer.from(data.split(',')[1],'base64');if(bytes.length<64||bytes.length>32*1024*1024)throw Error('静态画面大小异常');
 const file='media/still-'+entry.id+'-'+randomUUID()+'.png';await writeFile(path.join(root,file),bytes,{flag:'wx'});return file;
}
const actions=createActions(root,settings,applySelected,applyAppearance,{configureMedia,captureStatic,nativeProfile:async(c,projectRoot)=>{c||=[...sessions.values()].find(s=>s.installed);const viewport=c?await c.evaluate('({width:innerWidth*devicePixelRatio,height:innerHeight*devicePixelRatio})'):undefined;return nativeFullProfile(projectRoot,viewport);},controlMedia:async(command,sourceId)=>{if(!settings.systemMedia.enabled||!mediaPower.backend)throw Error('歌曲信息与播放控制未启用');await mediaPower.backend.control(command,{sourceId});}});
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
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),freeze=window.__cwbFrameFreeze(video,video.parentNode);
 const visibility=()=>{if(video.tagName!=='VIDEO')return;if(document.hidden||(config.pauseOnBlur&&!document.hasFocus())||reduced.matches){freeze.hold();video.pause();}else{freeze.release();video.play().catch(e=>{state.error=String(e)})}};
 state.setPauseOnBlur=value=>{config.pauseOnBlur=!!value;visibility()};
 document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',visibility);window.addEventListener('blur',visibility);reduced.addEventListener('change',visibility);
 state.dispose=()=>{freeze.dispose();video.pause?.();video.removeAttribute('src');video.load?.();URL.revokeObjectURL(state.blobUrl);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',visibility);window.removeEventListener('blur',visibility);reduced.removeEventListener('change',visibility)};
 video.addEventListener('error',()=>{state.error=video.error?.message||'Video decode error'});
 video.addEventListener(video.tagName==='VIDEO'?'loadeddata':'load',()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,16,16);const data=ctx.getImageData(0,0,16,16).data;let r=0,g=0,b=0;for(let i=0;i<data.length;i+=4){r+=data[i];g+=data[i+1];b+=data[i+2]}r/=256;g/=256;b/=256;const l=.2126*r+.7152*g+.0722*b,dark=l<145;const tint=v=>Math.round(dark?v*.18:220+v*.12);state.palette={r:tint(r),g:tint(g),b:tint(b),dark};state.ready=true;visibility()},{once:true});video.src=state.blobUrl;video.load?.();return true;
}

async function mount(c,target){
 await c.evaluate('window.__cwbPickerModel='+adapters.picker+';window.__cwbInstallFx='+adapters.fx+';window.__cwbFrameFreeze='+installFrameFreeze.toString()+';window.__cwbDecorate='+decorateShell.toString()+';window.__cwbInstallFeatures='+installFeaturePanel.toString()+';true');
 await c.evaluate('window.__cwbApplyWidgets='+installNativeWidgets.toString()+';true');
 const styleVersion=(await stat(path.join(codeRoot,'wallpaper-style.mjs'))).mtimeMs;
 const {paintShell}=await import('./wallpaper-style.mjs?v='+styleVersion);
 const {installPanel}=await import('./wallpaper-panel.mjs?v='+(await stat(path.join(codeRoot,'wallpaper-panel.mjs'))).mtimeMs);
 const entry=effectiveEntry(settings.library.find(e=>e.id===settings.selectedId));
 if(entry?.mode==='webwallgl'){
  const previous=c.webPlayer,next=await mountWebWallGL(c,entry,{dataRoot:root,config:displaySettings(settings)});c.webPlayer=next;await previous?.dispose();await stopRealtime();c.isRealtime=false;
  settings.palette=await c.evaluate('window.__codexWallpaperBridge.palette');await c.evaluate('('+paintShell.toString()+')('+JSON.stringify(displaySettings(settings))+')');await c.evaluate('('+installPanel.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(c.token)+')');c.installed=true;return;
 }
 if(!entry&&c.webPlayer){await c.webPlayer.dispose();c.webPlayer=null;}
 if(!entry){await stopRealtime();await c.evaluate('window.__cwbDecorations?.dispose();window.__cwbWidgets?.dispose?.();delete window.__cwbWidgets;window.__codexWallpaperBridge?.dispose?.();window.__cwbLayout?.dispose?.();delete window.__cwbLayout;document.getElementById("codex-wallpaper-bridge-layer")?.remove();document.getElementById("codex-wallpaper-bridge-style")?.remove();window.__codexWallpaperBridge={disabled:true,sample:()=>({ready:false,disabled:true,paused:true})};true');await c.evaluate('('+installPanel.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(c.token)+')');c.installed=true;setImmediate(()=>global.gc?.());return}
 if(entry.mode==='realtime'){
  const source=await ensureRealtime(entry);
  try{
  await evaluateAsync(c,'('+installRealtime.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(source.frame.toString('base64'))+','+JSON.stringify({name:source.name,fps:source.profile.fps})+')');
  }catch(error){if(source!==realtime)await source.stop();throw error;}
  if(source!==realtime){const previous=realtime;realtime=source;realtimeKey=source.key;source.onFrame=()=>{if(source===realtime)scheduleStream(0);};if(previous)await previous.stop();}
  if(c.webPlayer){await c.webPlayer.dispose();c.webPlayer=null;}
  if(c.captureObjectId)await c.call('Runtime.releaseObject',{objectId:c.captureObjectId}).catch(()=>{});c.captureObjectId=(await c.call('Runtime.evaluate',{expression:'window.__codexWallpaperBridge',returnByValue:false})).result.objectId;
  settings.palette=await c.evaluate('window.__codexWallpaperBridge.palette');await c.evaluate('('+paintShell.toString()+')('+JSON.stringify(displaySettings(settings))+')');await c.evaluate('('+installPanel.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(c.token)+')');
  c.captureGeneration=(c.captureGeneration||0)+1;c.drawInFlight=0;c.captureBlocked=false;delete c.captureError;c.captureSentSequence=source.sequence;c.captureSequence=source.sequence;c.isRealtime=true;c.capturePaused=false;c.nextCapturePoll=0;c.reportedCaptureError=false;c.installed=true;return;
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
  if(current.ready){await c.evaluate('(()=>{const old=window.__codexWallpaperBridge;old?.dispose?.();document.getElementById("codex-wallpaper-bridge-layer")?.remove();const pending=document.getElementById("codex-wallpaper-bridge-pending");pending.id="codex-wallpaper-bridge-layer";window.__codexWallpaperBridge=window.__cwbPendingMedia;delete window.__cwbPendingMedia;return true})()');if(c.webPlayer){await c.webPlayer.dispose();c.webPlayer=null;}await stopRealtime();settings.palette=await c.evaluate('window.__codexWallpaperBridge.palette');if(!acting)await saveConfig(root,settings);await c.evaluate('('+paintShell.toString()+')('+JSON.stringify(displaySettings(settings))+')');await c.evaluate('('+installPanel.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(c.token)+')');c.installed=true;setImmediate(()=>global.gc?.());return}
  await sleep(100);
 }
 await c.evaluate('window.__cwbPendingMedia?.dispose?.();document.getElementById("codex-wallpaper-bridge-pending")?.remove();delete window.__cwbPendingMedia;true');throw Error('Lightweight video did not decode a first frame');
}

async function tick(){
 if(busy||stopped||acting||streaming)return;busy=true;
 try{
  const list=await(await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(2000)})).json();
  const targets=list.filter(t=>t.type==='page'&&(t.url===appUrl||(appUrl==='app://-/index.html'&&t.url.startsWith('app://-/detached-window.html'))));
  const observations=[];
  const webTargets=list.filter(t=>t.type==='webview'&&t.url.startsWith('https://chatgpt.com/'));
  for(const [id,c]of embeddedSessions)if(!webTargets.some(t=>t.id===id)){c.close();embeddedSessions.delete(id)}
  for(const target of webTargets){try{let c=embeddedSessions.get(target.id);if(!c||c.ws.readyState!==1){c=await connectCdp(target.webSocketDebuggerUrl);embeddedSessions.set(target.id,c)}await c.call('Emulation.setDefaultBackgroundColorOverride',settings.surfaceSync?.embedded===false?{}:{color:{r:0,g:0,b:0,a:0}});await c.evaluate('('+paintEmbedded.toString()+')('+JSON.stringify(displaySettings(settings))+')')}catch(error){status.embeddedError=error.message}}
  if(!targets.length){await stopRealtime();status.phase='waiting-for-target';status.targets=[];await save()}
  for(const [id,c]of sessions)if(!targets.some(t=>t.id===id)){c.close();sessions.delete(id)}
  for(const target of targets){
   const targetState={targetId:target.id,url:target.url,installed:false,ready:false,phase:'waiting-for-shell'};observations.push(targetState);
   if(!new RegExp('^ws://127\\.0\\.0\\.1:'+port+'/devtools/page/[A-Za-z0-9-]+$').test(target.webSocketDebuggerUrl))continue;
   let c=sessions.get(target.id);if(!c||c.ws.readyState!==1){c=await connectCdp(target.webSocketDebuggerUrl);sessions.set(target.id,c);c.token=randomUUID();await c.call('Runtime.addBinding',{name:'__codexWallpaperSend'});c.ws.addEventListener('message',event=>{let e;try{e=JSON.parse(event.data)}catch{return}if(e.method!=='Runtime.bindingCalled')return;if(e.params.name==='__cwbMediaActivitySend'){try{const a=JSON.parse(e.params.payload);if(a.token===c.token)c.mediaActivity=a;}catch{}return;}if(e.params.name!=='__codexWallpaperSend')return;let req;try{req=JSON.parse(e.params.payload)}catch{return}if(req.token!==c.token)return;actionQueue=actionQueue.then(async()=>{while(busy||streaming)await sleep(25);acting=true;try{const result=await actions(c,req);await c.evaluate('window.__cwbReply?.('+Number(req.id)+','+JSON.stringify({ok:true,...result})+')')}catch(error){await c.evaluate('window.__cwbReply?.('+Number(req.id)+','+JSON.stringify({ok:false,error:error.message})+')').catch(()=>{})}finally{await reportMedia(c).catch(()=>{});acting=false}})})}
   if(!await c.evaluate(target.url.startsWith('app://-/detached-window.html')?'!!document.body':'!!document.querySelector("aside.app-shell-left-panel")&&!!document.querySelector("main[data-app-shell-main-surface],main[class*=\\"_MainContentSurface_\\"],main.main-surface")'))continue;
   const tree=await c.call('Page.getFrameTree');
   if(c.loaderId!==tree.frameTree.frame.loaderId){c.loaderId=tree.frameTree.frame.loaderId;c.installed=false;c.captureBlocked=false;c.failed=false;c.retryAt=0;c.failures=0;c.mediaActivity=null;await c.call('Runtime.addBinding',{name:'__cwbMediaActivitySend'});await c.call('Runtime.addBinding',{name:'__codexWallpaperSend'});await alignTaskbar()}
   if(c.retryAt&&Date.now()<c.retryAt){Object.assign(targetState,{phase:'background-retrying',error:c.lastError,retryAt:new Date(c.retryAt).toISOString()});continue;}
   try{
    if(c.isRealtime&&c.captureBlocked){Object.assign(targetState,{phase:'renderer-quarantined',error:c.captureError});continue;}
    if(c.webPlayer&&c.installed){const failure=await c.evaluate('window.__codexWallpaperBridge?.error');if(failure){const fallback=settings.library.find(e=>e.id===settings.realtimeFallbackId&&!['webwallgl','realtime'].includes(e.mode));settings.selectedId=fallback?.id||null;await mount(c,target);await configureMedia(settings.systemMedia);await saveConfig(root,settings);await c.evaluate('document.getElementById("codex-wallpaper-controls")?.__cwbRuntimeError?.('+JSON.stringify('WebGL 场景错误：'+failure+'；已恢复可用背景。')+');true');}}
    const healthy=await c.evaluate('(()=>{const s=window.__codexWallpaperBridge,controls=document.getElementById("codex-wallpaper-controls");if(!s||s.error||!controls?.isConnected)return false;if(s.disabled)return true;const layer=document.getElementById("codex-wallpaper-bridge-layer");return !!(layer?.isConnected&&layer.shadowRoot?.firstElementChild?.isConnected&&document.getElementById("codex-wallpaper-bridge-style")?.isConnected)})()');
    if(!healthy)c.installed=false;
    if(!c.installed){await mount(c,target);c.activeKey=activeWallpaperKey();}
    await reportMedia(c);const observed=await c.evaluate('window.__codexWallpaperBridge?.sample()');
    if(!observed){c.installed=false;continue}
    targetState.phase=observed.disabled?'background-disabled':observed.mode==='realtime'?(realtime?.error?'realtime-source-error':observed.paused?'realtime-capture-paused':Date.now()-realtime.lastFrameAt>10000?'realtime-no-new-frames':'realtime-capture-active'):'background-rendered';Object.assign(targetState,{installed:true,...observed,...(c.isRealtime?{delivery:c.captureTiming,deliveryError:c.captureError}:{} )});
    if(observed.mode==='realtime'){
     const age=Math.max(0,Math.floor((Date.now()-(realtime?.lastFrameAt||Date.now()))/1000));
     const note=`实时输出：${observed.width} × ${observed.height}，采集上限 ${observed.captureFps} FPS，已绘制 ${observed.frames} 帧。`+(observed.paused?'当前暂停采集/绘制，源引擎仍可能运行。':age>10?`已 ${age} 秒没有新画面，请检查源窗口或 Wallpaper Engine 暂停规则。`:'');
     await c.evaluate('document.getElementById("codex-wallpaper-controls")?.__cwbCaptureStats?.('+JSON.stringify(note)+');true');
    }
    c.failures=0;c.retryAt=0;delete status.error;
   }catch(error){c.installed=false;c.failures=(c.failures||0)+1;c.retryAt=Date.now()+Math.min(30000,1000*2**Math.min(c.failures-1,5));c.lastError=error.message;Object.assign(targetState,{phase:'background-retrying',error:error.message,retryAt:new Date(c.retryAt).toISOString()});}
  }
  status.targets=observations;const usable=observations.filter(t=>t.installed);status.phase=usable.some(t=>t.phase==='realtime-capture-active')?'realtime-capture-active':usable.find(t=>t.phase==='background-rendered')?.phase||usable[0]?.phase||(observations.length?'background-retrying':'waiting-for-target');status.targetErrors=observations.filter(t=>t.error).map(t=>({targetId:t.targetId,error:t.error}));status.selectedId=settings.selectedId;status.source=realtime?'native-window-capture-jpeg':usable.some(t=>t.mode==='webwallgl')?'sandboxed-webwallgl':'native-media-blob';status.realtime=realtime?{sourceWindow:realtime.name,sequence:realtime.sequence,lastFrameAt:realtime.lastFrameAt,hwnd:realtime.hwnd,error:realtime.error,profile:realtime.profile,desktop:realtime.desktop}:null;await save();
 }catch(error){status.phase='waiting-for-cdp';status.error=error.message;await save()}
 finally{busy=false}
}
let rotationAt=0,rotationKey='',rotating=false;
rotationTimer=setInterval(()=>{
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
await save();await tick();await configureMedia(settings.systemMedia).catch(()=>{});
let spectrumBusy=false;
async function pumpSpectrum(){if(spectrumBusy||stopped||busy||acting||streaming)return;spectrumBusy=true;try{await mediaPower.tick();}catch(error){status.mediaDeliveryError=error.message;}finally{spectrumBusy=false;}}
spectrumTimer=setInterval(pumpSpectrum,spectrumInterval(effectiveMediaSettings(settings).audioFps));spectrumTimer.unref();
timer=setInterval(tick,5000);
