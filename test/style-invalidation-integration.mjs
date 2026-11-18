// Structural regression: leaf classes and local clipping must not restyle the app.
// Uses a separate Chromium instance; no user window, task, or wallpaper access.
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {paintShell} from '../src/wallpaper-style.mjs';

const work=process.env.CODEX_WALLPAPER_TEST_WORK||'E:/codexwallpaper/test-scratch';
await mkdir(work,{recursive:true});const dir=await mkdtemp(path.join(work,'style-invalidation-'));
const file=path.join(dir,'fixture.html');
await writeFile(file,`<!doctype html><style>body{margin:0}.bg-inherit{background:inherit}</style>
<div id="root"><main data-app-shell-main-surface><div class="electron:bg-surface"><section class="group/settings">Settings</section></div>
<div role="menu"><div class="bg-inherit" id="menu-inner">Menu</div></div>
<div class="group/diff-preview" role="tooltip"><div id="preview-card"><div data-testid="diff-preview-scroll">Diff</div><div class="bg-inherit" id="preview-inner">Inner</div></div></div>
<div class="overflow-hidden" id="diff-card"><div class="group/turn-diff-header">Header</div></div>
<button id="semantic" style="background:rgb(186,38,35);color:white">Delete</button>
<div id="tree">${'<div><span>one</span><span>two</span><span>three</span></div>'.repeat(800)}</div><span id="probe">Thinking</span></main></div>`);
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const url=pathToFileURL(file).href;
const chrome=spawn(process.env.CODEX_WALLPAPER_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-extensions','--remote-debugging-port='+port,'--user-data-dir='+path.join(dir,'profile'),url],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let page,browser,started=false;
try{
 for(let n=0;n<100&&!page;n++){try{const ts=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();const t=ts.find(t=>t.url===url);if(t)page=await connectCdp(t.webSocketDebuggerUrl)}catch{}if(!page)await pause(30)}assert(page,'Chromium did not start');
 let ready=false;
 for(let n=0;n<100&&!ready;n++){
  ready=await page.evaluate('document.readyState==="complete"&&!!document.getElementById("menu-inner")');
  if(!ready)await pause(30);
 }
 assert(ready,'Fixture document did not finish loading');
 await page.evaluate('window.__codexWallpaperBridge={ready:true};('+paintShell.toString()+')('+JSON.stringify({palette:{r:239,g:240,b:245,dark:false},visual:{glassOpacity:.5,glassBlur:0},darkOverlay:.4,lightOverlay:.4})+');true');
 // Token attribute selectors observe every class-attribute mutation in :has()
 // dependency chains. Keep that proven hazard out of generated shell rules.
 const broadClassRules=await page.evaluate(`Array.from(document.getElementById('codex-wallpaper-bridge-style').sheet.cssRules).filter(r=>r.selectorText&&/\\[class\\s*~=/.test(r.selectorText)).map(r=>r.selectorText)`);
 assert.deepEqual(broadClassRules,[],'Use escaped class selectors for exact class tokens; broad class attributes can invalidate the app');
 const appearances=await page.evaluate(`(()=>{const bg=id=>getComputedStyle(document.getElementById(id)).backgroundColor;return{mode:document.compatMode,nodes:document.querySelectorAll('*').length,menu:bg('menu-inner'),preview:bg('preview-card'),previewInner:bg('preview-inner'),diff:bg('diff-card'),settings:getComputedStyle(document.getElementsByClassName('electron:bg-surface')[0]).backgroundColor,semantic:bg('semantic')}})()`);
 assert.equal(appearances.mode,'CSS1Compat');assert.equal(appearances.menu,'rgba(0, 0, 0, 0)');assert.equal(appearances.preview,'rgba(239, 240, 245, 0.72)');assert.equal(appearances.previewInner,'rgba(0, 0, 0, 0)');assert.equal(appearances.diff,'rgba(239, 240, 245, 0.5)');assert.equal(appearances.settings,'rgba(0, 0, 0, 0)');assert.equal(appearances.semantic,'rgb(186, 38, 35)');
 await page.call('Runtime.evaluate',{expression:'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',awaitPromise:true});
 const v=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();browser=await connectCdp(v.webSocketDebuggerUrl);
 let done;const complete=new Promise(r=>done=r);browser.ws.addEventListener('message',e=>{const x=JSON.parse(e.data);if(x.method==='Tracing.tracingComplete')done(x.params)});
 await browser.call('Tracing.start',{categories:'devtools.timeline',transferMode:'ReturnAsStream'});started=true;
 const costs=(await page.call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{const e=document.getElementById('probe'),tree=document.getElementById('tree'),costs=[];tree.setAttribute('data-cwb-transcript-content','');for(let i=0;i<5;i++){const t=performance.now();e.classList.toggle('unrelated-thinking-active');for(const prop of ['--cwb-transcript-clip','--cwb-code-clip-top'])tree.style.setProperty(prop,(i+1)+'px');void tree.getBoundingClientRect();costs.push(performance.now()-t);await new Promise(r=>setTimeout(r,30))}e.classList.remove('unrelated-thinking-active');void e.getBoundingClientRect();return costs})()`})).result.value;
 await browser.call('Tracing.end');started=false;const {stream}=await complete;let data='';while(true){const r=await browser.call('IO.read',{handle:stream,size:1024*1024});data+=r.data;if(r.eof)break}await browser.call('IO.close',{handle:stream});
 const updates=JSON.parse(data).traceEvents.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X').map(e=>{assert(Object.hasOwn(e.args||{},'elementCount'),'Trace omitted elementCount');const count=Number(e.args.elementCount);assert(Number.isFinite(count)&&count>=0,'Invalid trace elementCount');return count});
 assert(updates.length>=5&&updates.some(n=>n>0),'Missing style recalculation evidence');const most=Math.max(...updates);
 assert(most<appearances.nodes/10,`Unrelated leaf class restyled ${most}/${appearances.nodes} elements`);
 for(const prop of ['--cwb-transcript-clip','--cwb-code-clip-top'])assert.equal(await page.evaluate('getComputedStyle(document.querySelector("#tree span")).getPropertyValue('+JSON.stringify(prop)+')'),'0px',prop+' leaked into text descendants');
 console.log(JSON.stringify({kind:'isolated-style-invalidation',passed:true,nodes:appearances.nodes,maxRestyledElements:most,localUpdateMs:costs.map(x=>Math.round(x*10)/10),appearancePreserved:true}));
}finally{if(started)await browser?.call('Tracing.end').catch(()=>{});browser?.close();page?.close();chrome.kill()}
