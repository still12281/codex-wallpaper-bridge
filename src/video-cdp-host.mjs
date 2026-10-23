import {getDataRoot,loadSettings} from './runtime-paths.mjs';
import {readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {connectCdp} from './cdp-client.mjs';
import {paintShell} from './wallpaper-style.mjs';
import {installPanel} from './wallpaper-panel.mjs';
import {normalizeLibrary,createActions,saveConfig} from './wallpaper-actions.mjs';
import {randomUUID} from 'node:crypto';

const codeRoot=path.dirname(fileURLToPath(import.meta.url));
const root=getDataRoot();
const settings=await loadSettings(root);
normalizeLibrary(settings);await saveConfig(root,settings);
const arg=process.argv.indexOf('--cdp-port'),port=Number(process.argv[arg+1]);
if(arg<0||!Number.isInteger(port)||port<1024||port>65535)throw Error('Expected --cdp-port');
const testArg=process.argv.indexOf('--test-url');const appUrl=testArg>=0?process.argv[testArg+1]:'app://-/index.html';
const version=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();
const status={pid:process.pid,browserId:version.webSocketDebuggerUrl.split('/').pop(),source:'native-video-blob',phase:'connecting',cdpPort:port,wallpaperId:settings.wallpaperId,targets:[]};
const save=async()=>{status.updatedAt=new Date().toISOString();await writeFile(path.join(root,'runtime-status.json'),JSON.stringify(status,null,2))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sessions=new Map();let busy=false,stopped=false,acting=false,actionQueue=Promise.resolve();
const actions=createActions(root,settings,async()=>{for(const [id,c]of sessions){c.installed=false;await mount(c,{id})}});

function prepareLayer(size,mime){
 const old=window.__codexWallpaperBridge;
 old?.dispose?.();
 for(const id of ['codex-wallpaper-bridge-frame','codex-wallpaper-bridge-layer','codex-wallpaper-bridge-style'])document.getElementById(id)?.remove();
 if(old?.blobUrl)URL.revokeObjectURL(old.blobUrl);
 const layer=document.createElement('div');layer.id='codex-wallpaper-bridge-layer';layer.setAttribute('aria-hidden','true');
 layer.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0';
 const shadow=layer.attachShadow({mode:'open'});
 const video=document.createElement(mime.startsWith('video/')?'video':'img');if(video.tagName==='VIDEO'){video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto';video.disablePictureInPicture=true}video.tabIndex=-1;
 video.style.cssText='width:100%;height:100%;object-fit:cover;display:block;pointer-events:none';shadow.append(video);document.body.prepend(layer);
 const state=window.__codexWallpaperBridge={installed:true,ready:false,mime,transport:'native-media-blob',bytes:new Uint8Array(size)};
 state.sample=()=>{const q=video.getVideoPlaybackQuality?.();return {ready:state.ready,paused:video.paused,time:video.currentTime,width:video.videoWidth||video.naturalWidth,height:video.videoHeight||video.naturalHeight,quality:q?{total:q.totalVideoFrames,dropped:q.droppedVideoFrames}:null,hidden:document.hidden,focused:document.hasFocus()}};
 return true;
}

function startVideo(config){
 const state=window.__codexWallpaperBridge,video=document.getElementById('codex-wallpaper-bridge-layer').shadowRoot.firstElementChild;
 state.blobUrl=URL.createObjectURL(new Blob([state.bytes],{type:state.mime}));delete state.bytes;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const visibility=()=>{if(video.tagName!=='VIDEO')return;if(document.hidden||(config.pauseOnBlur&&!document.hasFocus())||reduced.matches)video.pause();else video.play().catch(e=>{state.error=String(e)})};
 document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',visibility);window.addEventListener('blur',visibility);reduced.addEventListener('change',visibility);
 state.dispose=()=>{video.pause?.();video.removeAttribute('src');video.load?.();URL.revokeObjectURL(state.blobUrl);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',visibility);window.removeEventListener('blur',visibility);reduced.removeEventListener('change',visibility)};
 video.addEventListener('error',()=>{state.error=video.error?.message||'Video decode error'});
 video.addEventListener(video.tagName==='VIDEO'?'loadeddata':'load',()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,16,16);const data=ctx.getImageData(0,0,16,16).data;let r=0,g=0,b=0;for(let i=0;i<data.length;i+=4){r+=data[i];g+=data[i+1];b+=data[i+2]}r/=256;g/=256;b/=256;const l=.2126*r+.7152*g+.0722*b,dark=l<145;const tint=v=>Math.round(dark?v*.18:220+v*.12);state.palette={r:tint(r),g:tint(g),b:tint(b),dark};state.ready=true;visibility()},{once:true});video.src=state.blobUrl;video.load?.();return true;
}

async function mount(c,target){
 const styleVersion=(await stat(path.join(codeRoot,'wallpaper-style.mjs'))).mtimeMs;
 const {paintShell}=await import('./wallpaper-style.mjs?v='+styleVersion);
 const entry=settings.library.find(e=>e.id===settings.selectedId);
 if(!entry){await c.evaluate('window.__codexWallpaperBridge?.dispose?.();window.__cwbLayout?.dispose?.();delete window.__cwbLayout;document.getElementById("codex-wallpaper-bridge-layer")?.remove();document.getElementById("codex-wallpaper-bridge-style")?.remove();window.__codexWallpaperBridge={disabled:true,sample:()=>({ready:false,disabled:true,paused:true})};true');await c.evaluate('('+installPanel.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(c.token)+')');c.installed=true;return}
 const mediaPath=path.resolve(root,entry.file);const mediaLimit=Math.min(128*1024*1024,entry.limits?.maxBytes||32*1024*1024);if(!mediaPath.startsWith(root+path.sep)||(await stat(mediaPath)).size>mediaLimit)throw Error('Unsupported local media path or size');
 const media=await readFile(mediaPath);status.mediaBytes=media.length;
 status.phase='loading-lightweight-video';delete status.error;await save();
 await c.evaluate('('+prepareLayer.toString()+')('+media.length+','+JSON.stringify(entry.mime)+')');
 const size=512*1024;
 for(let offset=0;offset<media.length;offset+=size){
  const base64=media.subarray(offset,offset+size).toString('base64');
  await c.evaluate('(()=>{const s=atob('+JSON.stringify(base64)+'),a=window.__codexWallpaperBridge.bytes;for(let i=0;i<s.length;i++)a['+offset+'+i]=s.charCodeAt(i);return true})()');
 }
 await c.evaluate('('+startVideo.toString()+')('+JSON.stringify(settings)+')');
 for(let i=0;i<40;i++){
  const current=await c.evaluate('({error:window.__codexWallpaperBridge?.error,...window.__codexWallpaperBridge?.sample()})');
  if(current.error)throw Error(current.error);
  if(current.ready){settings.palette=await c.evaluate('window.__codexWallpaperBridge.palette');if(!acting)await saveConfig(root,settings);await c.evaluate('('+paintShell.toString()+')('+JSON.stringify(settings)+')');await c.evaluate('('+installPanel.toString()+')('+JSON.stringify(settings)+','+JSON.stringify(c.token)+')');c.installed=true;return}
  await sleep(100);
 }
 throw Error('Lightweight video did not decode a first frame');
}

async function tick(){
 if(busy||stopped||acting)return;busy=true;
 try{
  const list=await(await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(2000)})).json();
  const targets=list.filter(t=>t.type==='page'&&t.url===appUrl);
  for(const [id,c]of sessions)if(!targets.some(t=>t.id===id)){c.close();sessions.delete(id)}
  for(const target of targets){
   if(!new RegExp('^ws://127\\.0\\.0\\.1:'+port+'/devtools/page/[A-Za-z0-9-]+$').test(target.webSocketDebuggerUrl))continue;
   let c=sessions.get(target.id);if(!c||c.ws.readyState!==1){c=await connectCdp(target.webSocketDebuggerUrl);sessions.set(target.id,c);c.token=randomUUID();await c.call('Runtime.addBinding',{name:'__codexWallpaperSend'});c.ws.addEventListener('message',event=>{let e;try{e=JSON.parse(event.data)}catch{return}if(e.method!=='Runtime.bindingCalled'||e.params.name!=='__codexWallpaperSend')return;let req;try{req=JSON.parse(e.params.payload)}catch{return}if(req.token!==c.token)return;actionQueue=actionQueue.then(async()=>{while(busy)await sleep(25);acting=true;try{const result=await actions(c,req);await c.evaluate('window.__cwbReply?.('+Number(req.id)+','+JSON.stringify({ok:true,...result})+')')}catch(error){await c.evaluate('window.__cwbReply?.('+Number(req.id)+','+JSON.stringify({ok:false,error:error.message})+')').catch(()=>{})}finally{acting=false}})})}
   if(!await c.evaluate('!!document.querySelector("aside.app-shell-left-panel")&&!!document.querySelector("main[data-app-shell-main-surface],main[class*=\\"_MainContentSurface_\\"],main.main-surface")'))continue;
   const tree=await c.call('Page.getFrameTree');
   if(c.loaderId!==tree.frameTree.frame.loaderId){c.loaderId=tree.frameTree.frame.loaderId;c.installed=false;c.failed=false;await c.call('Runtime.addBinding',{name:'__codexWallpaperSend'})}
   if(c.failed)continue;
   try{
    if(!c.installed)await mount(c,target);
    const observed=await c.evaluate('window.__codexWallpaperBridge?.sample()');
    if(!observed){c.installed=false;continue}
    status.phase=observed.disabled?'background-disabled':'background-rendered';status.targets=[{targetId:target.id,installed:true,...observed}];await save();
   }catch(error){c.failed=true;status.phase='background-failed';status.error=error.message;await save();await c.evaluate('window.__codexWallpaperBridge?.dispose?.();document.getElementById("codex-wallpaper-bridge-layer")?.remove();document.getElementById("codex-wallpaper-bridge-style")?.remove();delete window.__codexWallpaperBridge;true').catch(()=>{})}
  }
 }catch(error){status.phase='waiting-for-cdp';status.error=error.message;await save()}
 finally{busy=false}
}
await save();await tick();const timer=setInterval(tick,5000);
const stop=()=>{stopped=true;clearInterval(timer);for(const c of sessions.values())c.close()};process.on('SIGINT',stop);process.on('SIGTERM',stop);
