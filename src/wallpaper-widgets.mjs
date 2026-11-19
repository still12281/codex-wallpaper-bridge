// Runs in the native page. Only cells inside an active pointer selection are inspected.
export async function installNativeWidgets(config,loadModule=url=>import(url)){
 const prior=window.__cwbWidgets;
 if(prior?.version===15&&!prior.disposed){prior.config=config;await prior.refresh();return prior.status}
 prior?.dispose?.();
 const state=window.__cwbWidgets={version:15,config,disposed:false,terminals:new Set(),status:{phase:'initializing'},moduleKey:null};
 const copy=theme=>theme?{...theme}:theme;
 const contrast=value=>state.config.surfaceSync?.code===false?value:Math.max(4.5,Number.isFinite(value)?value:1);
 const effective=native=>{
  if(state.config.surfaceSync?.code===false)return native;
  const p=state.config.palette||{},dark=p.dark!==false,ink=dark?'#e9eff5':'#15212c',fallback=dark?[20,22,28]:[240,242,246];
  const rgb=['r','g','b'].map((key,i)=>Number.isFinite(p[key])?Math.round(Math.max(0,Math.min(255,p[key]))):fallback[i]);
  // Match paintShell's final tint budget instead of counting both layers twice.
  const overlay=Math.max(0,Math.min(1,(dark?state.config.darkOverlay:state.config.lightOverlay)??.4));
  const readingFloor=dark?(255-80)/(255-Math.max(...rgb)):172/Math.min(...rgb),coverage=Math.min(1,Math.max(.72,readingFloor,state.config.visual?.glassOpacity??.5,overlay));
  // A transparent cell can show any wallpaper pixel. Use the lightest possible
  // dark-theme glass (or darkest light-theme glass) as the contrast reference.
  const reference=rgb.map(n=>Math.round(n*coverage+(dark?255:0)*(1-coverage)));
  // Alpha alone makes the canvas transparent. RGB is still used for reverse
  // video and xterm's contrast calculation; transparent black loses that data.
  const theme={...native,background:'#'+reference.map(n=>n.toString(16).padStart(2,'0')).join('')+'00',foreground:ink,cursor:ink,cursorAccent:dark?'#15212c':'#e9eff5',selectionBackground:dark?'#6998cc66':'#386b9c44',selectionInactiveBackground:dark?'#6998cc44':'#386b9c33'};
  // Native UI tokens can turn both "black" and "white" into foreground ink,
  // or give them alpha. Missing keys reset to xterm's standard opaque ANSI
  // table on every theme update. Keep the original table only for restoration.
  for(const key of ['black','red','green','yellow','blue','magenta','cyan','white','brightBlack','brightRed','brightGreen','brightYellow','brightBlue','brightMagenta','brightCyan','brightWhite'])delete theme[key];
  return theme;
 };
 const selectionProperties=['--cwb-terminal-selection-active','--cwb-terminal-selection-inactive'];
 const clearSurface=surface=>{
  surface?.removeAttribute('data-cwb-terminal-surface');
  for(const property of selectionProperties)surface?.style?.removeProperty(property);
 };
 const bindSelection=terminal=>{
  const element=terminal.element;
  if(!element||typeof terminal.buffer?.active?.getLine!=='function'||!['getSelectionPosition','select','clearSelection','onSelectionChange'].every(name=>typeof terminal[name]==='function'))return null;
  const marker='data-cwb-clipped-selection',property='--cwb-terminal-selection-clip';
  let dragging=false,timer=0,frame=0,cache=null;
  const trim=(range,buffer)=>{
   const {start,end}=range,cols=terminal.cols;
   if(cache&&cache.buffer===buffer&&cache.startX===start.x&&cache.startY===start.y&&cache.endX===end.x&&cache.endY===end.y)return cache.result;
   const rowStart=y=>y===start.y?start.x:0,rowEnd=y=>y===end.y?end.x:cols;
   const containsText=y=>rowEnd(y)>rowStart(y)&&/\S/.test(buffer.getLine(y)?.translateToString(true,rowStart(y),rowEnd(y))||'');
   let first=start.y,last=end.y,result=null;
   while(first<=last&&!containsText(first))first++;
   if(first<=last){
    while(last>first&&!containsText(last))last--;
    const row=buffer.getLine(last),limit=rowEnd(last);
    let x=limit;
    for(let column=limit-1;column>=rowStart(last);column--){
     const cell=row.getCell(column);
     if(cell&&/\S/.test(cell.getChars())){x=Math.min(limit,column+cell.getWidth());break;}
    }
    result={start:{x:rowStart(first),y:first},end:{x,y:last}};
   }
   cache={buffer,startX:start.x,startY:start.y,endX:end.x,endY:end.y,result};
   return result;
  };
  const changed=(original,adjusted)=>!adjusted||original.start.y!==adjusted.start.y||original.end.y!==adjusted.end.y||original.end.x!==adjusted.end.x;
  const clearClip=()=>{if(element.hasAttribute(marker)){element.removeAttribute(marker);element.style.removeProperty(property);}};
  const refresh=()=>{
   if(!dragging)return;
   const range=terminal.getSelectionPosition(),buffer=terminal.buffer.active;
   if(!range||buffer.type!=='normal'){clearClip();return;}
   const adjusted=trim(range,buffer);
   if(!changed(range,adjusted)){clearClip();return;}
   const rows=terminal.rows,view=buffer.viewportY;
   if(!rows){clearClip();return;}
   let outline='inset(0 0 100% 0)';
   if(adjusted&&adjusted.end.y>=view&&adjusted.start.y<view+rows){
    const top=Math.max(0,adjusted.start.y-view)*100/rows;
    const lastTop=Math.min(rows,adjusted.end.y-view)*100/rows,lastBottom=Math.min(rows,adjusted.end.y-view+1)*100/rows;
    const right=adjusted.end.y>=view+rows?100:adjusted.end.x*100/terminal.cols;
    outline='polygon(0 '+top+'%,100% '+top+'%,100% '+lastTop+'%,'+right+'% '+lastTop+'%,'+right+'% '+lastBottom+'%,0 '+lastBottom+'%)';
   }
   if(element.style.getPropertyValue(property)!==outline)element.style.setProperty(property,outline);
   if(!element.hasAttribute(marker))element.setAttribute(marker,'');
  };
  const move=event=>{if(event?.altKey){dragging=false;remove();clearClip();return;}if(dragging&&!frame)frame=requestAnimationFrame(()=>{frame=0;refresh();});};
  const capture={capture:true};
  const remove=()=>{cancelAnimationFrame(frame);frame=0;document.removeEventListener('mousemove',move,capture);document.removeEventListener('mouseup',finish,capture);window.removeEventListener('blur',finish);};
  const settle=()=>{
   const range=terminal.getSelectionPosition(),buffer=terminal.buffer.active;
   cache=null;
   if(range&&buffer.type==='normal'){
    const adjusted=trim(range,buffer);
    if(!adjusted)terminal.clearSelection();
    else if(changed(range,adjusted))terminal.select(adjusted.start.x,adjusted.start.y,(adjusted.end.y-adjusted.start.y)*terminal.cols+adjusted.end.x-adjusted.start.x);
   }
   cache=null;clearClip();
  };
  const finish=()=>{if(!dragging)return;remove();dragging=false;timer=setTimeout(settle,0);};
  const start=event=>{
   if(event.button!==0)return;
   clearTimeout(timer);
   if(event.altKey||terminal.buffer.active.type!=='normal')return;
   cache=null;dragging=true;
   document.addEventListener('mousemove',move,{capture:true,passive:true});
   document.addEventListener('mouseup',finish,capture);
   window.addEventListener('blur',finish);
  };
  const subscription=terminal.onSelectionChange(refresh);
  const scroll=terminal.onScroll?.(()=>move());
  element.addEventListener('mousedown',start,capture);
  return {element,dispose(){clearTimeout(timer);remove();element.removeEventListener('mousedown',start,capture);subscription.dispose();scroll?.dispose();clearClip();}};
 };
 const apply=record=>{
  const native=state.config.surfaceSync?.code===false;
  const surface=record.terminal.element?.closest('[data-theme]')||record.terminal.element?.parentElement;
  if(record.surface&&record.surface!==surface)clearSurface(record.surface);
  record.surface=surface;
  const terminalElement=record.terminal.element;
  if(record.selection&&(native||record.selection.element!==terminalElement)){record.selection.dispose();record.selection=null;}
  if(!native&&!record.selection)record.selection=bindSelection(record.terminal);
  const theme=effective(record.nativeTheme);
  if(native)clearSurface(surface);
  else if(surface){
   surface.toggleAttribute('data-cwb-terminal-surface',true);
   for(const [index,color] of [theme.selectionBackground,theme.selectionInactiveBackground].entries()){
    const property=selectionProperties[index];
    if(surface.style?.getPropertyValue(property)!==color)surface.style?.setProperty(property,color);
   }
  }
  record.options.theme=theme;
  record.options.minimumContrastRatio=contrast(record.nativeContrast);
  if(record.terminal.element&&record.terminal.rows>0)record.terminal.refresh(0,record.terminal.rows-1);
 };
 const register=renderer=>{
  if(state.disposed)return;
  const terminal=renderer?.terminal;
  if(!terminal||[...state.terminals].some(r=>r.terminal===terminal))return;
  let proto=Object.getPrototypeOf(terminal),descriptor;
  while(proto&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(proto,'options');proto=Object.getPrototypeOf(proto)}
  if(!descriptor?.get||!descriptor?.set||Object.hasOwn(terminal,'options')||typeof terminal.refresh!=='function'||typeof terminal.dispose!=='function')throw Error('Unsupported terminal options shape');
  const options=descriptor.get.call(terminal),record={terminal,options,nativeTheme:copy(options.theme),nativeContrast:options.minimumContrastRatio,open:terminal.open,dispose:terminal.dispose,surface:null};
  const proxy=new Proxy(options,{set(target,key,value){if(!state.disposed&&key==='theme'){record.nativeTheme=copy(value);target.theme=effective(value)}else if(!state.disposed&&key==='minimumContrastRatio'){record.nativeContrast=value;target.minimumContrastRatio=contrast(value)}else Reflect.set(target,key,value);return true}});
  Object.defineProperty(terminal,'options',{configurable:true,get:()=>proxy,set(value){if(!state.disposed&&value){const patch={...value};if(Object.hasOwn(value,'theme')){record.nativeTheme=copy(value.theme);patch.theme=effective(value.theme);}if(Object.hasOwn(value,'minimumContrastRatio')){record.nativeContrast=value.minimumContrastRatio;patch.minimumContrastRatio=contrast(value.minimumContrastRatio);}descriptor.set.call(terminal,patch);}else descriptor.set.call(terminal,value)}});
  record.restore=()=>{record.selection?.dispose();clearSurface(record.surface);try{options.theme=record.nativeTheme;options.minimumContrastRatio=record.nativeContrast}catch{}delete terminal.options;if(terminal.open===record.wrappedOpen)terminal.open=record.open;if(terminal.dispose===record.wrappedDispose)terminal.dispose=record.dispose;state.terminals.delete(record)};
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
 const modules=()=>[...new Set([...document.querySelectorAll('link[rel="modulepreload"],script[src]')].filter(e=>/^app:\/\/-\/assets\/app-initial-[a-f0-9]{8,64}\.js$/.test(e.href||e.src)||(e.tagName==='SCRIPT'&&e.type==='module'&&/^app:\/\/-\/assets\/\d+\.[a-f0-9]{8,64}\.js$/.test(e.src))).map(e=>e.href||e.src))].sort();
 const managerContract=value=>value&&typeof value==='object'&&Object.getOwnPropertyDescriptor(value,'renderers')?.value instanceof Map&&dataMethod(value,'getOrCreateRenderer')&&dataMethod(value,'releaseRenderer');
 const cachedManagers=module=>{
  const loader=Object.getOwnPropertyDescriptor(module,'__webpack_require__')?.value;
  const factories=loader&&Object.getOwnPropertyDescriptor(loader,'m')?.value,cache=loader&&Object.getOwnPropertyDescriptor(loader,'c')?.value;
  if(!factories||!cache)return [];
  // Locate the contract by factory source, then read its existing cache entry.
  // Never call the loader, execute a factory, or initialize an uncached module.
  const ids=Object.entries(Object.getOwnPropertyDescriptors(factories)).filter(([,d])=>typeof d.value==='function'&&/renderers\s*=\s*new Map/.test(Function.prototype.toString.call(d.value))&&/getOrCreateRenderer/.test(Function.prototype.toString.call(d.value))&&/releaseRenderer/.test(Function.prototype.toString.call(d.value))).map(([id])=>id);
  if(ids.length>1)throw Error('Ambiguous cached terminal manager contract');
  if(!ids.length)return [];
  const record=Object.getOwnPropertyDescriptor(cache,ids[0])?.value,exports=record&&Object.getOwnPropertyDescriptor(record,'exports')?.value;
  if(!exports)return [];
  return Object.values(Object.getOwnPropertyDescriptors(exports)).map(d=>{
   if('value'in d)return d.value;
   // Rspack exports simple reference getters. Reject arbitrary accessors.
   if(d.get&&/^\s*\(\s*\)\s*=>\s*[A-Za-z_$][\w$]*\s*$/.test(Function.prototype.toString.call(d.get)))return d.get.call(exports);
   return null;
  }).filter(managerContract);
 };
 state.refresh=()=>{
  if(state.disposed)return Promise.resolve();
  const urls=modules(),key=urls.join('|');
  if(state.moduleKey===key&&state.manager){try{for(const renderer of state.manager.renderers.values())register(renderer);state.update()}catch(error){fail(error)}return state.initialized||Promise.resolve()}
  if(state.initializing)return state.initialized;
  restore();state.moduleKey=key;state.moduleUrl=urls[0];
  state.initializing=true;state.initialized=(async()=>{
  try{
   // Inspect only the page's already loaded native module. Never invoke an export
   // to find the manager, inspect React internals, or touch session/PTY buffers.
   if(!urls.length)throw Error('No loaded native terminal module');
   const modules=await Promise.all(urls.map(url=>loadModule(url)));
   if(state.disposed||window.__cwbWidgets!==state||state.moduleKey!==key)return;
   const found=modules.flatMap((module,index)=>[...Object.values(Object.getOwnPropertyDescriptors(module)).map(d=>d.value).filter(managerContract),...cachedManagers(module)].map(manager=>({manager,url:urls[index]})));
   const candidates=[...new Set(found.map(item=>item.manager))];
   if(candidates.length!==1)throw Error(candidates.length?'Ambiguous terminal manager contract':'Unsupported terminal manager contract');
   const manager=candidates[0];
   state.moduleUrl=found.find(item=>item.manager===manager).url;state.manager=manager;state.originalCreate=manager.getOrCreateRenderer;
   const originalCreate=state.originalCreate;
   state.wrappedCreate=function(...args){const renderer=originalCreate.apply(this,args);if(state.disposed||state.manager!==manager)return renderer;try{register(renderer);state.update()}catch(error){fail(error)}return renderer};
   manager.getOrCreateRenderer=state.wrappedCreate;
   for(const renderer of manager.renderers.values())register(renderer);
   state.status={phase:'ready'};state.update();
  }catch(error){if(!state.disposed&&state.moduleKey===key)fail(error)}finally{state.initializing=false;}
  })();return state.initialized;
 };
 await state.refresh();return state.status;
}
