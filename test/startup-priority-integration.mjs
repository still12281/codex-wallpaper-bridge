// Isolated Chrome + generated pages only. Never connects to the user's client.
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {paintShell} from '../src/wallpaper-style.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){try{const value=await fn();if(value)return value}catch{}await sleep(25)}throw Error('Startup fixture timed out')}
let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME;
for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){if(chrome)break;const file=path.join(base,'Google/Chrome/Application/chrome.exe');try{await access(file);chrome=file}catch{}}
if(!chrome)throw Error('Isolated Chrome fixture unavailable');
const baseline=process.argv.includes('--baseline'),results=[];
for(const scenario of process.argv.includes('--webgl-exit-only')?['webgl-exit']:['auxiliary','shell','early-shell']){
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-startup-')),data=path.join(root,'data');await mkdir(data);
 const html=path.join(root,'shell.html'),blockerHtml=path.join(root,'auxiliary.html');
 await writeFile(html,'<!doctype html><body><aside class="app-shell-left-panel"></aside><main data-app-shell-main-surface>Generated startup fixture</main></body>');
 await writeFile(blockerHtml,'<!doctype html><body>Generated paused auxiliary fixture</body>');
 const early=scenario==='early-shell',webgl=scenario==='webgl-exit';
 if(early){await mkdir(path.join(data,'media'));await writeFile(path.join(data,'media/fixture.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#123456"/></svg>');}
 const project=path.join(root,'project');
 if(webgl){await mkdir(project);await writeFile(path.join(project,'project.json'),JSON.stringify({type:'scene',title:'Generated exit fixture',file:'scene.json'}));await writeFile(path.join(project,'scene.json'),JSON.stringify({camera:{center:'0 0 -1',eye:'0 0 0',up:'0 1 0'},general:{clearcolor:'0.2 0.4 0.6',orthogonalprojection:{width:640,height:360}},objects:[]}));}
 await writeFile(path.join(data,'settings.json'),JSON.stringify({library:early?[{id:'generated-image',name:'Generated image',file:'media/fixture.svg',mime:'image/svg+xml'}]:webgl?[{id:'generated-webgl',name:'Generated WebGL',mode:'webwallgl',projectRoot:project,limits:{maxWidth:640,fps:24}}]:[],selectedId:early?'generated-image':webgl?'generated-webgl':null,systemMedia:{enabled:false,audio:false}}));
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const url=pathToFileURL(html).href,auxUrl=pathToFileURL(blockerHtml).href;
 let browser,host,browserCdp,main,aux,resumeTimer,errors='';
 try{
  browser=spawn(chrome,['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking',...(webgl?['--enable-unsafe-swiftshader']:[]),'--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(root,'profile'),url],{windowsHide:true,stdio:'ignore'});
  const version=await until(async()=>{const r=await fetch('http://127.0.0.1:'+port+'/json/version');return r.json()});browserCdp=await connectCdp(version.webSocketDebuggerUrl);
  const mainTarget=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url));main=await connectCdp(mainTarget.webSocketDebuggerUrl);
  // The target URL may update before the old about:blank document is replaced.
  await until(()=>main.evaluate('location.href==='+JSON.stringify(url)+'&&document.readyState==="complete"&&!!document.querySelector("aside.app-shell-left-panel")&&!!document.querySelector("main[data-app-shell-main-surface]")'));
  const preloader=path.join(root,'fixture-preloader.mjs');let auxId='';
  if(scenario==='auxiliary'){
   const created=await browserCdp.call('Target.createTarget',{url:auxUrl,background:true});auxId=created.targetId;
   const auxTarget=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.id===auxId));aux=await connectCdp(auxTarget.webSocketDebuggerUrl);
   await aux.call('Debugger.enable');await aux.call('Debugger.pause');
   // Only this fixture host sees the paused local page classified as a webview.
   // No request is made to the classification URL.
   await writeFile(preloader,`const fetchOriginal=globalThis.fetch;globalThis.fetch=async(...args)=>{const response=await fetchOriginal(...args);if(String(args[0])!=='http://127.0.0.1:${port}/json/list')return response;const list=await response.json();for(const t of list)if(t.id===${JSON.stringify(auxId)}){t.type='webview';t.url='https://chatgpt.com/fixture';}return new Response(JSON.stringify(list));};`);
  }else if(early){
   await writeFile(preloader,'// Early body fixture has no native shell until after the first frame.');
   await main.evaluate('document.querySelector("aside").remove();document.querySelector("main").remove();document.documentElement.style.setProperty("color-scheme","light","important");document.documentElement.classList.add("native-fixture");document.head.insertAdjacentHTML("beforeend",\'<style>:root{--app-color-text-foreground:#1a1c1f}:root[data-theme="dark"]{--app-color-text-foreground:#dfdfdf}body{color:var(--app-color-text-foreground)}</style>\');true');
  }else{
   await writeFile(preloader,'// No target substitution in the delayed-shell scenario.');
   await main.evaluate('document.querySelector("aside").remove();document.querySelector("main").remove();setTimeout(()=>{document.body.innerHTML=\'<aside class="app-shell-left-panel"></aside><main data-app-shell-main-surface>Delayed fixture</main>\'},1000);true');
  }
  const started=performance.now();
  host=spawn(process.execPath,['--import',pathToFileURL(preloader).href,path.resolve('src/video-cdp-host.mjs'),'--cdp-port',String(port),'--test-url',url],{env:{...process.env,CODEX_WALLPAPER_DATA_DIR:data},windowsHide:true,stdio:['ignore','ignore','pipe']});host.stderr.on('data',b=>errors+=b.toString());
  if(aux)resumeTimer=setTimeout(()=>void aux.call('Debugger.resume').catch(()=>{}),4000);
  const state=await until(async()=>{const s=JSON.parse(await readFile(path.join(data,'runtime-status.json'),'utf8'));return s.targets.some(t=>t.targetId===mainTarget.id&&t.installed)&&s});
  const readyAfterMs=performance.now()-started;
  if(!baseline)assert(readyAfterMs<(webgl?15000:2500),scenario+' delayed the primary page: '+readyAfterMs+' ms');
  const observation={scenario,readyAfterMs,auxiliaryResumeAfterMs:scenario==='auxiliary'?4000:null,startup:state.startup};results.push(observation);
  if(webgl){assert(state.targets.some(t=>t.mode==='webwallgl'&&t.ready));observation.realWebglCleanup=true;}
  if(early){
   assert(await main.evaluate('!document.querySelector("aside")&&!!window.__codexWallpaperBridge?.ready&&!!document.getElementById("codex-wallpaper-bridge-style")&&!window.__cwbWidgets'),'Wallpaper did not paint before shell, or native widgets initialized too early');
   await main.evaluate('window.__earlyLayer=document.getElementById("codex-wallpaper-bridge-layer");document.body.insertAdjacentHTML("beforeend",\'<aside class="app-shell-left-panel"></aside><main data-app-shell-main-surface>Late shell</main><div class="_ApplicationMenuTopBar_fixture"><div role="menubar"></div></div>\');true');
   await until(()=>main.evaluate('document.getElementById("codex-wallpaper-controls")?.previousElementSibling?.getAttribute("role")==="menubar"'));
   assert(await main.evaluate('window.__earlyLayer===document.getElementById("codex-wallpaper-bridge-layer")&&window.__codexWallpaperBridge.ready'),'Late shell replaced the ready wallpaper');
   observation.wallpaperBeforeShell=true;observation.panelPlacedAfterShell=true;
   // Reproduce native hydration changing the theme AFTER an early first frame.
   await main.evaluate('window.__earlyGuard=window.__cwbThemeGuard;window.__themeMutations=0;window.__themeCounter=new MutationObserver(m=>__themeMutations+=m.length);__themeCounter.observe(document.documentElement,{attributes:true});document.documentElement.setAttribute("data-theme","light");document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";document.documentElement.style.setProperty("--native-fixture-value","preserved");true');
   await until(()=>main.evaluate('document.documentElement.getAttribute("data-theme")==="dark"&&document.documentElement.classList.contains("dark")&&getComputedStyle(document.body).color==="rgb(223, 223, 223)"'));
   const mutations=await main.evaluate('__themeMutations');await sleep(100);assert.equal(await main.evaluate('__themeMutations'),mutations,'Theme repair did not settle');
   for(const dark of [false,true]){
    await main.evaluate('('+paintShell.toString()+')('+JSON.stringify({palette:{r:20,g:22,b:28,dark},darkOverlay:.4,lightOverlay:.4})+')');
    assert(await main.evaluate('window.__earlyGuard===window.__cwbThemeGuard&&document.documentElement.getAttribute("data-theme")==='+JSON.stringify(dark?'dark':'light')),'Repeated paint replaced the guard or lost the selected theme');
   }
   await main.evaluate('__themeCounter.disconnect();__cwbThemeGuard.dispose();true');
   assert(await main.evaluate('!document.documentElement.hasAttribute("data-theme")&&!document.documentElement.classList.contains("dark")&&document.documentElement.classList.contains("native-fixture")&&document.documentElement.style.colorScheme==="light"&&document.documentElement.style.getPropertyPriority("color-scheme")==="important"&&document.documentElement.style.getPropertyValue("--native-fixture-value")==="preserved"'),'Theme disposal lost original theme/priority or unrelated native state');
   await main.evaluate('document.documentElement.setAttribute("data-theme","light");true');await sleep(50);assert.equal(await main.evaluate('document.documentElement.getAttribute("data-theme")'),'light');
   observation.lateNativeThemeRepaired=true;observation.nativeTextColourVerified=true;observation.themeObserverSettled=true;observation.themeSnapshotRestored=true;
  }
  if(aux&&!baseline){
   await main.evaluate('window.__fixtureReply=null;const reply=window.__cwbReply;window.__cwbReply=(id,result)=>{if(id===999999)window.__fixtureReply=result;reply(id,result)};window.__codexWallpaperSend(JSON.stringify({token:document.getElementById("codex-wallpaper-controls").__cwbToken,id:999999,action:"surface-sync",region:"embedded",enabled:false}));true');
   // Readiness is deliberately published before ancillary initialization. The
   // action must finish while the auxiliary page is still paused, without
   // imposing an unrelated subsecond SLA on initial panel work.
   // Poll the reply over CDP, not the file being atomically replaced on Windows.
   try{const reply=await until(()=>main.evaluate('window.__fixtureReply'),Math.max(500,3500-(performance.now()-started)));assert.equal(reply.ok,true,JSON.stringify(reply));assert.equal(JSON.parse(await readFile(path.join(data,'settings.json'),'utf8')).surfaceSync?.embedded,false)}catch(error){throw Error(error.message+'; fixture action reply='+JSON.stringify(await main.evaluate('window.__fixtureReply'))+'; host stderr='+errors)}
   assert(performance.now()-started<4000,'Settings waited for the auxiliary page to resume');
   observation.auxiliaryDoesNotBlockSettings=true;
   await sleep(Math.max(0,4150-(performance.now()-started)));
   await until(()=>aux.evaluate('!document.getElementById("codex-wallpaper-embedded-style")'),1000);
   observation.latestEmbeddedConfigAfterResume=true;
  }
  if(aux)await aux.call('Debugger.resume').catch(()=>{});
  clearTimeout(resumeTimer);
  const exited=new Promise(r=>host.once('exit',r)),closeStarted=performance.now();await browserCdp.call('Browser.close').catch(()=>{});await Promise.race([exited,sleep(3000)]);
  assert.equal(host.exitCode,0,'Host did not exit cleanly after browser disconnect');observation.hostExitMs=performance.now()-closeStarted;
  assert.equal(errors,'');
 }finally{clearTimeout(resumeTimer);main?.close();aux?.close();browserCdp?.close();if(host?.exitCode===null)host.kill();if(browser?.exitCode===null)browser.kill();}
}
const result={kind:'isolated-generated-startup-order-not-real-client-cold-boot',baseline,passed:true,results};
const output=process.argv.indexOf('--output');if(output>=0)await writeFile(process.argv[output+1],JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
