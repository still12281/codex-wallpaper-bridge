// This function is serialized into managed documents. No observers, polling,
// prototype patches or recurring DOM walks. Explicit rescans run only on request.
export function installSurfaceTheme(config){
 if(/^(blob:|data:|devtools:)/.test(location.protocol)){window.__cwbAutomaticSurface?.dispose();return false;}
 try{if(window.frameElement?.closest('[data-cwb-renderer-id],#codex-wallpaper-bridge-layer,#codex-wallpaper-bridge-pending')){window.__cwbAutomaticSurface?.dispose();return false;}}catch{}
 document.getElementById('codex-wallpaper-embedded-style')?.remove();
 if(window.__cwbEmbeddedOriginal){const original=window.__cwbEmbeddedOriginal;if(document.documentElement){document.documentElement.style.colorScheme=original.scheme;document.documentElement.classList.toggle('dark',original.dark);}delete window.__cwbEmbeddedOriginal;}
 const previous=window.__cwbAutomaticSurface;
 const shell=!!config.shell&&window.top===window;
 if(config.enabled===false||(!shell&&config.embedded===false)){previous?.dispose();return false;}
 const key=JSON.stringify(config);
 if(previous?.key===key)return true;
 previous?.dispose();
 const p=config.palette||{r:20,g:22,b:28,dark:true},shade=[p.r,p.g,p.b].map(n=>Math.max(0,Math.min(255,Number(n)||0))).join(','),ink=p.dark===false?'#15212c':'#e9eff5';
 // Constructed stylesheets also work before <html> exists and under a strict
 // style-src CSP, without weakening CSP or touching application stylesheets.
 const sheet=new CSSStyleSheet();let css='';
 const marker='data-cwb-auto-surface',marked=[];
 // Shared design tokens and generic surface utilities, including future routes.
 // Background images, semantic colours, canvas and editor content stay intact.
 const base=`:root{--cwb-auto-ink:${ink};--cwb-auto-secondary:rgba(${shade},.42);--cwb-auto-elevated:rgba(${shade},.96)}
 html,body{background-color:transparent!important}
 :root :is(#root,#app,#__next,main,[role="main"],[data-app-shell-page-surface],[data-app-shell-main-surface],[data-app-shell-right-panel],[data-embedded-frame-host-root],webview,iframe){background-color:transparent!important}
 :root :is(.bg-surface,.bg-token-main-surface-primary,.bg-token-sidebar-surface-primary,[class~="electron:bg-surface"]){background-color:transparent!important}
 :root :is(div,section,article):has(>webview){background-color:transparent!important}
 :root :is([role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"],[data-slot="popover-content"]){background-color:var(--cwb-auto-elevated)!important}
 [${marker}]{background-color:transparent!important}`;
 const tokens=shell?'':`:root{color-scheme:${p.dark===false?'light':'dark'};--color-background:transparent!important;--background:transparent!important;--color-bg-primary:transparent!important;--color-surface:transparent!important;--color-surface-canvas:transparent!important;--main-surface-primary:transparent!important;--sidebar-surface-primary:transparent!important;--main-surface-secondary:var(--cwb-auto-secondary)!important;--sidebar-surface-secondary:var(--cwb-auto-secondary)!important;--text-primary:${ink}!important;--text-secondary:${ink}!important;--color-text-primary:${ink}!important;--color-text-secondary:${ink}!important}`;
 css=base+tokens;sheet.replaceSync(css);
 let disposed=false,analyzed=false,analysisMs=0,examined=0,limited=false,scans=0;
 const place=()=>{if(!disposed&&!document.adoptedStyleSheets.includes(sheet))document.adoptedStyleSheets=[...document.adoptedStyleSheets,sheet];};
 const neutral=value=>{const m=value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);return m&&Number(m[4]??1)>.85&&Math.max(+m[1],+m[2],+m[3])-Math.min(+m[1],+m[2],+m[3])<28;};
 const analyze=(manual=false)=>{
  if(disposed||(!manual&&analyzed)||!document.body)return;analyzed=true;if(shell&&!manual){place();return;}
  scans++;examined=0;limited=false;const started=performance.now();
  // One bounded breadth-first pass per document or explicit button press. A
  // small card or semantic UI
  // never becomes a transparent surface simply because its colour is neutral.
  const queue=[document.body],area=Math.max(1,innerWidth*innerHeight);
  for(let i=0;i<queue.length&&i<1200;i++){
   if(performance.now()-started>12){limited=true;break;}
   const e=queue[i];examined++;
   if(e.matches('script,style,svg,canvas,img,video,pre,code,button,input,textarea,select,.cm-editor,.monaco-editor,.xterm,[data-cwb-terminal-surface],[role="textbox"],[role="alert"],[role="status"],[role="progressbar"],[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"],[contenteditable="true"],[data-cwb-renderer-id],#codex-wallpaper-controls,#codex-wallpaper-bridge-layer,#codex-wallpaper-bridge-pending'))continue;
   for(const child of e.children)if(queue.length<1400)queue.push(child);
   const computed=getComputedStyle(e);if(computed.backgroundImage!=='none'||!neutral(computed.backgroundColor))continue;
   const rect=e.getBoundingClientRect();if(rect.width*rect.height<area*(manual ? .15 : .4)||rect.width<innerWidth*(manual ? .2 : .5)||rect.height<innerHeight*(manual ? .3 : .45))continue;
   if(!e.hasAttribute(marker))marked.push(e);
  }
  for(let i=marked.length-1;i>=0;i--)if(!marked[i].isConnected)marked.splice(i,1);
  for(const e of marked)if(!e.hasAttribute(marker))e.setAttribute(marker,'');
  if(queue.length>examined)limited=true;
  analysisMs=performance.now()-started;place();
 };
 const ready=()=>{place();if(document.readyState==='complete')analyze();};
 const loaded=()=>analyze();
 document.addEventListener('DOMContentLoaded',ready,{once:true});window.addEventListener('load',loaded,{once:true});
 if(document.readyState==='complete')analyze();else place();
 const state={key,snapshot:()=>({analyzed,analysisMs,examined,limited,scans,surfaces:marked.length,observers:0,polling:false}),rescan(){if(disposed||!document.body)return null;analyze(true);return this.snapshot();},dispose(){if(disposed)return;disposed=true;document.removeEventListener('DOMContentLoaded',ready);window.removeEventListener('load',loaded);document.adoptedStyleSheets=document.adoptedStyleSheets.filter(s=>s!==sheet);for(const e of marked)e.removeAttribute(marker);if(window.__cwbAutomaticSurface===state)delete window.__cwbAutomaticSurface;}};
 window.__cwbAutomaticSurface=state;return true;
}

