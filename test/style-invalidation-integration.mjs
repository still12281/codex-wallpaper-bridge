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
const anchorSelector='.scrollContainer-fG6qEo';
const anchorGate='[data-thread-has-reading-passage]:not([data-native-end-snap-following])';
const anchorContent='.transcriptContent-l_FOQD';
const gated=anchorSelector+anchorGate;
await writeFile(path.join(dir,'59d93f9e7acb.css'),`
${[anchorSelector,gated+' > :not(:first-child)',gated+' > :first-child > :not('+anchorContent+')',gated+' '+anchorContent+' > *'].join(', ')}{overflow-anchor:none}
${gated}[data-thread-reading=anchored]{overflow-anchor:auto}
`);
await writeFile(file,`<!doctype html><style>body{margin:0}.bg-inherit{background:inherit}</style>
<div id="root"><main data-app-shell-main-surface><div class="electron:bg-surface"><section class="group/settings">Settings</section></div>
<div role="menu"><div class="bg-inherit" id="menu-inner">Menu</div></div>
<div class="group/diff-preview" role="tooltip"><div id="preview-card"><div data-testid="diff-preview-scroll">Diff</div><div class="bg-inherit" id="preview-inner">Inner</div></div></div>
<div class="overflow-hidden" id="diff-card"><div class="group/turn-diff-header">Header</div></div>
<button id="semantic" style="background:rgb(186,38,35);color:white">Delete</button>
<div id="tree">${'<div><span>one</span><span>two</span><span>three</span></div>'.repeat(800)}</div><span id="probe">Thinking</span></main></div>`);
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const url=pathToFileURL(file).href;
const chrome=spawn(process.env.CODEX_WALLPAPER_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-extensions','--allow-file-access-from-files','--remote-debugging-port='+port,'--user-data-dir='+path.join(dir,'profile'),url],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let page,browser,started=false;
try{
 for(let n=0;n<100&&!page;n++){try{const ts=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();const t=ts.find(t=>t.url===url);if(t)page=await connectCdp(t.webSocketDebuggerUrl)}catch{}if(!page)await pause(30)}assert(page,'Chromium did not start');
 let ready=false;
 for(let n=0;n<100&&!ready;n++){
  ready=await page.evaluate('document.readyState==="complete"&&!!document.getElementById("menu-inner")');
  if(!ready)await pause(30);
 }
 assert(ready,'Fixture document did not finish loading');
 const paint='('+paintShell.toString()+')('+JSON.stringify({palette:{r:239,g:240,b:245,dark:false},visual:{glassOpacity:.5,glassBlur:0},darkOverlay:.4,lightOverlay:.4})+')';
 await page.evaluate('window.__codexWallpaperBridge={ready:true};'+paint+';true');
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
 const costs=(await page.call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{const e=document.getElementById('probe'),tree=document.getElementById('tree'),costs=[];tree.setAttribute('data-cwb-code-source','');for(let i=0;i<5;i++){const t=performance.now();e.classList.toggle('unrelated-thinking-active');tree.style.setProperty('--cwb-code-clip-top',(i+1)+'px');void tree.getBoundingClientRect();costs.push(performance.now()-t);await new Promise(r=>setTimeout(r,30))}e.classList.remove('unrelated-thinking-active');void e.getBoundingClientRect();return costs})()`})).result.value;
 await browser.call('Tracing.end');started=false;const {stream}=await complete;let data='';while(true){const r=await browser.call('IO.read',{handle:stream,size:1024*1024});data+=r.data;if(r.eof)break}await browser.call('IO.close',{handle:stream});
 const updates=JSON.parse(data).traceEvents.filter(e=>e.name==='UpdateLayoutTree'&&e.ph==='X').map(e=>{assert(Object.hasOwn(e.args||{},'elementCount'),'Trace omitted elementCount');const count=Number(e.args.elementCount);assert(Number.isFinite(count)&&count>=0,'Invalid trace elementCount');return count});
 assert(updates.length>=5&&updates.some(n=>n>0),'Missing style recalculation evidence');const most=Math.max(...updates);
 assert(most<appearances.nodes/10,`Unrelated leaf class restyled ${most}/${appearances.nodes} elements`);
 assert.equal(await page.evaluate('getComputedStyle(document.querySelector("#tree span")).getPropertyValue("--cwb-code-clip-top")'),'0px','Code clipping leaked into descendants');
 const selection=await page.evaluate(`(()=>{
  const surface=document.createElement('div');
  surface.innerHTML='<div class="xterm"><div class="xterm-selection"><div style="background-color:rgb(144,157,171)"></div></div></div>';
  document.body.append(surface);
  const selection=surface.querySelector('.xterm-selection div'),term=surface.firstElementChild,color=()=>getComputedStyle(selection).backgroundColor;
  const native=color();surface.setAttribute('data-cwb-terminal-surface','');
  surface.style.setProperty('--cwb-terminal-selection-active','#386b9c44');
  surface.style.setProperty('--cwb-terminal-selection-inactive','#386b9c33');
  const inactive=color();term.classList.add('focus');const active=color();
  term.setAttribute('data-cwb-clipped-selection','');term.style.setProperty('--cwb-terminal-selection-clip','inset(0 0 100% 0)');
  const empty=getComputedStyle(selection.parentElement).clipPath.startsWith('inset(');term.removeAttribute('data-cwb-clipped-selection');
  surface.removeAttribute('data-cwb-terminal-surface');const restored=color();surface.remove();
  return {native,inactive,active,empty,restored};
 })()`);
 assert.deepEqual(selection,{native:'rgb(144, 157, 171)',inactive:'rgba(56, 107, 156, 0.2)',active:'rgba(56, 107, 156, 0.267)',empty:true,restored:'rgb(144, 157, 171)'});
 const animation=await page.evaluate(`(()=>{
  const root=document.documentElement,key='--decorative-animation-play-state';
  const style=document.createElement('style');
  style.textContent='.animate-pulse,.Placeholder-GJXpwo[data-animate]::before,.ink-TiVe8k[data-pending]>path{animation-play-state:var(--decorative-animation-play-state,running)}';
  document.head.append(style);
  const area=document.createElement('div');
  area.innerHTML='<div class="animate-pulse"></div><div class="Placeholder-GJXpwo" data-animate></div><div class="animate-pulse" style="--decorative-animation-play-state: running"></div><svg class="ink-TiVe8k" data-pending><path d="M0 0"/></svg>';
  document.body.append(area);
  const nativeState=()=>({
   ordinary:getComputedStyle(document.querySelector('#tree span')).getPropertyValue(key).trim(),
   pulse:getComputedStyle(area.children[0]).animationPlayState,
   pseudo:getComputedStyle(area.children[1],'::before').animationPlayState,
   local:getComputedStyle(area.children[2]).animationPlayState,
   newBuild:getComputedStyle(area.querySelector('path')).animationPlayState
  });
  const signature=paths=>paths.map(path=>{
   const element=document.createElement('script');element.type='application/json';element.setAttribute('src',path);
   document.head.append(element);return element;
  });
  root.style.setProperty(key,'paused');
  const unknown=nativeState();
  const old=signature(['/assets/782259.7a3e865ee5.js','/assets/348410.1a97dde15f.js']);
  ${paint};
  const paused=nativeState();
  root.style.removeProperty(key);
  const resumed=nativeState();
  old.forEach(e=>e.remove());
  const newer=signature(['/assets/903838.979fd3f34c.js','/assets/348410.374a9b8f98.js']);
  ${paint};
  root.style.setProperty(key,'paused');
  const latest=nativeState();
  newer.forEach(e=>e.remove());
  ${paint};
  const fallback=nativeState();
  root.style.removeProperty(key);area.remove();style.remove();
  return {unknown,paused,resumed,latest,fallback};
 })()`);
 assert.deepEqual(animation.unknown,{ordinary:'paused',pulse:'paused',pseudo:'paused',local:'running',newBuild:'paused'});
 assert.deepEqual(animation.paused,{...animation.unknown,ordinary:'running',newBuild:'running'});
 assert.deepEqual(animation.resumed,{ordinary:'running',pulse:'running',pseudo:'running',local:'running',newBuild:'running'});
 assert.deepEqual(animation.latest,{...animation.unknown,ordinary:'running'});
 assert.deepEqual(animation.fallback,animation.unknown);
 const {result:anchorResult,exceptionDetails}=await page.call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='59d93f9e7acb.css';
  await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject;document.head.append(link);});
  const assets=['/assets/903838.979fd3f34c.js','/assets/348410.374a9b8f98.js'].map(src=>{
   const script=document.createElement('script');script.type='application/json';script.setAttribute('src',src);
   document.head.append(script);return script;
  });
  const surface=document.createElement('div');
  surface.innerHTML='<div class="scrollContainer-fG6qEo" data-app-action-timeline-scroll><div class="overflow-clip"><div class="transcriptContent-l_FOQD" data-thread-user-message-navigation-content><div data-thread-find-target><div style="overflow:auto;height:40px"><div style="height:140px"></div></div></div></div><div class="pointer-events-none" aria-hidden="true"></div></div><div class="footer-A8ZvKV absolute"></div></div>';
  const host=surface.firstElementChild,transcript=host.firstElementChild.firstElementChild,padding=transcript.nextElementSibling,turns=transcript.firstElementChild;
  padding.classList.add('h-[calc(var(--thread-scroll-padding-bottom)-var(--spacing)*4)]');
  document.body.append(surface);
  const rule=link.sheet.cssRules[0];
  const observed=()=>[rule.selectorText.includes('data-thread-has-reading-passage'),getComputedStyle(host).overflowAnchor,getComputedStyle(turns).overflowAnchor,getComputedStyle(turns.firstElementChild).overflowAnchor];
  const native=observed();
  ${paint};
  const patched=observed();
  host.setAttribute('data-thread-has-reading-passage','');
  host.setAttribute('data-thread-reading','anchored');
  const anchored=observed();
  host.setAttribute('data-native-end-snap-following','');
  const following=observed();
  turns.style.overflow='auto';
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const nestedFallback=observed();
  turns.style.removeProperty('overflow');
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const recovered=observed();
  const unexpected=transcript.appendChild(document.createElement('section'));
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const shapeFallback=observed();
  unexpected.remove();
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const shapeRecovered=observed();
  const cachedConversation=host.cloneNode(true);
  cachedConversation.hidden=true;surface.append(cachedConversation);
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const cachedPatched=observed();
  cachedConversation.firstElementChild.firstElementChild.firstElementChild.style.overflow='auto';
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const cachedFallback=observed();
  cachedConversation.remove();
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const cachedRemoved=observed();
  window.__cwbTranscriptPaint.dispose();
  const disposed=observed();
  assets.forEach(script=>script.remove());surface.remove();link.remove();
  return {native,patched,anchored,following,nestedFallback,recovered,shapeFallback,shapeRecovered,cachedPatched,cachedFallback,cachedRemoved,disposed};
 })()`});
 assert.ifError(exceptionDetails);
 const native=[true,'none','auto','auto'],patched=[false,'none','none','auto'];
 assert.deepEqual(anchorResult.value,{native,patched,anchored:[false,'auto','none','auto'],following:patched,nestedFallback:native,recovered:patched,shapeFallback:native,shapeRecovered:patched,cachedPatched:patched,cachedFallback:native,cachedRemoved:patched,disposed:native});
 console.log(JSON.stringify({kind:'isolated-style-invalidation',passed:true,nodes:appearances.nodes,maxRestyledElements:most,localUpdateMs:costs.map(x=>Math.round(x*10)/10),appearancePreserved:true,nativeDecorativeStateScoped:true,readingAnchorScopeRestored:true}));
}finally{if(started)await browser?.call('Tracing.end').catch(()=>{});browser?.close();page?.close();chrome.kill()}
