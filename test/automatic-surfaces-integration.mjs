// Necessary regression coverage in an isolated browser; never navigates Codex.
import {createServer} from 'node:http';
import {mkdtemp,mkdir,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {createAutomaticSurfaces} from '../src/automatic-surfaces.mjs';

const pause=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn)=>{for(let i=0;i<100;i++){const value=await fn().catch(()=>false);if(value)return value;await pause(50);}throw Error('surface integration timed out');};
let chrome,cdp,browser,manager;
const result={kind:'isolated-chromium-surface-lifecycle'};
const server=createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'unsafe-inline'; style-src 'self'; frame-src http: blob:");
 if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end('html,body{margin:0;background:rgb(25,25,25)}.new-page-container{width:100vw;height:100vh;background:rgb(25,25,25)}.bg-surface{background:rgb(25,25,25)}.semantic{background:rgb(200,30,20)}.image{background-image:linear-gradient(red,blue)}button{background:rgb(25,25,25)}');return;}
 res.setHeader('Content-Type','text/html');
 res.end('<!doctype html><link rel="stylesheet" href="/style.css"><main class="new-page-container"><button id="button" onclick="this.dataset.clicked=1">Click</button><div role="alert" class="semantic new-page-container">Warning</div><div class="image">Image</div><input id="input"><pre>Code</pre><div role="menu">Menu</div></main>');
});
try{
 await new Promise(r=>server.listen(0,'0.0.0.0',r));const httpPort=server.address().port,shellUrl=`http://127.0.0.1:${httpPort}/shell`,childUrl=`http://localhost:${httpPort}/child`;
 const work=process.env.CODEX_WALLPAPER_TEST_WORK||'E:/codexwallpaper/test-scratch';await mkdir(work,{recursive:true});const profile=await mkdtemp(path.join(work,'automatic-surfaces-'));
 let executable=process.env.CODEX_WALLPAPER_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';await access(executable);
 const portServer=createServer();await new Promise(r=>portServer.listen(0,'127.0.0.1',r));const port=portServer.address().port;await new Promise(r=>portServer.close(r));
 chrome=spawn(executable,['--headless=new','--no-first-run','--disable-background-networking','--site-per-process','--remote-debugging-port='+port,'--user-data-dir='+profile,shellUrl],{windowsHide:true,stdio:'ignore'});
 const endpoint='http://127.0.0.1:'+port;
 const version=await wait(async()=>await(await fetch(endpoint+'/json/version')).json());browser=await connectCdp(version.webSocketDebuggerUrl);
 const target=await wait(async()=>(await(await fetch(endpoint+'/json/list')).json()).find(t=>t.url===shellUrl));cdp=await connectCdp(target.webSocketDebuggerUrl);
 let config={enabled:true,palette:{r:20,g:22,b:28,dark:true},surfaceSync:{embedded:true}};
 const errors=[];manager=createAutomaticSurfaces(browser,{appUrl:shellUrl,getConfig:()=>config,onStatus:s=>{if(s.error)errors.push(s.error);}});await manager.start();
 await wait(()=>cdp.evaluate('window.__cwbAutomaticSurface?.snapshot().analyzed'));
 assert.equal(await cdp.evaluate('getComputedStyle(document.querySelector(".new-page-container")).backgroundColor'),'rgba(0, 0, 0, 0)');
 assert.equal(await cdp.evaluate('getComputedStyle(document.querySelector(".semantic")).backgroundColor'),'rgb(200, 30, 20)');
 assert.notEqual(await cdp.evaluate('getComputedStyle(document.querySelector(".image")).backgroundImage'),'none');
 assert.equal(await cdp.evaluate('getComputedStyle(document.querySelector("button")).backgroundColor'),'rgb(25, 25, 25)');
 result.strictCspAndSemanticPreservation=true;
 await cdp.evaluate(`document.body.innerHTML+='<section class="bg-surface" id="later">Later route</section>';true`);
 assert.equal(await cdp.evaluate('getComputedStyle(document.getElementById("later")).backgroundColor'),'rgba(0, 0, 0, 0)');result.futureMatchingContent=true;
 await cdp.evaluate(`(()=>{const frame=document.createElement('iframe');frame.id='guest';frame.src=${JSON.stringify(childUrl)};document.body.append(frame);return true;})()`);
 const child=await wait(async()=>(await(await fetch(endpoint+'/json/list')).json()).find(t=>t.type==='iframe'&&t.url===childUrl));
 const guest=await connectCdp(child.webSocketDebuggerUrl);
 try{
  await wait(()=>guest.evaluate('window.__cwbAutomaticSurface?.snapshot().analyzed'));assert.equal(await guest.evaluate('getComputedStyle(document.body).backgroundColor'),'rgba(0, 0, 0, 0)');
  await guest.evaluate('document.getElementById("button").click();document.getElementById("input").value="works";true');assert.equal(await guest.evaluate('document.getElementById("button").dataset.clicked'),'1');
  // Page.reload is top-level only. Navigate the owning iframe element instead.
  await cdp.evaluate('document.getElementById("guest").src='+JSON.stringify(childUrl+'?reload=1')+';true');
  await wait(()=>guest.evaluate('location.search==="?reload=1"&&window.__cwbAutomaticSurface?.snapshot().analyzed'));result.crossOriginCreationReloadAndInput=true;
  const before=manager.snapshot();const sample=await guest.evaluate('JSON.stringify(window.__cwbAutomaticSurface.snapshot())');await pause(500);
  assert.deepEqual(manager.snapshot(),before);assert.equal(await guest.evaluate('JSON.stringify(window.__cwbAutomaticSurface.snapshot())'),sample);result.noIdleReanalysis=true;
  await guest.evaluate('(()=>{const legacy=document.createElement("style");legacy.id="codex-wallpaper-embedded-style";document.head.append(legacy);window.__cwbEmbeddedOriginal={scheme:"light",dark:false};document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";return true;})()');
  config={...config,surfaceSync:{embedded:false}};await manager.refresh();assert.equal(await guest.evaluate('!!window.__cwbAutomaticSurface'),false);assert.equal(await guest.evaluate('getComputedStyle(document.body).backgroundColor'),'rgb(25, 25, 25)');assert.equal(await guest.evaluate('!document.getElementById("codex-wallpaper-embedded-style")&&!window.__cwbEmbeddedOriginal&&!document.documentElement.classList.contains("dark")&&document.documentElement.style.colorScheme==="light"'),true);result.disableRestores=true;
 }finally{guest.close();}
 await cdp.evaluate(`(()=>{const frame=document.createElement('iframe');frame.src=URL.createObjectURL(new Blob(['<body>Wallpaper</body>'],{type:'text/html'}));frame.id='wallpaper';document.body.append(frame);return true;})()`);
 await wait(()=>cdp.evaluate('document.getElementById("wallpaper").contentWindow.location.protocol==="blob:"&&!!document.getElementById("wallpaper").contentDocument?.body'));assert.equal(await cdp.evaluate('!!document.getElementById("wallpaper").contentWindow.__cwbAutomaticSurface'),false);result.wallpaperExcluded=true;
 const external=(await browser.call('Target.createTarget',{url:childUrl})).targetId;await pause(200);
 const externalSession=(await browser.call('Target.attachToTarget',{targetId:external,flatten:true})).sessionId;assert.equal((await browser.call('Runtime.evaluate',{expression:'!!window.__cwbAutomaticSurface',returnByValue:true},externalSession)).result.value,false);await browser.call('Target.closeTarget',{targetId:external});result.externalPageExcluded=true;
 assert.deepEqual(errors,[]);result.metrics=manager.snapshot();result.passed=true;
}catch(e){result.error=e.stack;process.exitCode=1;}finally{
 await manager?.dispose();if(cdp){await cdp.call('Browser.close').catch(()=>{});cdp.close();}chrome?.kill();await new Promise(r=>server.close(r));console.log(JSON.stringify(result,null,2));
}
