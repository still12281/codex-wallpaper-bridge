// Isolated Chrome + generated pages only. Never connects to the user's client.
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){try{const value=await fn();if(value)return value}catch{}await sleep(25)}throw Error('Startup fixture timed out')}
let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME;
for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){if(chrome)break;const file=path.join(base,'Google/Chrome/Application/chrome.exe');try{await access(file);chrome=file}catch{}}
if(!chrome)throw Error('Isolated Chrome fixture unavailable');
const baseline=process.argv.includes('--baseline'),results=[];
for(const scenario of ['auxiliary','shell']){
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-startup-')),data=path.join(root,'data');await mkdir(data);
 const html=path.join(root,'shell.html'),blockerHtml=path.join(root,'auxiliary.html');
 await writeFile(html,'<!doctype html><body><aside class="app-shell-left-panel"></aside><main data-app-shell-main-surface>Generated startup fixture</main></body>');
 await writeFile(blockerHtml,'<!doctype html><body>Generated paused auxiliary fixture</body>');
 await writeFile(path.join(data,'settings.json'),JSON.stringify({library:[],selectedId:null,systemMedia:{enabled:false,audio:false}}));
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const url=pathToFileURL(html).href,auxUrl=pathToFileURL(blockerHtml).href;
 let browser,host,browserCdp,main,aux,resumeTimer,errors='';
 try{
  browser=spawn(chrome,['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(root,'profile'),url],{windowsHide:true,stdio:'ignore'});
  const version=await until(async()=>{const r=await fetch('http://127.0.0.1:'+port+'/json/version');return r.json()});browserCdp=await connectCdp(version.webSocketDebuggerUrl);
  const mainTarget=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url));main=await connectCdp(mainTarget.webSocketDebuggerUrl);
  await until(()=>main.evaluate('document.readyState==="complete"'));
  const preloader=path.join(root,'fixture-preloader.mjs');let auxId='';
  if(scenario==='auxiliary'){
   const created=await browserCdp.call('Target.createTarget',{url:auxUrl,background:true});auxId=created.targetId;
   const auxTarget=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.id===auxId));aux=await connectCdp(auxTarget.webSocketDebuggerUrl);
   await aux.call('Debugger.enable');await aux.call('Debugger.pause');
   // Only this fixture host sees the paused local page classified as a webview.
   // No request is made to the classification URL.
   await writeFile(preloader,`const fetchOriginal=globalThis.fetch;globalThis.fetch=async(...args)=>{const response=await fetchOriginal(...args);if(String(args[0])!=='http://127.0.0.1:${port}/json/list')return response;const list=await response.json();for(const t of list)if(t.id===${JSON.stringify(auxId)}){t.type='webview';t.url='https://chatgpt.com/fixture';}return new Response(JSON.stringify(list));};`);
  }else{
   await writeFile(preloader,'// No target substitution in the delayed-shell scenario.');
   await main.evaluate('document.querySelector("aside").remove();document.querySelector("main").remove();setTimeout(()=>{document.body.innerHTML=\'<aside class="app-shell-left-panel"></aside><main data-app-shell-main-surface>Delayed fixture</main>\'},1000);true');
  }
  const started=performance.now();
  host=spawn(process.execPath,['--import',pathToFileURL(preloader).href,path.resolve('src/video-cdp-host.mjs'),'--cdp-port',String(port),'--test-url',url],{env:{...process.env,CODEX_WALLPAPER_DATA_DIR:data},windowsHide:true,stdio:['ignore','ignore','pipe']});host.stderr.on('data',b=>errors+=b.toString());
  if(aux)resumeTimer=setTimeout(()=>void aux.call('Debugger.resume').catch(()=>{}),4000);
  const state=await until(async()=>{const s=JSON.parse(await readFile(path.join(data,'runtime-status.json'),'utf8'));return s.targets.some(t=>t.targetId===mainTarget.id&&t.installed)&&s});
  const readyAfterMs=performance.now()-started;
  if(!baseline)assert(readyAfterMs<2500,scenario+' delayed the primary page: '+readyAfterMs+' ms');
  const observation={scenario,readyAfterMs,auxiliaryResumeAfterMs:scenario==='auxiliary'?4000:null,startup:state.startup};results.push(observation);
  if(aux&&!baseline){
   await main.evaluate('window.__fixtureReply=null;const reply=window.__cwbReply;window.__cwbReply=(id,result)=>{if(id===999999)window.__fixtureReply=result;reply(id,result)};window.__codexWallpaperSend(JSON.stringify({token:document.getElementById("codex-wallpaper-controls").__cwbToken,id:999999,action:"surface-sync",region:"embedded",enabled:false}));true');
   // Readiness is deliberately published before ancillary initialization. The
   // action must finish while the auxiliary page is still paused, without
   // imposing an unrelated subsecond SLA on initial panel work.
   try{await until(async()=>JSON.parse(await readFile(path.join(data,'settings.json'),'utf8')).surfaceSync?.embedded===false,Math.max(500,3500-(performance.now()-started)))}catch(error){throw Error(error.message+'; fixture action reply='+JSON.stringify(await main.evaluate('window.__fixtureReply'))+'; host stderr='+errors)}
   assert(performance.now()-started<4000,'Settings waited for the auxiliary page to resume');
   observation.auxiliaryDoesNotBlockSettings=true;
   await sleep(Math.max(0,4150-(performance.now()-started)));
   await until(()=>aux.evaluate('!document.getElementById("codex-wallpaper-embedded-style")'),1000);
   observation.latestEmbeddedConfigAfterResume=true;
  }
  if(aux)await aux.call('Debugger.resume').catch(()=>{});
  clearTimeout(resumeTimer);
  const exited=new Promise(r=>host.once('exit',r));await browserCdp.call('Browser.close').catch(()=>{});await Promise.race([exited,sleep(5000)]);
  assert.equal(errors,'');
 }finally{clearTimeout(resumeTimer);main?.close();aux?.close();browserCdp?.close();if(host?.exitCode===null)host.kill();if(browser?.exitCode===null)browser.kill();}
}
const result={kind:'isolated-generated-startup-order-not-real-client-cold-boot',baseline,passed:true,results};
const output=process.argv.indexOf('--output');if(output>=0)await writeFile(process.argv[output+1],JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