export function managedSurfaceTargets(inventory,appUrl){
 const roots=new Set(inventory.filter(t=>t.type==='page'&&(t.url===appUrl||(appUrl==='app://-/index.html'&&t.url.startsWith('app://-/detached-window.html')))).map(t=>t.targetId));
 const accepted=new Set(roots);let changed=true;
 while(changed){changed=false;for(const t of inventory){if(accepted.has(t.targetId)||!['iframe','webview'].includes(t.type)||/^(blob:|data:|devtools:)/.test(t.url))continue;if(accepted.has(t.parentId)){accepted.add(t.targetId);changed=true;}}}
 return inventory.filter(t=>accepted.has(t.targetId)).map(t=>({...t,shell:roots.has(t.targetId)}));
}

// Owns only its own flattened sessions on a dedicated CDP connection. Page
// lifecycle notifications are idle until a document is created or navigated.
export function createAutomaticSurfaces(browser,{appUrl,getConfig,onStatus=()=>{}}){
 const inventory=new Map(),records=new Map(),pending=new Map();let closed=false,scheduled=false,scanPending=null;
 const metrics={documents:0,updates:0,errors:0};
 const report=()=>onStatus({...metrics,targets:records.size,mode:'document-events',polling:false});
 const payload=shell=>{const c=getConfig();return {enabled:c.enabled!==false&&(shell||c.surfaceSync?.embedded!==false),embedded:c.surfaceSync?.embedded!==false,palette:c.palette,shell};};
 const source=shell=>'('+installSurfaceTheme.toString()+')('+JSON.stringify(payload(shell))+')';
 const call=(r,method,params={})=>browser.call(method,params,r.sessionId,3000);
 const evaluate=(r,expression,contextId)=>call(r,'Runtime.evaluate',{expression,returnByValue:true,...(contextId?{contextId}:{})});
 const error=e=>{if(!closed){metrics.errors++;onStatus({...metrics,targets:records.size,mode:'document-events',polling:false,error:e.message});}};
 async function update(r){
  const next=source(r.shell);if(r.source===next)return;
  if(r.script)await call(r,'Page.removeScriptToEvaluateOnNewDocument',{identifier:r.script});
  const {identifier}=await call(r,'Page.addScriptToEvaluateOnNewDocument',{source:next});r.script=identifier;r.source=next;
  for(const id of r.contexts)await evaluate(r,next,id).catch(()=>{});
  if(r.type!=='iframe')await call(r,'Emulation.setDefaultBackgroundColorOverride',payload(r.shell).enabled?{color:{r:0,g:0,b:0,a:0}}:{});
  metrics.updates++;report();
 }
 async function attach(t,sessionId){
  if(records.has(t.targetId)||pending.has(t.targetId)){
   if(sessionId){await browser.call('Runtime.runIfWaitingForDebugger',{},sessionId,1000).catch(()=>{});if(records.get(t.targetId)?.sessionId!==sessionId)await browser.call('Target.detachFromTarget',{sessionId}).catch(()=>{});}return pending.get(t.targetId);
  }
  let complete;pending.set(t.targetId,new Promise(resolve=>{complete=resolve;}));let r;
  try{
   sessionId??=(await browser.call('Target.attachToTarget',{targetId:t.targetId,flatten:true})).sessionId;
   if(closed)return;
   r={targetId:t.targetId,sessionId,type:t.type,shell:t.shell,contexts:new Set()};records.set(t.targetId,r);
   await call(r,'Page.enable');await update(r);await call(r,'Runtime.enable');
   // Pause related new frame/guest documents only; never pause unrelated tabs
   // or the primary shell. Always release the child, including failed installs.
   await call(r,'Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'iframe'},{type:'webview'},{exclude:true}]});
  }catch(e){error(e);if(r){records.delete(t.targetId);await browser.call('Target.detachFromTarget',{sessionId}).catch(()=>{});}}
  finally{if(sessionId)await browser.call('Runtime.runIfWaitingForDebugger',{},sessionId,1000).catch(()=>{});pending.delete(t.targetId);complete();report();}
 }
 async function release(r){
  await Promise.all([...r.contexts].map(id=>evaluate(r,'window.__cwbAutomaticSurface?.dispose();true',id).catch(()=>{})));
  if(r.script)await call(r,'Page.removeScriptToEvaluateOnNewDocument',{identifier:r.script}).catch(()=>{});
  if(r.type!=='iframe')await call(r,'Emulation.setDefaultBackgroundColorOverride',{}).catch(()=>{});
  await browser.call('Target.detachFromTarget',{sessionId:r.sessionId}).catch(()=>{});
 }
 const reconcile=()=>{
  if(closed||scheduled)return;scheduled=true;
  queueMicrotask(()=>{scheduled=false;const managed=managedSurfaceTargets([...inventory.values()],appUrl),ids=new Set(managed.map(t=>t.targetId));
   for(const [id,r]of records)if(!ids.has(id)){records.delete(id);void release(r).catch(error);}
   for(const t of managed)if(!records.has(t.targetId)&&!pending.has(t.targetId))void attach(t);
  });
 };
 const listener=event=>{
  let m;try{m=JSON.parse(event.data);}catch{return;}
  if(closed)return;const p=m.params||{};
  if(['Target.targetCreated','Target.targetInfoChanged'].includes(m.method)){inventory.set(p.targetInfo.targetId,p.targetInfo);reconcile();}
  if(m.method==='Target.targetDestroyed'){inventory.delete(p.targetId);reconcile();}
  if(m.method==='Target.attachedToTarget'&&m.sessionId){
   const parent=[...records.values()].find(r=>r.sessionId===m.sessionId),t=p.targetInfo;
   if(parent&&!t.parentId)t.parentId=parent.targetId;inventory.set(t.targetId,t);
   const accepted=managedSurfaceTargets([...inventory.values()],appUrl).find(x=>x.targetId===t.targetId);
   if(accepted)void attach(accepted,p.sessionId);
   else void browser.call('Runtime.runIfWaitingForDebugger',{},p.sessionId,1000).catch(()=>{}).finally(()=>browser.call('Target.detachFromTarget',{sessionId:p.sessionId}).catch(()=>{}));
  }
  const r=[...records.values()].find(r=>r.sessionId===m.sessionId);if(!r)return;
  if(m.method==='Runtime.executionContextsCleared')r.contexts.clear();
  if(m.method==='Runtime.executionContextDestroyed')r.contexts.delete(p.executionContextId);
  if(m.method==='Runtime.executionContextCreated'&&p.context.auxData?.isDefault){r.contexts.add(p.context.id);metrics.documents++;void evaluate(r,r.source,p.context.id).catch(error);report();}
 };
 async function scan(){
  if(closed)throw Error('页面适配服务已停止');
  const started=performance.now(),summary={scanned:0,skipped:0,failed:0,surfaces:0,added:0,limited:0};
  const {targetInfos}=await browser.call('Target.getTargets');for(const t of targetInfos)inventory.set(t.targetId,t);
  const managed=managedSurfaceTargets(targetInfos,appUrl);
  await Promise.all(managed.map(t=>attach(t)));
  for(const t of managed){const r=records.get(t.targetId);if(!r){summary.failed++;continue;}
   for(const id of [...r.contexts]){
    try{
     const result=await evaluate(r,'(()=>{const before=window.__cwbAutomaticSurface?.snapshot().surfaces||0;'+source(r.shell)+';const after=window.__cwbAutomaticSurface?.rescan();return after?{...after,added:Math.max(0,after.surfaces-before)}:null;})()',id);
     if(result.exceptionDetails)throw Error('页面在扫描时发生变化');
     const value=result.result?.value;if(!value){summary.skipped++;continue;}
     summary.scanned++;summary.surfaces+=value.surfaces;summary.added+=value.added;if(value.limited)summary.limited++;
    }catch{summary.failed++;}
   }
  }
  summary.elapsedMs=Math.round(performance.now()-started);metrics.lastScan=summary;report();return summary;
 }
 return {
  async start(){browser.ws.addEventListener('message',listener);await browser.call('Target.setDiscoverTargets',{discover:true});const {targetInfos}=await browser.call('Target.getTargets');for(const t of targetInfos)inventory.set(t.targetId,t);reconcile();},
  async refresh(){await Promise.all([...records.values()].map(r=>update(r).catch(error)));},
  scan(){if(!scanPending)scanPending=scan().finally(()=>{scanPending=null;});return scanPending;},
  async dispose(){closed=true;browser.ws.removeEventListener('message',listener);await Promise.all([...records.values()].map(release));records.clear();browser.close();},
  snapshot:()=>({...metrics,targets:records.size,mode:'document-events',polling:false})
 };
}
