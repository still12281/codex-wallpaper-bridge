// Isolated generated Chromium page. Never connects to an existing Codex client.
import {mkdtemp,writeFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {paintShell,clearShell} from '../src/wallpaper-style.mjs';
import {installStartupAppearance} from '../src/startup-appearance.mjs';
import {decorateShell} from '../src/upstream-adapters.mjs';
import {installSurfaceTheme} from '../src/automatic-surfaces.mjs';

let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME;
for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){
 if(chrome)break;const file=path.join(base,'Google/Chrome/Application/chrome.exe');try{await access(file);chrome=file}catch{}
}
if(!chrome)throw Error('Isolated Chrome fixture unavailable');
const root=await mkdtemp(path.join(process.env.CODEX_WALLPAPER_TEST_TMP||os.tmpdir(),'cwb-contrast-'));
const file=path.join(root,'fixture.html'),url=pathToFileURL(file).href;
// Native tokens are restored by theme hydration, independently of color-scheme.
// The solid-button background follows foreground, while its label follows a
// separate inverse token. ProseMirror additionally halves placeholder opacity.
await writeFile(file,`<!doctype html><style>
 :root{--color-text-primary:var(--app-color-text-foreground);--color-text-secondary:var(--app-color-text-foreground-secondary);--color-text-tertiary:var(--app-color-text-foreground-tertiary);--color-background-primary-solid:var(--app-color-text-foreground);--color-text-primary-solid:var(--color-background-control-opaque)}
 :root[data-theme=light]{--app-color-text-foreground:#1a1c1f;--app-color-text-foreground-secondary:#555;--app-color-text-foreground-tertiary:#777;--app-color-text-button-primary:#fff;--app-color-text-button-secondary:#1a1c1f;--app-color-text-button-tertiary:#777;--app-color-icon-primary:#1a1c1f;--app-color-icon-secondary:#555;--app-color-icon-tertiary:#777;--color-background-control-opaque:#fff}
 :root[data-theme=dark]{--app-color-text-foreground:#fff;--app-color-text-foreground-secondary:#aaa;--app-color-text-foreground-tertiary:#888;--app-color-text-button-primary:#0d0d0d;--app-color-text-button-secondary:#4f4f4f;--app-color-text-button-tertiary:#888;--app-color-icon-primary:#eee;--app-color-icon-secondary:#aaa;--app-color-icon-tertiary:#888;--color-background-control-opaque:#181818}
 body{color:var(--app-color-text-foreground)}
 button{font:16px sans-serif;border:0;padding:12px}
 #solid{color:var(--color-text-primary-solid);background:var(--color-background-primary-solid)}
 #app-solid{color:var(--app-color-text-button-primary);background:var(--app-color-background-button-primary)}
 #secondary{color:var(--app-color-text-button-secondary);background:transparent}
 #tertiary{color:var(--app-color-text-button-tertiary);background:transparent}
 #icon{color:var(--app-color-icon-primary)} #muted-icon{color:var(--app-color-icon-tertiary)}
 input::placeholder{color:var(--color-text-tertiary);opacity:1}
 [data-composer-surface-variant]{--composer-editor-placeholder-opacity:var(--opacity-composer-placeholder,.5)}
 .ProseMirror .placeholder::before{content:attr(data-placeholder);color:var(--color-text-tertiary);opacity:var(--composer-editor-placeholder-opacity,.5)}
 #semantic{color:#fff;background:#ba2623} #accent{color:#fff;background:#2866ce}
 </style><body><main><button id=solid>Review</button><button id=app-solid>Primary</button><button id=secondary>Secondary</button><button id=tertiary>Tertiary</button><span id=icon>Icon</span><span id=muted-icon>Muted</span><input placeholder=Search><div data-composer-surface-variant><div class=ProseMirror><p class=placeholder data-placeholder=Compose></p></div></div><button id=semantic>Delete</button><button id=accent>Send</button></main></body>`);
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
let browser,c;
const until=async fn=>{const end=Date.now()+10000;while(Date.now()<end){try{const v=await fn();if(v)return v}catch{}await new Promise(r=>setTimeout(r,30))}throw Error('Contrast fixture timed out')};
const rgb=s=>s.match(/[\d.]+/g).map(Number);
const composite=(fg,bg)=>{const a=fg[3]??1;return fg.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a))};
const luminance=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const results=[];
try{
 browser=spawn(chrome,['--headless=new','--no-first-run','--disable-extensions','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(root,'profile'),url],{windowsHide:true,stdio:'ignore'});
 const t=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url));c=await connectCdp(t.webSocketDebuggerUrl);
 await until(()=>c.evaluate('document.readyState==="complete"&&!!document.getElementById("solid")'));
 for(const dark of [true,false]){
  const palette=dark?{r:20,g:22,b:28,dark}:{r:240,g:242,b:246,dark};
  await c.evaluate('delete window.__codexWallpaperBridge;true');
  await c.evaluate('('+installStartupAppearance.toString()+')('+JSON.stringify(palette)+','+JSON.stringify(url)+')');
  // Owned-surface integration can attach after startup, before body/media are
  // ready. Its neutral canvas must not punch through the startup background.
  await c.evaluate('(()=>{const sheet=new CSSStyleSheet();sheet.replaceSync("html,body{background-color:transparent!important}");document.adoptedStyleSheets=[...document.adoptedStyleSheets,sheet];return true})()');
  assert.equal(await c.evaluate('getComputedStyle(document.documentElement).backgroundColor'),`rgb(${palette.r}, ${palette.g}, ${palette.b})`);
  for(const phase of ['startup','paint','late-hydration','late-controls']){
   if(phase==='paint')await c.evaluate('window.__codexWallpaperBridge={ready:true};('+paintShell.toString()+')('+JSON.stringify({palette,darkOverlay:.4,lightOverlay:.4})+')');
   // Set the opposite theme after first paint, matching the reported restart.
   if(phase==='late-hydration')await c.evaluate('document.documentElement.dataset.theme='+JSON.stringify(dark?'light':'dark')+';document.documentElement.style.colorScheme='+JSON.stringify(dark?'light':'dark')+';true');
   if(phase==='late-controls')await c.evaluate('(()=>{const old=document.getElementById("solid");old.replaceWith(old.cloneNode(true));const style=document.createElement("style");style.textContent=\':root[data-theme]{--app-color-text-button-primary:#fff;--color-text-primary-solid:#fff;--app-color-text-foreground-tertiary:#111;--color-text-tertiary:#111}\';document.head.append(style);return true})()');
   // Contrast is measured against the fixed fixture wallpaper; arbitrary
   // wallpaper luminance remains controlled by the user's shared overlay.
   const wallpaper=dark?[80,80,80]:[220,220,220],shade=[palette.r,palette.g,palette.b];
   const pageBg=phase==='startup'?shade:composite([...shade,.4],wallpaper),composerBg=composite([...shade,.48],pageBg);
   const sample=await c.evaluate(`(()=>{const s=(id,pseudo)=>{const e=document.querySelector(id),v=getComputedStyle(e,pseudo);return {color:v.color,bg:v.backgroundColor,opacity:Number(v.opacity)}};return {solid:s('#solid'),app:s('#app-solid'),secondary:s('#secondary'),tertiary:s('#tertiary'),icon:s('#icon'),mutedIcon:s('#muted-icon'),input:s('input','::placeholder'),placeholder:s('.placeholder','::before'),semantic:s('#semantic'),accent:s('#accent'),scheme:getComputedStyle(document.documentElement).colorScheme}})()`);
   for(const key of ['solid','app','secondary','tertiary','icon','mutedIcon','input','placeholder']){
    const s=sample[key],under=['input','placeholder'].includes(key)?composerBg:pageBg,bg=composite(rgb(s.bg),under),fg=rgb(s.color);fg[3]=(fg[3]??1)*s.opacity;
    const contrast=ratio(composite(fg,bg),bg);assert(contrast>=4.5,`${dark?'dark':'light'} ${phase} ${key}: ${contrast.toFixed(2)}:1`);
   }
   assert.equal(sample.scheme,dark?'dark':'light');assert.equal(sample.placeholder.opacity,1);
   assert.equal(sample.semantic.bg,'rgb(186, 38, 35)');assert.equal(sample.accent.bg,'rgb(40, 102, 206)');assert.equal(sample.accent.color,'rgb(255, 255, 255)');
   if(phase!=='startup')assert(await c.evaluate('!window.__cwbStartupAppearance'),'Startup sheet survived handoff');
   if(phase!=='startup')assert.equal(await c.evaluate('getComputedStyle(document.documentElement).backgroundColor'),'rgba(0, 0, 0, 0)');
   results.push({dark,phase,contrast:'>=4.5:1'});
  }
  await c.evaluate('window.__cwbThemeGuard?.dispose();document.getElementById("codex-wallpaper-bridge-style")?.remove();window.__cwbLayout?.dispose();true');
 }
 const materialResults=[];
 // Reproduce real composer + change-card structure, including the native /50
 // modifier and the precomputed light neutral-button token seen after restart.
 await c.evaluate(`(()=>{const style=document.createElement('style');style.textContent=':root{--color-background-neutral-soft-alpha:#fff} [class~="bg-surface-elevated-secondary/50"]{background:color-mix(in oklab,var(--color-surface-elevated-secondary) 50%,transparent)} .neutral{background:var(--color-background-neutral-soft-alpha);color:var(--color-text)} .semantic{background:#ba2623;color:#fff}';document.head.append(style);window.__cwbDecorate=${decorateShell.toString()};return true})()`);
 for(const dark of [true,false])for(const opacity of [.2,.5,1]){
  const palette=dark?{r:7,g:15,b:30,dark}:{r:220,g:235,b:250,dark};
  const config={palette,visual:{glassOpacity:opacity,glassBlur:6,fontFamily:'inherit',codeFontFamily:'inherit'},darkOverlay:.4,lightOverlay:.4};
  const saved=JSON.stringify(config);
  await c.evaluate('window.__codexWallpaperBridge={ready:true};('+paintShell.toString()+')('+saved+')');
  // Insert components after painting, as when native UI renders a new turn.
  await c.evaluate(`document.querySelector('main').innerHTML='<div class="bg-surface" data-composer-layout="multiline" data-composer-surface-variant="default"><div data-composer-body><textarea>Draft</textarea></div></div><div class="bg-surface" data-composer-layout="multiline" data-composer-surface-variant="default" data-composer-utility-bar-variant="home"><div class="bg-surface" data-composer-body>Home draft</div></div><div class="overflow-hidden bg-surface-elevated-secondary/50" id="diff-card"><div class="group/turn-diff-header"><button class="neutral" id="review">Review</button><button class="semantic" id="danger">Delete</button></div><div>Changed files</div></div><div class="overflow-hidden bg-surface-elevated-secondary/50" id="other-card">Other card</div><div data-user-message-bubble>Sent message</div><div data-browser-comment-editor-surface><div class="bg-surface-elevated-secondary"><div class="bg-inherit">Comment</div></div></div>';true`);
  await c.evaluate('('+installSurfaceTheme.toString()+')('+JSON.stringify({enabled:true,shell:true,palette})+')');
  for(const phase of ['inserted','native-theme-restored']){
   if(phase==='native-theme-restored')await c.evaluate('document.documentElement.dataset.theme='+JSON.stringify(dark?'light':'dark')+';document.documentElement.style.setProperty("--color-background-neutral-soft-alpha","#fff");document.getElementById("diff-card").className="overflow-hidden bg-surface-elevated-secondary";window.__cwbAutomaticSurface.rescan();true');
   const actual=await c.evaluate(`(()=>{const s=selector=>{const v=getComputedStyle(document.querySelector(selector));return {bg:v.backgroundColor,blur:v.backdropFilter,color:v.color}};return {composer:s('[data-composer-surface-variant]:not([data-composer-utility-bar-variant])'),home:s('[data-composer-utility-bar-variant=home]'),homeBody:s('[data-composer-utility-bar-variant=home] [data-composer-body]'),body:s('[data-composer-surface-variant]:not([data-composer-utility-bar-variant]) [data-composer-body]'),card:s('#diff-card'),bubble:s('[data-user-message-bubble]'),comment:s('[data-browser-comment-editor-surface] > div'),commentBody:s('[data-browser-comment-editor-surface] .bg-inherit'),review:s('#review'),danger:s('#danger'),other:s('#other-card'),draft:document.querySelector('textarea').value}})()`);
   const expected=`${opacity===1?'rgb':'rgba'}(${palette.r}, ${palette.g}, ${palette.b}${opacity===1?'':', '+opacity})`,under=composite([palette.r,palette.g,palette.b,.4],dark?[80,80,80]:[220,220,220]);
   for(const key of ['composer','homeBody','card','bubble']){assert.equal(actual[key].bg,expected,`${phase} ${key}`);assert.equal(actual[key].blur,'blur(6px)');assert(ratio(rgb(actual[key].color),composite(rgb(actual[key].bg),under))>=4.5,`${phase} ${key} text contrast`);}
   assert.equal(actual.comment.bg,opacity===1?expected:`rgba(${palette.r}, ${palette.g}, ${palette.b}, ${Math.max(.72,opacity)})`);assert.equal(actual.comment.blur,'blur(12px)');
   assert.equal(actual.commentBody.bg,'rgba(0, 0, 0, 0)');assert.equal(actual.body.bg,'rgba(0, 0, 0, 0)');assert.equal(actual.home.bg,'rgba(0, 0, 0, 0)');
   assert.equal(actual.review.bg,dark?'rgba(233, 239, 245, 0.08)':'rgba(21, 33, 44, 0.08)');
   assert.equal(actual.review.color,dark?'rgb(233, 239, 245)':'rgb(21, 33, 44)');
   assert.equal(actual.danger.bg,'rgb(186, 38, 35)');assert.equal(actual.danger.color,'rgb(255, 255, 255)');
   assert.equal(actual.draft,'Draft');
   materialResults.push({dark,glassOpacity:opacity,phase,savedTransparentMaterial:true});
  }
  assert.equal(JSON.stringify(config),saved);
 }
 // Late portals use the same shell policy regardless of installation order or
 // native theme hydration. Child neutral layers must not stack the material.
 const portalResults=[];
 for(const dark of [true,false])for(const order of ['auto-first','paint-first']){
  const palette=dark?{r:20,g:22,b:28,dark}:{r:239,g:240,b:245,dark},config={palette,visual:{glassOpacity:.5,glassBlur:0},darkOverlay:.4,lightOverlay:.4,surfaceSync:{code:false,embedded:false}};
  await c.evaluate(`(()=>{window.__cwbDecorations?.dispose();window.__cwbAutomaticSurface?.dispose();document.body.innerHTML='<main></main>';window.__codexWallpaperBridge={ready:true};document.documentElement.dataset.theme='${dark?'light':'dark'}';return true})()`);
  const auto='('+installSurfaceTheme.toString()+')('+JSON.stringify({shell:true,palette,visual:config.visual})+')',paint='('+paintShell.toString()+')('+JSON.stringify(config)+')';
  await c.evaluate(order==='auto-first'?auto+';'+paint:paint+';'+auto);
  await c.evaluate(`document.querySelector('main').innerHTML='<div role="menu" id="menu"><div class="bg-surface-elevated-secondary" style="background:var(--color-surface-elevated-secondary)">Menu body</div><button class="semantic" style="background:#ba2623;color:white">Delete</button></div><div data-radix-menu-content id="roleless">Roleless menu</div><div data-slot="hover-card-content" id="preview"><div class="bg-inherit" style="background:inherit">Preview</div></div><div class="_SidebarFlyout_test" id="flyout">Flyout</div><div class="cm-editor" style="background:rgb(255,255,255);color:rgb(10,10,10);width:500px;height:400px" id="native-code">Native editor</div><webview class="bg-surface" id="native-web" style="--app-color-background-editor-opaque:rgb(255,255,255);display:block;width:600px;height:400px"></webview>';window.__cwbAutomaticSurface.rescan();true`);
  // Native roleless composer cards and unstyled command dialogs are separate
  // from their positioning shells; a rescan must not erase their materials.
  await c.evaluate(`(()=>{const root=document.createElement('section');root.id='native-command-cases';root.innerHTML='<div data-composer-overlay-floating-ui><div id="slash-card" class="bg-surface-elevated-secondary">Slash</div></div><div data-composer-overlay-floating-ui><div id="floating-card" class="bg-surface-elevated-secondary/90">Floating</div></div><div data-composer-overlay-floating-ui data-composer-expanded-top-tray><div id="expanded-card" data-composer-expanded-top-tray><div cmdk-root style="background:var(--composer-top-tray-background,white)"><div cmdk-list role="listbox" id="expanded-list">Expanded</div></div></div></div><div role="dialog" class="global-command-menu-dialog" id="command-shell"><div cmdk-root id="command-card"><div role="listbox" cmdk-list id="search-list">Search</div></div></div><div role="alertdialog" id="alert-card">Confirm</div><div data-menu-overlay id="click-backdrop" style="background:rgba(0,0,0,.15)"></div>';document.querySelector('main').append(root);window.__cwbAutomaticSurface.rescan();return true})()`);
  const commands=await c.evaluate(`(()=>{const s=id=>{const e=document.getElementById(id),s=getComputedStyle(e);return {bg:s.backgroundColor,blur:s.backdropFilter,scanned:e.hasAttribute('data-cwb-auto-surface')}};return {cards:['slash-card','floating-card','expanded-card','command-card','alert-card'].map(s),shells:[...document.querySelectorAll('[data-composer-overlay-floating-ui],#command-shell')].map(e=>getComputedStyle(e).backgroundColor),inner:getComputedStyle(document.querySelector('#expanded-card [cmdk-root]')).backgroundColor,backdrop:s('click-backdrop')}})()`);
  for(const card of commands.cards){assert.equal(card.bg,`rgba(${palette.r}, ${palette.g}, ${palette.b}, 0.72)`);assert.equal(card.blur,'blur(12px)');assert.equal(card.scanned,false);}
  assert(commands.shells.every(bg=>bg==='rgba(0, 0, 0, 0)'));assert.equal(commands.inner,'rgba(0, 0, 0, 0)');for(const id of ['expanded-list','search-list'])assert.equal(await c.evaluate('getComputedStyle(document.getElementById('+JSON.stringify(id)+')).backgroundColor'),'rgba(0, 0, 0, 0)');assert.equal(commands.backdrop.bg,'rgba(0, 0, 0, 0.15)');
  await c.evaluate('document.getElementById("command-card").removeAttribute("cmdk-root");document.getElementById("command-card").setAttribute("data-cmdk-root","");true');
  assert.equal(await c.evaluate('getComputedStyle(document.getElementById("command-card")).backdropFilter'),'blur(12px)');
  const value=await c.evaluate(`(()=>{const bg=s=>getComputedStyle(document.querySelector(s)).backgroundColor;return {menu:bg('#menu'),roleless:bg('#roleless'),preview:bg('#preview'),flyout:bg('#flyout'),child:bg('#menu > div'),inherit:bg('#preview > div'),code:bg('#native-code'),web:bg('#native-web'),semantic:bg('.semantic'),theme:document.documentElement.dataset.theme}})()`);
  for(const key of ['menu','roleless','preview','flyout'])assert.equal(value[key],`rgba(${palette.r}, ${palette.g}, ${palette.b}, 0.72)`,`${order} ${key}`);
  assert.equal(value.child,'rgba(0, 0, 0, 0)');assert.equal(value.inherit,'rgba(0, 0, 0, 0)');assert.equal(value.code,'rgb(255, 255, 255)');assert.equal(value.web,'rgb(255, 255, 255)');assert.equal(value.semantic,'rgb(186, 38, 35)');assert.equal(value.theme,dark?'light':'dark');
  portalResults.push({dark,order,oneMaterialLayer:true,nativeOptionsPreserved:true});
  await c.evaluate(`(()=>{const p=document.createElement('div');p.setAttribute('role','tooltip');p.className='group/diff-preview';p.style.cssText='display:flex;height:420px;flex-direction:column;justify-content:flex-end;pointer-events:none';p.innerHTML='<div id="actual-preview" style="background:var(--color-surface-elevated-secondary)"><header style="background:var(--color-surface-elevated-secondary)">File</header><div data-testid="diff-preview-scroll">Diff</div></div>';document.querySelector('main').append(p);return true})()`);
  const preview=await c.evaluate(`(()=>{const p=document.querySelector('[class~="group/diff-preview"]'),card=document.getElementById('actual-preview');return {outer:getComputedStyle(p).backgroundColor,blur:getComputedStyle(p).backdropFilter,card:getComputedStyle(card).backgroundColor,header:getComputedStyle(card.firstElementChild).backgroundColor}})()`);
  assert.equal(preview.outer,'rgba(0, 0, 0, 0)');assert.equal(preview.blur,'none');assert.equal(preview.card,`rgba(${palette.r}, ${palette.g}, ${palette.b}, 0.72)`);assert.equal(preview.header,'rgba(0, 0, 0, 0)');
  await c.evaluate(`(()=>{document.documentElement.style.setProperty('--app-color-background-editor-opaque','rgb(37, 43, 51)');const e=document.createElement('diffs-container');e.id='native-shadow-diff';e.attachShadow({mode:'open'}).innerHTML='<div data-diff style="--codex-diffs-surface:var(--color-surface);background-color:var(--codex-diffs-surface)!important">Diff</div>';document.querySelector('main').append(e);return true})()`);
  assert.equal(await c.evaluate('getComputedStyle(document.getElementById("native-shadow-diff").shadowRoot.firstElementChild).backgroundColor'),'rgb(37, 43, 51)');
  await c.evaluate('('+paintShell.toString()+')('+JSON.stringify({...config,surfaceSync:{code:true,embedded:false}})+')');
  assert.equal(await c.evaluate('getComputedStyle(document.getElementById("native-shadow-diff").shadowRoot.firstElementChild).backgroundColor'),'rgba(0, 0, 0, 0)');
 }
 const layoutResults=[];
 for(const structure of ['inside-transcript','sibling-wrapper','nested-footer']){
  await c.evaluate(`(()=>{window.__cwbLayout?.dispose();delete window.__cwbLayout;document.body.innerHTML='<div style="position:relative;height:500px;background:rgb(10,80,90)" id="viewport"><div data-app-action-timeline-scroll style="height:100%;overflow:auto"><div id="history" style="height:1800px;background:rgb(200,0,0)">Transcript</div></div><div id="footer-wrapper" style="position:absolute;inset:auto 0 0"><div data-thread-scroll-footer style="height:120px;position:relative"><div aria-hidden="true" class="bg-surface"></div><input id="draft" value="Draft" style="position:absolute;left:20px;top:20px;width:100px;height:30px;background:rgb(0,200,0);border:0;padding:0;color:black"></div></div></div>';if(${JSON.stringify(structure)}==='inside-transcript'){const f=document.querySelector('[data-thread-scroll-footer]');f.style.position='absolute';f.style.bottom='0';f.style.width='100%';document.querySelector('[data-app-action-timeline-scroll]').append(f);document.getElementById('footer-wrapper').remove();}window.__codexWallpaperBridge={ready:true};(${paintShell.toString()})({palette:{r:20,g:22,b:28,dark:true},visual:{glassOpacity:.5},darkOverlay:.4});return true})()`);
  if(structure==='nested-footer')await c.evaluate(`(()=>{const scroll=document.querySelector('[data-app-action-timeline-scroll]'),history=document.getElementById('history'),footer=document.querySelector('[data-thread-scroll-footer]'),content=document.createElement('div');footer.style.position='absolute';footer.style.bottom='0';footer.style.width='100%';content.append(history,footer);scroll.append(content);document.getElementById('footer-wrapper').remove();return true})()`);
  for(const height of [120,180]){
   await c.evaluate('document.querySelector("[data-thread-scroll-footer]").style.height='+JSON.stringify(height+'px')+';true');
   const sample=await c.call('Runtime.evaluate',{expression:'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const s=document.querySelector("[data-app-action-timeline-scroll]"),f=document.querySelector("[data-thread-scroll-footer]");resolve({gap:f.getBoundingClientRect().top-s.getBoundingClientRect().bottom,height:s.clientHeight,adapted:s.hasAttribute("data-cwb-thread-space")})})))',awaitPromise:true,returnByValue:true});
   const value=sample.result.value;assert(!value.adapted&&value.height===500,JSON.stringify({structure,height,...value}));assert.equal(await c.evaluate('!!window.__cwbLayout'),false);assert.equal(await c.evaluate('getComputedStyle(document.querySelector("[data-thread-scroll-footer] > [aria-hidden=true]")).backgroundColor'),'rgba(0, 0, 0, 0)');
   for(const top of [0,400,1300]){
    await c.evaluate('document.querySelector("[data-app-action-timeline-scroll]").scrollTop='+top+';window.__cwbTranscriptPaint.refresh();true');
    const geometry=await c.evaluate(`(()=>{const s=document.querySelector('[data-app-action-timeline-scroll]'),f=document.querySelector('[data-thread-scroll-footer]'),r=f.getBoundingClientRect();return {height:s.clientHeight,scrollHeight:s.scrollHeight,top:s.scrollTop,clip:getComputedStyle(document.getElementById('history')).clipPath,point:{x:r.left+160,y:r.top+60},input:{x:r.left+110,y:r.top+40},draft:document.getElementById('draft').value}})()`);
    assert.equal(geometry.height,500);assert.equal(geometry.scrollHeight,1800);assert.equal(geometry.top,top);assert.notEqual(geometry.clip,'none');assert.equal(geometry.draft,'Draft');
    const png=(await c.call('Page.captureScreenshot',{format:'png'})).data;
    const pixels=await c.call('Runtime.evaluate',{expression:`new Promise(resolve=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const x=canvas.getContext('2d');x.drawImage(img,0,0);const pixel=p=>[...x.getImageData(Math.round(p.x),Math.round(p.y),1,1).data].slice(0,3);resolve({under:pixel(${JSON.stringify(geometry.point)}),input:pixel(${JSON.stringify(geometry.input)})})};img.src='data:image/png;base64,${png}'})`,awaitPromise:true,returnByValue:true});
    assert.deepEqual(pixels.result.value.under,[10,80,90],`${structure} footer=${height} scroll=${top}: history leaked`);assert.deepEqual(pixels.result.value.input,[0,200,0],'Composer was clipped with transcript');
   }
   layoutResults.push({structure,footerHeight:height,nativeGeometryPreserved:true,historyOccludedAtThreeScrollPositions:true});
  }
 }
 // Streaming may update existing text nodes without child-list mutations or
 // changing the scrollport/footer. Its content box must drive the paint clip.
 await c.evaluate(`(()=>{window.__cwbTranscriptPaint?.dispose();document.body.innerHTML='<div id="stream-viewport" style="height:500px;position:relative"><div data-app-action-timeline-scroll style="height:100%;overflow:auto;overflow-anchor:none"><div id="stream" style="white-space:pre;line-height:20px;font-size:14px">'+('Line\\n'.repeat(60))+'</div></div><div data-thread-scroll-footer style="position:absolute;inset:auto 0 0;height:120px"></div></div>';window.__codexWallpaperBridge={ready:true};(${paintShell.toString()})({palette:{r:20,g:22,b:28,dark:true},darkOverlay:.4});return true})()`);
 const clipBefore=await c.evaluate('parseFloat(document.getElementById("stream").style.getPropertyValue("--cwb-transcript-clip"))');
 await c.evaluate('document.getElementById("stream").firstChild.data+="More\\n".repeat(10);true');
 await c.call('Runtime.evaluate',{expression:'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',awaitPromise:true});
 const grown=await c.evaluate('({clip:parseFloat(document.getElementById("stream").style.getPropertyValue("--cwb-transcript-clip")),top:document.querySelector("[data-app-action-timeline-scroll]").scrollTop})');assert(grown.clip>=clipBefore+199);assert.equal(grown.top,0);
 await c.evaluate('('+clearShell.toString()+')();true');assert.equal(await c.evaluate('!!window.__cwbTranscriptPaint||!!document.querySelector("[data-cwb-transcript-content]")||!!document.getElementById("codex-wallpaper-bridge-style")'),false);
 console.log(JSON.stringify({kind:'isolated-chromium-theme-hydration',results,materialResults,portalResults,layoutResults,streamingPaintAndCleanup:true},null,2));
}finally{c?.close();browser?.kill()}
