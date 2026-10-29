// Runs in the native page. Only public xterm options are changed; PTY/buffer data is never read.
export async function installNativeWidgets(config,loadModule=url=>import(url)){
 const prior=window.__cwbWidgets;
 if(prior?.version===6&&!prior.disposed){prior.config=config;await prior.refresh();prior.update();return prior.status}
 prior?.dispose?.();
 const state=window.__cwbWidgets={version:6,config,disposed:false,terminals:new Set(),status:{phase:'initializing'},moduleKey:null};
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
  record.wrappedDispose=function(...args){record.restore();try{return record.dispose.apply(this,args)}finally{state.update()}};terminal.dispose=record.wrappedDispose;
  state.terminals.add(record);apply(record);
 };
 state.update=()=>{if(state.disposed||!state.manager)return;try{for(const r of state.terminals)apply(r);state.status={phase:state.config.surfaceSync?.code===false?'native':state.terminals.size?'adapted':'armed',terminals:state.terminals.size,module:state.moduleUrl,adapter:'terminal-manager-contract-v1'}}catch(error){fail(error)}};
 let frame=null;
 const selector='.xterm,[data-codex-terminal],link[rel="modulepreload"],script[src]';
 const observer=new MutationObserver(changes=>{if(!state.disposed&&frame===null&&changes.some(c=>[...c.addedNodes].some(n=>n.nodeType===1&&(n.matches?.(selector)||n.querySelector?.(selector))))){frame=requestAnimationFrame(()=>{frame=null;state.refresh()})}});
 observer.observe(document.body,{childList:true,subtree:true});
 const restore=()=>{for(const r of [...state.terminals])r.restore();if(state.manager&&typeof state.wrappedCreate==='function'&&state.manager.getOrCreateRenderer===state.wrappedCreate)state.manager.getOrCreateRenderer=state.originalCreate;state.manager=null};
 state.dispose=()=>{if(state.disposed)return;state.disposed=true;observer.disconnect();if(frame!==null){cancelAnimationFrame(frame);frame=null}restore();state.status={phase:'disposed'}};
 const fail=error=>{restore();state.status={phase:'unsupported',reason:error.message,terminals:0,module:state.moduleUrl}};
 const dataMethod=(object,key)=>{for(let p=object;p;p=Object.getPrototypeOf(p)){const d=Object.getOwnPropertyDescriptor(p,key);if(d)return typeof d.value==='function'?d.value:null}return null};
 const modules=()=>[...new Set([...document.querySelectorAll('link[rel="modulepreload"],script[src]')].map(e=>e.href||e.src).filter(u=>/^app:\/\/-\/assets\/app-initial-[a-f0-9]{8,64}\.js$/.test(u)))].sort();
 state.refresh=()=>{
  if(state.disposed)return Promise.resolve();
  const urls=modules(),key=urls.join('|');
  if(state.moduleKey===key){if(state.manager){try{for(const renderer of state.manager.renderers.values())register(renderer);state.update()}catch(error){fail(error)}}return state.initialized||Promise.resolve()}
  restore();state.moduleKey=key;state.moduleUrl=urls[0];
  state.initialized=(async()=>{
  try{
   // Inspect only the page's already loaded native module. Never invoke an export
   // to find the manager, inspect React internals, or touch session/PTY buffers.
   if(urls.length!==1)throw Error(urls.length?'Ambiguous native terminal modules':'No loaded native terminal module');
   const module=await loadModule(urls[0]);
   if(state.disposed||window.__cwbWidgets!==state||state.moduleKey!==key)return;
   const candidates=[...new Set(Object.values(module).filter(value=>value&&typeof value==='object'&&Object.getOwnPropertyDescriptor(value,'renderers')?.value instanceof Map&&dataMethod(value,'getOrCreateRenderer')&&dataMethod(value,'releaseRenderer')))];
   if(candidates.length!==1)throw Error(candidates.length?'Ambiguous terminal manager contract':'Unsupported terminal manager contract');
   const manager=candidates[0];
   state.manager=manager;state.originalCreate=manager.getOrCreateRenderer;
   const originalCreate=state.originalCreate;
   state.wrappedCreate=function(...args){const renderer=originalCreate.apply(this,args);if(state.disposed||state.manager!==manager)return renderer;try{register(renderer);state.update()}catch(error){fail(error)}return renderer};
   manager.getOrCreateRenderer=state.wrappedCreate;
   for(const renderer of manager.renderers.values())register(renderer);
   state.status={phase:'ready'};state.update();
  }catch(error){if(!state.disposed&&state.moduleKey===key)fail(error)}
  })();return state.initialized;
 };
 await state.refresh();return state.status;
}
