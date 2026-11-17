// Focused native code-block shape in isolated Chromium. No user app/PTY access.
import {mkdtemp,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {paintShell,clearShell} from '../src/wallpaper-style.mjs';
const dir=await mkdtemp(path.join(os.tmpdir(),'cwb-code-reading-')),file=path.join(dir,'fixture.html');
await writeFile(file,`<!doctype html><style>
body{margin:0}#layout{height:500px;position:relative}#reader{height:500px;overflow:auto}#spacer{height:100px}
[data-code-block]{--color-surface:#fff;--color-text:#111;--color-background-secondary-soft-alpha:#fff;color:var(--color-text);background-color:var(--color-surface);background-image:linear-gradient(var(--color-background-secondary-soft-alpha),var(--color-background-secondary-soft-alpha))}
[data-markdown-copy=exclude]{height:40px;position:sticky;top:0;z-index:10;background-color:var(--color-surface);background-image:linear-gradient(var(--color-background-secondary-soft-alpha),var(--color-background-secondary-soft-alpha));pointer-events:none}
[data-code-block-source]{height:900px}[data-code-block-source]>pre{color:inherit;background:transparent;border:0;margin:0;padding:0}
.hljs-comment{color:var(--color-codex-syntax-comment,#bbb)}.hljs-keyword{color:var(--color-codex-syntax-keyword,#fff)}.hljs-string{color:var(--color-codex-syntax-string,#ccc)}
</style><main><div id=layout><div id=reader data-app-action-timeline-scroll><div id=spacer></div><div data-code-block data-markdown-copy=code-block data-theme=light><div data-markdown-copy=exclude class=StickyActionBar-fixture><div data-code-block-controls>Text <button id=semantic style="background:#ba2623;color:#fff">Delete</button></div></div><div data-code-block-source><pre><code>Plain text
<span class=hljs-comment>Comment</span>
<span class=hljs-keyword>Keyword</span>
<span class=hljs-string>String</span></code></pre></div></div></div><div data-thread-scroll-footer style="height:60px;position:absolute;bottom:0;width:100%">Composer</div></div><pre id=unowned style="background:rgb(60,20,90)">Unowned pre</pre></main>`);
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const url=pathToFileURL(file).href,browser=spawn(process.env.CODEX_WALLPAPER_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-extensions','--remote-debugging-port='+port,'--user-data-dir='+path.join(dir,'profile'),url],{windowsHide:true,stdio:'ignore'});
let c;const results=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number),lum=v=>v.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
try{
 for(let n=0;n<100&&!c;n++){try{const t=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url);if(t)c=await connectCdp(t.webSocketDebuggerUrl)}catch{}if(!c)await pause(30)}assert(c);
 let ready=false;for(let n=0;n<100&&!ready;n++){ready=await c.evaluate('document.readyState==="complete"&&!!document.querySelector("[data-code-block]")');if(!ready)await pause(30)}assert(ready,'Fixture not parsed');
 for(const palette of [{r:20,g:22,b:28,dark:true},{r:46,g:46,b:46,dark:true},{r:239,g:240,b:245,dark:false},{r:220,g:220,b:220,dark:false}]){
  const dark=palette.dark,coverage=Math.max(.72,dark?175/(255-Math.max(palette.r,palette.g,palette.b)):172/Math.min(palette.r,palette.g,palette.b)),config={palette,visual:{glassOpacity:.5,glassBlur:0},darkOverlay:.4,lightOverlay:.4};
  await c.evaluate('window.__codexWallpaperBridge={ready:true};('+paintShell.toString()+')('+JSON.stringify(config)+');true');
  await c.evaluate(`(()=>{const code=document.querySelector('[data-code-block-source] code');for(const e of code.querySelectorAll('[data-test-token]'))e.remove();for(const key of ['literal','variable','attribute','name','error']){const e=document.createElement('span');e.setAttribute('data-test-token','');e.style.display='block';e.style.color='var(--color-codex-syntax-'+key+')';e.textContent='Token';code.append(e)}return true})()`);
  const sample=await c.evaluate(`(()=>{const root=document.querySelector('[data-code-block]'),source=root.querySelector('[data-code-block-source]'),s=getComputedStyle(root);return {bg:s.backgroundColor,image:s.backgroundImage,headerBg:getComputedStyle(root.firstElementChild).backgroundColor,headerImage:getComputedStyle(root.firstElementChild).backgroundImage,base:getComputedStyle(source.querySelector('code')).color,syntax:[...source.querySelectorAll('span')].map(e=>getComputedStyle(e).color),semantic:getComputedStyle(document.getElementById('semantic')).backgroundColor,unowned:getComputedStyle(document.getElementById('unowned')).backgroundColor}})()`);
  assert(Math.abs(Number(sample.bg.match(/[\d.]+/g)[3])-(coverage-.4)/.6)<.004,sample.bg);assert.equal(sample.image,'none');assert.equal(sample.headerBg,'rgba(0, 0, 0, 0)');assert.equal(sample.headerImage,'none');assert.equal(sample.semantic,'rgb(186, 38, 35)');assert.equal(sample.unowned,'rgb(60, 20, 90)');
  const actualCoverage=.4+.6*Number(sample.bg.match(/[\d.]+/g)[3]),worst=[palette.r,palette.g,palette.b].map(n=>n*actualCoverage+(dark?255:0)*(1-actualCoverage));for(const color of [sample.base,...sample.syntax])assert(contrast(rgb(color),worst)>=4.5,color+' on worst-case wallpaper');assert(new Set(sample.syntax).size>=7,'Syntax categories collapsed');
  // A reader's final tint is a budget, not another independent overlay.
  for(const [overlay,opacity] of [[0,.2],[.4,.5],[.85,.5],[1,.5],[.4,1]]){
   const cfg={...config,visual:{glassOpacity:opacity,glassBlur:0},darkOverlay:overlay,lightOverlay:overlay};
   await c.evaluate('('+paintShell.toString()+')('+JSON.stringify(cfg)+');true');
   const alpha=await c.evaluate('Number(getComputedStyle(document.querySelector("[data-code-block]")).backgroundColor.match(/[\\d.]+/g)[3]??1)');
   assert(Math.abs(overlay+(1-overlay)*alpha-Math.max(coverage,overlay,opacity))<.004,JSON.stringify({palette,overlay,opacity,coverage,alpha}));
  }
  await c.evaluate('('+paintShell.toString()+')('+JSON.stringify(config)+');true');
  await c.evaluate('document.getElementById("reader").scrollTop=250;true');await c.call('Runtime.evaluate',{expression:'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',awaitPromise:true});
  const sticky=await c.evaluate(`(()=>{const source=document.querySelector('[data-code-block-source]'),header=source.previousElementSibling;return {clip:parseFloat(source.style.getPropertyValue('--cwb-code-clip-top')),scroll:document.getElementById('reader').scrollTop,sourceTop:source.getBoundingClientRect().top,headerBottom:header.getBoundingClientRect().bottom,rootTop:source.parentElement.getBoundingClientRect().top,enabled:window.__cwbTranscriptPaint.codeEnabled,sourceUnderHeader:!!document.elementFromPoint(300,20)?.closest('[data-code-block-source]')}})()`);assert(sticky.clip>100,JSON.stringify({dark,...sticky}));assert.equal(sticky.sourceUnderHeader,false,'Code text painted underneath sticky header');
  assert.equal(sticky.scroll,250);assert.equal(await c.evaluate('document.getElementById("reader").clientHeight'),500);assert.equal(await c.evaluate('!!document.elementFromPoint(300,470)?.closest("[data-code-block]")'),false,'Code painted through composer');
  await c.evaluate('('+paintShell.toString()+')('+JSON.stringify({...config,surfaceSync:{code:false}})+');true');assert.equal(await c.evaluate('getComputedStyle(document.querySelector("[data-code-block]")).backgroundColor'),'rgb(255, 255, 255)');assert.equal(await c.evaluate('document.querySelector("[data-code-block-source]").hasAttribute("data-cwb-code-source")'),false);
  await c.evaluate('document.getElementById("reader").scrollTop=0;true');results.push({dark,readablePlainAndSyntax:true,stickyHeaderOccludesSource:true,nativeOptOutPreserved:true});
 }
 await c.evaluate('('+clearShell.toString()+')();true');assert.equal(await c.evaluate('!!document.querySelector("[data-cwb-code-source]")'),false);
 console.log(JSON.stringify({kind:'isolated-code-reading',passed:true,results}));
}finally{c?.close();browser.kill()}
