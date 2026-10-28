import {access,mkdir,readFile,realpath,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {connectPipe} from './cdp-pipe.mjs';
import {realtimeProfile} from './realtime-source.mjs';
import {effectivePropertyValues} from './wallpaper-properties.mjs';
import {createServeKit} from '../vendor/dsh-wallpaper/serve.js';

const slots=new Set(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rtcGuard="for(const key of ['RTCPeerConnection','webkitRTCPeerConnection'])try{Object.defineProperty(globalThis,key,{value:undefined,writable:false,configurable:false})}catch{}";
async function browserExecutable(){
 const candidates=[process.env.CODEX_WALLPAPER_CHROMIUM,path.join(process.env.ProgramFiles||'C:/Program Files','Google/Chrome/Application/chrome.exe'),path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')].filter(Boolean);
 for(const candidate of candidates)try{await access(candidate);return candidate;}catch{}
 throw Error('网页浏览器模式需要已安装的 Chrome 或 Edge');
}
const inside=(root,file)=>{const relative=path.relative(root,file);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);};
// Own loopback assets and an opaque iframe. No author code is evaluated in Codex.
export async function startBrowserWeb(entry,dataRoot,{isCurrent=()=>true}={}){
 const assertCurrent=()=>{if(!isCurrent())throw Object.assign(Error('已跳过先前的选择'),{code:'CWB_SELECTION_SUPERSEDED'});};assertCurrent();
 const profile=realtimeProfile(entry.limits),root=await realpath(entry.projectRoot),metadata=await realpath(path.join(root,'project.json'));
 if(!inside(root,metadata)||(await stat(metadata)).size>1024*1024)throw Error('网页项目元数据无效');
 const project=JSON.parse(await readFile(metadata,'utf8'));
 if(String(project.type).toLowerCase()!=='web'||typeof project.file!=='string'||path.isAbsolute(project.file)||!/^\.html?$/i.test(path.extname(project.file)))throw Error('此模式仅支持本地 HTML 网页项目');
 const html=await realpath(path.resolve(root,project.file));if(!inside(root,html)||(await stat(html)).size>8*1024*1024)throw Error('网页入口越界或超过 8 MiB');
 // Upstream injects before author scripts. Refuse author meta CSP here rather
 // than accidentally running a shim before that policy takes effect.
 const policyText=(await readFile(html,'utf8')).replace(/&#(?:x([a-f\d]+)|(\d+));?/gi,(match,hex,decimal)=>{const value=parseInt(hex||decimal,hex?16:10);return value<=0x10ffff?String.fromCodePoint(value):match;}).replace(/&(?:Tab|NewLine);/g,' ');
 if(/http-equiv\s*=\s*["']?content-security-policy\b/i.test(policyText))throw Error('网页包含作者 CSP；试验模式保留其限制，请改用原版兼容模式');
 const executable=await browserExecutable(),slot=[0,1].find(value=>!slots.has(value));if(slot===undefined)throw Error('网页渲染器正在切换，请稍后重试');slots.add(slot);
 const runtime={name:'CodexWallpaperWeb-'+randomUUID(),kind:'chromium-web',transport:'chromium-screencast-jpeg',profile,frame:null,sequence:0,lastFrameAt:0,error:null,paused:false,closed:false,starting:false,diagnostics:[]};
 const note=(kind,detail)=>{runtime.diagnostics.push({kind,detail:String(detail).slice(0,240)});runtime.diagnostics=runtime.diagnostics.slice(-12);};
 const token=randomUUID(),wrapperToken=randomUUID(),nonce=randomUUID(),BASE='/wallpaper-engine',assetPrefix=BASE+'/scene-files/'+token+'/',activeStreams=new Set();
 let server,origin,browser=null,control=Promise.resolve(),controlRevision=0,stopPromise,servedEntry=false,wire;
 const shim=await readFile(new URL('../vendor/webwallgl/web-shim.js',import.meta.url),'utf8').catch(error=>{slots.delete(slot);throw error;});
 const kit=createServeKit({BASE,activeStreams,mediaMap:new Map([[token,metadata]]),log:{warn:value=>note('asset',value)},appendDiagLine:()=>{},traceRequests:()=>{},traceMediaRequests:()=>{},readWebShim:()=>shim,buildSeedScript:()=>`window.__weSetFps(${profile.fps});window.__weSetVolume(0);window.__weSeedProps(${JSON.stringify(wire)});`});
 const entryPath=path.relative(root,html).split(path.sep).map(encodeURIComponent).join('/');
 const closeBrowser=async()=>{
  const owned=browser;if(!owned)return;browser=null;
  await owned.cdp.call('Browser.close',{},undefined,1500).catch(()=>{});
  if(owned.child.exitCode===null)await Promise.race([new Promise(resolve=>owned.child.once('exit',resolve)),sleep(1000)]);
  if(owned.child.exitCode===null)owned.child.kill();
  if(owned.child.exitCode===null)await Promise.race([new Promise(resolve=>owned.child.once('exit',resolve)),sleep(1000)]);
 };
 const launch=async(revision=controlRevision)=>{
  const wanted=()=>!runtime.closed&&!runtime.paused&&revision===controlRevision;
  if(!wanted())return;runtime.starting=true;servedEntry=false;
  wire=Object.fromEntries(Object.entries(effectivePropertyValues(project,entry.userProperties||{})).map(([key,value])=>[key,{value}]));
  try{
   const directory=path.join(dataRoot,'web-runtime','profile-'+slot);await mkdir(directory,{recursive:true});
   if(!wanted())return;
   const child=spawn(executable,['--headless=new','--remote-debugging-pipe','--user-data-dir='+directory,'--incognito','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-sync','--mute-audio','--disk-cache-size=16777216','--window-size='+profile.maxWidth+','+profile.maxHeight],{windowsHide:true,stdio:['ignore','ignore','ignore','pipe','pipe']});
   const cdp=connectPipe(child),owned=browser={child,cdp};runtime.browserPid=child.pid;let lastAccepted=0;
   cdp.listen(event=>{
    if(browser!==owned||runtime.closed)return;
    if(event.method==='CWB.pipeClosed'){runtime.error=event.params.message;return;}
    if(event.method==='Target.attachedToTarget'){
     const targetSession=event.params.sessionId;
     (async()=>{await cdp.call('Network.enable',{},targetSession);if(['iframe','page'].includes(event.params.targetInfo.type)){await cdp.call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},targetSession);await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:rtcGuard},targetSession);await cdp.call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},targetSession);}else{await cdp.call('Network.setBlockedURLs',{urls:['*']},targetSession);}await cdp.call('Runtime.runIfWaitingForDebugger',{},targetSession);})().catch(error=>{if(browser===owned)runtime.error='网页子页面隔离未就绪：'+error.message;});return;
    }
    if(event.method==='Network.loadingFailed'&&['csp','inspector'].includes(event.params.blockedReason)){runtime.error='网页请求外部资源或不受支持的资源类型，试验模式仅支持本地资源，worker 不联网；请改用原版兼容模式';return;}
    if(event.method==='Fetch.requestPaused'){
     const request=event.params,allowed=request.request.url.startsWith(origin+assetPrefix)||request.request.url===origin+'/'+wrapperToken;
     if(!allowed){note('blocked-request',request.resourceType);runtime.error='网页请求外部资源，试验模式仅支持本地资源；请改用原版兼容模式';}
     cdp.call(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:request.requestId}:{requestId:request.requestId,errorReason:'BlockedByClient'},event.sessionId).catch(error=>{if(browser===owned)note('request',error.message);});return;
    }
    if(event.method!=='Page.screencastFrame')return;
    cdp.call('Page.screencastFrameAck',{sessionId:event.params.sessionId},event.sessionId,3000).then(()=>{runtime.framesAcked=(runtime.framesAcked||0)+1;}).catch(error=>{if(browser===owned)runtime.error=error.message;});
    runtime.framesReceived=(runtime.framesReceived||0)+1;
    const now=Date.now();if(runtime.paused||now-lastAccepted<1000/profile.fps||!event.params.data||event.params.data.length>16*1024*1024)return;
    lastAccepted=now;runtime.frame=Buffer.from(event.params.data,'base64');runtime.sequence++;runtime.lastFrameAt=now;runtime.frameInfo={receivedAt:now};runtime.onFrame?.();
   });
   await cdp.call('Browser.setDownloadBehavior',{behavior:'deny'});
   const target=await cdp.call('Target.createTarget',{url:'about:blank'}),attached=await cdp.call('Target.attachToTarget',{targetId:target.targetId,flatten:true}),session=attached.sessionId;
   await cdp.call('Page.enable',{},session);await cdp.call('Network.enable',{},session);await cdp.call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},session);
   await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:rtcGuard},session);
   await cdp.call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);
   await cdp.call('Emulation.setDeviceMetricsOverride',{width:profile.maxWidth,height:profile.maxHeight,deviceScaleFactor:1,mobile:false},session);
   await cdp.call('Page.navigate',{url:origin+'/'+wrapperToken},session);
   const deadline=Date.now()+20000;
   while(Date.now()<deadline){
    if(!wanted())return;if(runtime.sequence===0)assertCurrent();if(runtime.error)throw Error(runtime.error);
    const result=await cdp.call('Runtime.evaluate',{expression:'window.__webReady === true',returnByValue:true},session).catch(error=>{if(/context.*destroyed|cannot find context|not attached to an active page/i.test(error.message))return {};throw error;});
    if(result.result?.value&&servedEntry)break;await sleep(50);
   }
   if(!wanted())return;if(runtime.error)throw Error(runtime.error);
   const ready=await cdp.call('Runtime.evaluate',{expression:'window.__webReady === true',returnByValue:true},session);if(!ready.result?.value||!servedEntry)throw Error('网页入口或兼容 API 未就绪；请改用原版兼容模式');
   const before=runtime.sequence;
   await cdp.call('Page.startScreencast',{format:'jpeg',quality:profile.jpegQuality||92,maxWidth:profile.maxWidth,maxHeight:profile.maxHeight,everyNthFrame:1},session);
   while(runtime.sequence===before&&Date.now()<deadline){if(!wanted())return;if(before===0)assertCurrent();if(runtime.error)throw Error(runtime.error);await sleep(25);}
   if(runtime.error)throw Error(runtime.error);
   if(runtime.sequence===before&&!runtime.closed&&!runtime.paused)throw Error('网页首帧超时；保留当前背景');
  }finally{runtime.starting=false;}
 };
 runtime.setPaused=paused=>{
  if(runtime.closed||runtime.paused===!!paused)return;runtime.paused=!!paused;const revision=++controlRevision;
  control=control.then(async()=>{if(revision!==controlRevision||runtime.closed)return;await closeBrowser();if(revision===controlRevision&&!runtime.paused&&!runtime.closed){runtime.resumedAt=Date.now();await launch(revision);}}).catch(async error=>{runtime.error=error.message;await closeBrowser();});
 };
 runtime.stop=()=>stopPromise??=(async()=>{
  runtime.closed=true;runtime.paused=true;await closeBrowser();await control;await closeBrowser();for(const stream of activeStreams)stream.destroy();activeStreams.clear();
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}runtime.frame=null;runtime.base64=null;slots.delete(slot);
 })();
 try{
  server=createServer((req,res)=>{
   const fail=code=>{res.statusCode=code;res.end();};
   if(!origin||req.headers.host!==new URL(origin).host||!['GET','HEAD','OPTIONS'].includes(req.method))return fail(403);
   let pathname;try{pathname=new URL(req.url,'http://local').pathname;}catch{return fail(400);}
   res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), usb=(), serial=()');res.setHeader('X-Content-Type-Options','nosniff');
   if(pathname==='/'+wrapperToken){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-src ${origin}`);
    res.end(`<!doctype html><html><head><style>html,body,iframe{width:100%;height:100%;border:0;margin:0;overflow:hidden;background:#000}</style></head><body><iframe sandbox="allow-scripts" src="${assetPrefix+entryPath}"></iframe><script nonce="${nonce}">const f=document.querySelector('iframe'),t=${JSON.stringify(nonce)};window.addEventListener('message',e=>{if(e.source===f.contentWindow&&e.data?.__we===1&&e.data.op==='we-pong'&&e.data.t===t)requestAnimationFrame(()=>requestAnimationFrame(()=>window.__webReady=true));});f.onload=()=>f.contentWindow.postMessage({__we:1,op:'ping',t},'*');</script></body></html>`);return;
   }
   if(!pathname.startsWith(assetPrefix))return fail(404);
   res.setHeader('Content-Security-Policy',`sandbox allow-scripts; default-src 'none'; script-src ${origin} blob: 'unsafe-inline' 'unsafe-eval'; style-src ${origin} 'unsafe-inline'; img-src ${origin} data: blob:; media-src ${origin} data: blob:; font-src ${origin} data:; connect-src ${origin}; worker-src blob:; frame-src 'none'; object-src 'none'; base-uri ${origin}; form-action 'none'`);
   res.once('finish',()=>{if(pathname===assetPrefix+entryPath&&res.statusCode===200)servedEntry=true;if(res.statusCode>=400){note('asset-status',res.statusCode);if(['document','script','style'].includes(req.headers['sec-fetch-dest']))runtime.error='网页必要资源加载失败：HTTP '+res.statusCode+'；请改用原版兼容模式';}});
   try{kit.handleSceneFiles(req,res,'media');}catch(error){note('serve',error.message);if(!res.headersSent)res.statusCode=500;res.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;
  await launch();assertCurrent();return runtime;
 }catch(error){await runtime.stop();throw error;}
}
