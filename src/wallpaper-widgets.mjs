// Runs in the native page. Only public xterm options are changed; PTY/buffer data is never read.
export async function installNativeWidgets(config,loadModule=url=>import(url)){
 const prior=window.__cwbWidgets;
 if(prior?.version===4&&(!prior.disposed||prior.status.phase==='unsupported')){prior.config=config;await prior.initialized;prior.update();return prior.status}
 prior?.dispose?.();
 const state=window.__cwbWidgets={version:4,config,disposed:false,terminals:new Set(),status:{phase:'initializing'}};
 const copy=theme=>theme?{...theme}:theme;
 const effective=native=>{
  if(state.config.surfaceSync?.code===false)return native;
  const dark=state.config.palette?.dark!==false,ink=dark?'#e9eff5':'#15212c';
  return {...native,background:'#00000000',foreground:ink,cursor:ink,cursorAccent:dark?'#15212c':'#e9eff5',selectionBackground:dark?'#6998cc66':'#386b9c44',selectionInactiveBackground:dark?'#6998cc44':'#386b9c33',black:dark?'#aab7c4':'#263445',brightBlack:dark?'#aab7c4':'#455568',white:ink,brightWhite:ink,red:dark?'#ff8585':'#a31621',brightRed:dark?'#ff9e9e':'#a31621',green:dark?'#7ae0a4':'#076337',brightGreen:dark?'#a3edbf':'#076337',yellow:dark?'#f7d779':'#755000',brightYellow:dark?'#ffe6a3':'#755000',blue:dark?'#91c3ff':'#134c9a',brightBlue:dark?'#b2d5ff':'#134c9a',magenta:dark?'#d1a8ff':'#7030a0',brightMagenta:dark?'#e1c4ff':'#7030a0',cyan:dark?'#86dfe8':'#00616c',brightCyan:dark?'#b1eef4':'#00616c'};
 };
 const apply=record=>{
  const native=state.config.surfaceSync?.code===false;
  const surface=record.terminal.element?.closest('[data-theme]')||record.terminal.element?.parentElement;
  if(record.surface&&record.surface!==surface)record.surface.removeAttribute('data-cwb-terminal-surface');
  record.surface=surface;surface?.toggleAttribute('data-cwb-terminal-surface',!native);
  record.options.theme=effective(record.nativeTheme);
  if(record.terminal.element&&record.terminal.rows>0)record.terminal.refresh(0,record.terminal.rows-1);
 };
 const register=renderer=>{
  if(state.disposed)return;
  const terminal=renderer?.terminal;
  if(!terminal||[...state.terminals].some(r=>r.terminal===terminal))return;
  let proto=Object.getPrototypeOf(terminal),descriptor;
  while(proto&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(proto,'options');proto=Object.getPrototypeOf(proto)}
  if(!descriptor?.get||!descriptor?.set||Object.hasOwn(terminal,'options')||typeof terminal.refresh!=='function'||typeof terminal.dispose!=='function')throw Error('Unsupported terminal options shape');
  const options=descriptor.get.call(terminal),record={terminal,options,nativeTheme:copy(options.theme),open:terminal.open,dispose:terminal.dispose,surface:null};
  const proxy=new Proxy(options,{set(target,key,value){if(!state.disposed&&key==='theme'){record.nativeTheme=copy(value);target.theme=effective(value)}else Reflect.set(target,key,value);return true}});
  Object.defineProperty(terminal,'options',{configurable:true,get:()=>proxy,set(value){if(!state.disposed&&value&&Object.hasOwn(value,'theme')){record.nativeTheme=copy(value.theme);descriptor.set.call(terminal,{...value,theme:effective(value.theme)})}else descriptor.set.call(terminal,value)}});
  record.restore=()=>{record.surface?.removeAttribute('data-cwb-terminal-surface');try{options.theme=record.nativeTheme}catch{}delete terminal.options;if(terminal.open===record.wrappedOpen)terminal.open=record.open;if(terminal.dispose===record.wrappedDispose)terminal.dispose=record.dispose;state.terminals.delete(record)};
  record.wrappedOpen=function(...args){const result=record.open.apply(this,args);if(!state.disposed)apply(record);return result};terminal.open=record.wrappedOpen;
  record.wrappedDispose=function(...args){record.restore();return record.dispose.apply(this,args)};terminal.dispose=record.wrappedDispose;
  state.terminals.add(record);apply(record);
 };
 state.update=()=>{if(state.disposed)return;try{for(const r of state.terminals)apply(r);state.status={phase:state.config.surfaceSync?.code===false?'native':'adapted',terminals:state.terminals.size}}catch(error){fail(error)}};
 let frame=null;
 const observer=new MutationObserver(changes=>{if(!state.disposed&&frame===null&&changes.some(c=>[...c.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.xterm,[data-codex-terminal]')||n.querySelector?.('.xterm,[data-codex-terminal]'))))){frame=requestAnimationFrame(()=>{frame=null;state.update()})}});
 observer.observe(document.body,{childList:true,subtree:true});
 state.dispose=()=>{if(state.disposed)return;state.disposed=true;observer.disconnect();if(frame!==null){cancelAnimationFrame(frame);frame=null}for(const r of [...state.terminals])r.restore();if(state.manager&&typeof state.wrappedCreate==='function'&&state.manager.getOrCreateRenderer===state.wrappedCreate)state.manager.getOrCreateRenderer=state.originalCreate;state.status={phase:'disposed'}};
 const fail=error=>{state.dispose();state.status={phase:'unsupported',reason:error.message}};
 state.initialized=(async()=>{
  try{
   // Explicit compatibility gate: never call unknown exports or inspect React internals.
   const supported={'app://-/assets/app-initial-ad16eaadf81f.js':'f3t','app://-/assets/app-initial-438d1df57f70.js':'Lrt'};
   const url=[...document.querySelectorAll('link[rel="modulepreload"],script[src]')].map(e=>e.href||e.src).find(u=>Object.hasOwn(supported,u));
   if(!url)throw Error('This client version has no supported terminal theme adapter');
   const manager=(await loadModule(url))[supported[url]];
   if(state.disposed||window.__cwbWidgets!==state)return;
   if(!manager?.renderers||typeof manager.renderers.values!=='function'||typeof manager.getOrCreateRenderer!=='function'||typeof manager.releaseRenderer!=='function')throw Error('Unsupported terminal manager shape');
   state.manager=manager;state.originalCreate=manager.getOrCreateRenderer;
   state.wrappedCreate=function(...args){const renderer=state.originalCreate.apply(this,args);if(state.disposed)return renderer;try{register(renderer);state.update()}catch(error){fail(error)}return renderer};
   manager.getOrCreateRenderer=state.wrappedCreate;
   for(const renderer of manager.renderers.values())register(renderer);
   state.status={phase:'ready'};state.update();
  }catch(error){fail(error)}
 })();
 await state.initialized;return state.status;
}
