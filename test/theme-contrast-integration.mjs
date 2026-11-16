// Isolated generated Chromium page. Never connects to an existing Codex client.
import {mkdtemp,writeFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {paintShell} from '../src/wallpaper-style.mjs';
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
  await c.evaluate(`document.querySelector('main').innerHTML='<div class="bg-surface" data-composer-layout="multiline" data-composer-surface-variant="default"><div data-composer-body><textarea>Draft</textarea></div></div><div class="bg-surface" data-composer-layout="multiline" data-composer-surface-variant="default" data-composer-utility-bar-variant="home"><div class="bg-surface" data-composer-body>Home draft</div></div><div class="overflow-hidden bg-surface-elevated-secondary/50" id="diff-card"><div class="group/turn-diff-header"><button class="neutral" id="review">Review</button><button class="semantic" id="danger">Delete</button></div><div>Changed files</div></div><div class="overflow-hidden bg-surface-elevated-secondary/50" id="other-card">Other card</div>';true`);
  await c.evaluate('('+installSurfaceTheme.toString()+')('+JSON.stringify({enabled:true,shell:true,palette})+')');
  for(const phase of ['inserted','native-theme-restored']){
   if(phase==='native-theme-restored')await c.evaluate('document.documentElement.dataset.theme='+JSON.stringify(dark?'light':'dark')+';document.documentElement.style.setProperty("--color-background-neutral-soft-alpha","#fff");document.getElementById("diff-card").className="overflow-hidden bg-surface-elevated-secondary";window.__cwbAutomaticSurface.rescan();true');
   const actual=await c.evaluate(`(()=>{const s=selector=>{const v=getComputedStyle(document.querySelector(selector));return {bg:v.backgroundColor,blur:v.backdropFilter,color:v.color}};return {composer:s('[data-composer-surface-variant]:not([data-composer-utility-bar-variant])'),home:s('[data-composer-utility-bar-variant=home]'),homeBody:s('[data-composer-utility-bar-variant=home] [data-composer-body]'),body:s('[data-composer-surface-variant]:not([data-composer-utility-bar-variant]) [data-composer-body]'),card:s('#diff-card'),review:s('#review'),danger:s('#danger'),other:s('#other-card'),draft:document.querySelector('textarea').value}})()`);
   const opaque=`rgb(${palette.r}, ${palette.g}, ${palette.b})`;
   for(const key of ['composer','homeBody','card']){assert.equal(actual[key].bg,opaque,`${phase} ${key}`);assert.equal(actual[key].blur,'none');assert(ratio(rgb(actual[key].color),rgb(actual[key].bg))>=4.5,`${phase} ${key} text contrast`);}
   assert.equal(actual.body.bg,'rgba(0, 0, 0, 0)');assert.equal(actual.home.bg,'rgba(0, 0, 0, 0)');
   assert.equal(actual.review.bg,dark?'rgba(233, 239, 245, 0.08)':'rgba(21, 33, 44, 0.08)');
   assert.equal(actual.review.color,dark?'rgb(233, 239, 245)':'rgb(21, 33, 44)');
   assert.equal(actual.danger.bg,'rgb(186, 38, 35)');assert.equal(actual.danger.color,'rgb(255, 255, 255)');
   assert.notEqual(actual.other.bg,actual.card.bg);assert.equal(actual.draft,'Draft');
   materialResults.push({dark,glassOpacity:opacity,phase,opaqueEditingMaterial:true});
  }
  assert.equal(JSON.stringify(config),saved);
 }
 console.log(JSON.stringify({kind:'isolated-chromium-theme-hydration',results,materialResults},null,2));
}finally{c?.close();browser?.kill()}
