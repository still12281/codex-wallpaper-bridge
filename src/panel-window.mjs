// Serialized into the client. Desktop-style window chrome without an OS window.
export function installPanelWindow(host,shadow,dialog){
 const $=id=>shadow.getElementById(id),positionKey='codex-wallpaper-panel-position-v1',sizeKey='codex-wallpaper-panel-size-v1';
 const style=document.createElement('style');style.textContent=`dialog[aria-labelledby="title"]{position:fixed;box-sizing:border-box;padding:0;min-width:0;min-height:0;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:hidden;border-radius:10px}dialog[aria-labelledby="title"][open]{display:flex;flex-direction:column}.cwb-titlebar{display:flex;align-items:center;flex:0 0 44px;gap:8px;padding:0 8px 0 16px;touch-action:none;user-select:none;border-bottom:1px solid #8195a430}.cwb-titlebar h2{font-size:14px;font-weight:600;margin:0;flex:1;padding:0}.cwb-titlebar button{position:static!important;float:none!important;padding:0!important;width:36px;height:30px;border:0;border-radius:4px;background:transparent!important}.cwb-titlebar button:hover{background:#8195a430!important}.cwb-titlebar #close:hover{background:#b52d36!important;color:white!important}.cwb-window-body{min-height:0;flex:1;overflow:auto;padding:4px 20px 18px;overscroll-behavior:contain}.cwb-window-body label{margin-top:12px}.cwb-window-body p{margin:8px 0;font-size:12px}#status{min-height:18px;margin:8px 0}.cwb-resize{position:absolute;touch-action:none;z-index:8}dialog[data-maximized="true"] .cwb-resize{display:none}`;style.textContent+=`
 .cwb-window-body{container:cwb-panel / inline-size;min-width:0;scroll-padding:12px;scrollbar-gutter:stable;padding:4px 16px 18px}
 .cwb-window-body *,dialog *{box-sizing:border-box}
 .cwb-titlebar{min-width:0}.cwb-titlebar h2{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cwb-titlebar button{flex-shrink:0}
 .cwb-window-body section,#cwb-visual{grid-template-columns:repeat(2,minmax(0,1fr))}
 .cwb-window-body :is(label,select,input,details,section,.cwb-preview){min-width:0;max-width:100%}
 .cwb-window-body :is(p,strong,summary,button,label){overflow-wrap:anywhere}
 .cwb-window-body input[type=checkbox]{width:16px!important;height:16px;margin:0 6px 0 0!important;vertical-align:middle;flex-shrink:0}
 .cwb-row{gap:8px;align-items:center}.cwb-row>*{flex:1 1 140px;min-width:0}
 .cwb-library-filters>label{flex-basis:120px}.cwb-pagination{justify-content:space-between}.cwb-pagination>*{flex:0 1 auto}.cwb-pagination #cwb-page{min-width:60px}
 .cwb-card{display:flex;flex-direction:column}.cwb-card label{display:flex;align-items:center;gap:4px;margin-top:auto}.cwb-card span:not(.cwb-badge){display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;max-height:none;overflow:hidden}.cwb-preview-head strong{min-width:0;flex:1}
 #engine-import-actions button{flex:1 1 140px}#cwb-batch-status{flex-basis:100%}
 #cwb-import-preview{display:flex;flex-direction:column;gap:12px}
 #cwb-import-preview>:is(p,label,div){margin:0}
 #cwb-import-preview>label{display:flex;flex-direction:column;gap:8px}
 #cwb-import-preview>label select{display:block;margin:0}
 #engine-import-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
 #cwb-import-preview>.cwb-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding-top:12px;border-top:1px solid var(--cwb-border)}
 #cwb-batch-status{grid-column:1/-1;line-height:1.6}
 #cwb-import-preview button,.cwb-preview .cwb-row button{min-height:40px}
 .cwb-library-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:end}
 .cwb-library-filters>label{margin:0}.cwb-library-filters select{display:block;margin-top:6px}
 .cwb-card .cwb-import-state{font-size:11px;opacity:.8;padding-top:0}
 .cwb-feature>.cwb-row,.cwb-feature>button{margin-top:12px}
 .cwb-window-body section{row-gap:12px}
 dialog:not([aria-labelledby=title]){box-sizing:border-box;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto}
 @container cwb-panel (max-width:360px){.cwb-window-body section,#cwb-visual{grid-template-columns:minmax(0,1fr)}.cwb-preview-head{flex-wrap:wrap}.cwb-row>button{flex-basis:100%}.cwb-pagination>button{flex-basis:auto}}
 @container cwb-panel (max-width:360px){#engine-import-actions,#cwb-import-preview>.cwb-row{grid-template-columns:minmax(0,1fr)}}

 :host{--cwb-radius:8px;--cwb-control-height:34px}
 :host button{min-height:var(--cwb-control-height);padding:7px 12px;border:1px solid var(--cwb-border);border-radius:var(--cwb-radius);line-height:1.4;font-weight:500;background:var(--cwb-field);color:var(--cwb-ink);transition:background-color 100ms,border-color 100ms;white-space:normal}
 :host button:not(:disabled):hover{background:color-mix(in srgb,var(--cwb-field),var(--cwb-ink) 8%)}
 :host button:not(:disabled):active{background:color-mix(in srgb,var(--cwb-field),var(--cwb-ink) 15%)}
 :host button:disabled{opacity:.48;cursor:default}
 :host :is(button,input,select,summary,.cwb-titlebar):focus-visible{outline:2px solid var(--cwb-accent);outline-offset:2px}
 :host button[data-cwb-variant=primary]{background:var(--cwb-accent);color:var(--cwb-on-accent);border-color:transparent}
 :host button[data-cwb-variant=primary]:not(:disabled):hover{background:color-mix(in srgb,var(--cwb-accent),var(--cwb-ink) 12%)}
 :host button[data-cwb-variant=primary]:not(:disabled):active{background:color-mix(in srgb,var(--cwb-accent),var(--cwb-ink) 20%)}
 :host button[data-cwb-variant=danger]{color:var(--cwb-danger);background:var(--cwb-danger-bg);border-color:currentColor}
 :host button[data-cwb-variant=danger]:not(:disabled):hover{background:color-mix(in srgb,var(--cwb-danger-bg),var(--cwb-danger) 12%)}
 :host button[data-cwb-variant=danger]:not(:disabled):active{background:color-mix(in srgb,var(--cwb-danger-bg),var(--cwb-danger) 20%)}
 :host :is(select,input:not([type=checkbox]):not([type=range]):not([type=file])),:host #engine-picker input:not([type=checkbox]){min-height:var(--cwb-control-height);border:1px solid var(--cwb-border);border-radius:var(--cwb-radius);background:var(--cwb-field);color:var(--cwb-ink);padding:7px 10px;font:inherit}
 :host :is(input[type=checkbox],input[type=range]){accent-color:var(--cwb-accent)}
 :host input[type=color]{padding:3px!important;min-width:48px}
 :host .cwb-window-body p{opacity:1;color:var(--cwb-muted);line-height:1.55}
 :host .cwb-window-body details{border-color:var(--cwb-border)}:host summary{padding:4px 0;line-height:1.6;border-radius:4px}
 :host .cwb-preview,:host #cwb-display-options{border:1px solid var(--cwb-border);border-radius:var(--cwb-radius);padding:12px;background:var(--cwb-confirm-bg)}
 :host .cwb-preview img{background:var(--cwb-field)}:host .cwb-card img{background:color-mix(in srgb,var(--cwb-field),var(--cwb-ink) 8%)}:host .cwb-card{border-color:var(--cwb-border)}
 :host .cwb-card button{background:transparent;border:0;padding:0;border-radius:0}
 :host .cwb-card button[aria-pressed=true]{outline-color:var(--cwb-accent)}
 :host #cwb-display-options h3{font-size:14px;margin:0}:host #cwb-display-options{margin:12px 0;gap:12px}
 :host .cwb-titlebar button{min-height:30px;border:0}:host #toggle{min-height:28px}
 :host dialog[aria-busy=true] #status{color:var(--cwb-accent)}
 @media(prefers-reduced-motion:reduce){:host *{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
 @media(forced-colors:active){:host button{border:1px solid ButtonText}:host :is(button,input,select,summary):focus-visible{outline-color:Highlight}}
 `;
 // Compact desktop surfaces, inspired by the referenced design analyses.
 // All effects are local CSS; no font requests, image assets or backdrop blur.
 style.textContent+=`
 :host{font:14px/1.5 "Segoe UI Variable Text","Segoe UI","Microsoft YaHei UI",system-ui,sans-serif;--cwb-radius:8px;--cwb-control-height:36px}
 dialog[aria-labelledby=title]{border:1px solid var(--cwb-divider);border-radius:12px;box-shadow:0 16px 48px #0004}
 .cwb-titlebar{flex-basis:48px;padding:0 8px 0 18px;border-color:var(--cwb-divider);background:var(--cwb-surface)}
 .cwb-titlebar h2{font-size:14px;line-height:1.4;font-weight:650;letter-spacing:.1px}
 .cwb-window-body{padding:16px;scroll-padding:16px;scrollbar-color:var(--cwb-border) transparent}
 .cwb-window-body>label{font-size:13px;font-weight:600;margin:16px 0 0}
 .cwb-window-body>label:first-child{margin-top:0}
 :host :is(button,input,select){font-family:inherit}
 :host button{font-size:13px;font-weight:600;line-height:1.5;padding:8px 12px;box-shadow:none;transition:background-color 120ms,border-color 120ms,color 120ms}
 :host button:not(:disabled){cursor:pointer}
 :host button:disabled{opacity:.58;cursor:default}
 :host dialog[aria-busy=true] :is(button,select):disabled{cursor:progress}
 :host :is(select,input:not([type=checkbox]):not([type=range]):not([type=file])){min-height:36px;padding:8px 10px;font-size:13px;line-height:1.5}
 :host select{margin-top:8px}
 :host option,:host optgroup{background:var(--cwb-field);color:var(--cwb-ink)}
 :host :is(button,input,select,summary,.cwb-titlebar):focus-visible{outline:2px solid var(--cwb-accent);outline-offset:3px}
 :host button[data-cwb-variant=danger]{background:var(--cwb-field);border-color:var(--cwb-divider)}
 :host button[data-cwb-variant=danger]:not(:disabled):hover{background:var(--cwb-danger-bg);border-color:var(--cwb-danger)}
 :host .cwb-preview,:host #cwb-display-options{border:1px solid var(--cwb-divider);border-radius:12px;background:var(--cwb-surface);padding:14px}
 :host .cwb-preview{margin:12px 0 16px}
 :host .cwb-preview .cwb-row{gap:10px}
 :host .cwb-preview :is(p,label){font-weight:400}
 :host #library-preview-name{font-size:14px;line-height:1.5;font-weight:650;color:var(--cwb-ink);margin-top:10px}
 :host #library-preview-mode{font-size:12px;line-height:1.6;margin:4px 0 12px}
 :host #library-preview-image{width:100%;max-height:160px;object-fit:contain;border-radius:8px}
 :host .cwb-preview-head{align-items:center;gap:12px}
 :host .cwb-preview-head img{width:56px;height:56px;object-fit:cover;border-radius:8px;flex:0 0 56px}
 :host .cwb-preview-head strong{font-size:14px;line-height:1.5;font-weight:650}
 :host #cwb-import-preview{gap:14px}
 :host #cwb-selected-import-state{color:var(--cwb-accent);font-size:12px;line-height:1.5}
 :host #cwb-import-preview>label{font-size:13px;font-weight:600}
 :host #engine-import-actions{gap:10px}
 :host #cwb-import-preview>.cwb-row{padding-top:14px;border-color:var(--cwb-divider);gap:10px}
 :host #cwb-batch-status{font-size:12px;font-weight:500;color:var(--cwb-muted)}
 :host .cwb-library-filters{gap:12px;padding:12px;border:1px solid var(--cwb-divider);border-radius:10px;background:var(--cwb-surface);margin-top:12px}
 :host .cwb-library-filters label{font-size:12px;font-weight:600}
 :host .cwb-library-filters select{font-size:13px;padding:8px;min-height:36px}
 :host .cwb-library-grid{gap:12px;margin:14px 0}
 :host .cwb-card{border:1px solid var(--cwb-divider);border-radius:10px;background:var(--cwb-surface)}
 :host .cwb-card:has(button[aria-pressed=true]){border-color:var(--cwb-accent)}
 :host .cwb-card button{padding:0;border:0;border-radius:0;background:transparent;min-height:0;text-align:left;line-height:1.5}
 :host .cwb-card button:not(:disabled):hover{background:var(--cwb-raised)}
 :host .cwb-card button[aria-pressed=true]{outline:2px solid var(--cwb-accent);outline-offset:-2px}
 :host .cwb-card button>span{padding:8px 10px;font-size:12px;line-height:1.55;font-weight:600}
 :host .cwb-card .cwb-badge{font-size:11px;font-weight:400;color:var(--cwb-muted);padding-top:0}
 :host .cwb-card .cwb-import-state{font-size:11px;font-weight:500;color:var(--cwb-muted);padding:0 10px 10px;opacity:1}
 :host .cwb-card label{min-height:34px;padding:8px 10px;gap:6px;background:var(--cwb-field);border-top:1px solid var(--cwb-divider);font-size:12px}
 :host .cwb-pagination{margin:12px 0 16px;gap:12px}
 :host .cwb-pagination button{min-height:34px}
 :host .cwb-window-body details.cwb-feature{margin-top:16px;padding:0;border:1px solid var(--cwb-divider);border-radius:10px;background:var(--cwb-surface)}
 :host details.cwb-feature>summary{padding:12px 14px;font-size:13px;line-height:1.5;font-weight:650;border-radius:9px}
 :host details.cwb-feature>summary::marker{color:var(--cwb-muted)}
 :host details.cwb-feature[open]>summary{border-bottom:1px solid var(--cwb-divider);border-radius:9px 9px 0 0}
 :host details.cwb-feature>:not(summary){margin-left:14px;margin-right:14px;max-width:calc(100% - 28px)}
 :host details.cwb-feature>:last-child:not(summary){margin-bottom:14px}
 :host details.cwb-feature :is(label,p){font-size:12px;line-height:1.6}
 :host details.cwb-feature>label{font-size:13px;font-weight:500}
 :host #cwb-visual{gap:12px 14px}
 :host #surface-options{padding-top:0;margin-top:18px}
 :host #surface-options>summary{font-size:13px;font-weight:600}
 :host #status{font-size:12px;line-height:1.65;min-height:20px;margin:14px 0;color:var(--cwb-muted);white-space:pre-wrap;overflow-wrap:anywhere}
 :host #status:not(:empty){padding:10px 12px;border:1px solid var(--cwb-divider);border-radius:8px;background:var(--cwb-surface)}
 :host footer{gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid var(--cwb-divider)}
 :host dialog:not([aria-labelledby=title]){padding:22px;border:1px solid var(--cwb-divider);border-radius:12px;background:var(--cwb-surface)}
 :host dialog:not([aria-labelledby=title]) h2{font-size:18px;line-height:1.4;margin-bottom:12px}
 :host dialog:not([aria-labelledby=title]) p{color:var(--cwb-muted);line-height:1.7}
 :host .cwb-titlebar button{min-height:30px;padding:0;border:0;background:transparent}
 :host #toggle{min-height:28px;font-weight:500}
 @container cwb-panel (max-width:360px){:host .cwb-library-filters{padding:10px;gap:10px}:host #engine-import-actions,:host #cwb-import-preview>.cwb-row{grid-template-columns:minmax(0,1fr)}:host .cwb-library-grid{gap:10px}}
 @media(prefers-reduced-motion:reduce){:host *{transition:none!important;animation:none!important}}
 `;shadow.append(style);
 for(const id of ['library-apply','engine-import','cwb-display-apply','cwb-renderer-apply','apply','cwb-quality-save','cwb-choice-confirm','realtime-accept'])if($(id))$(id).dataset.cwbVariant='primary';
 for(const id of ['library-delete','delete','cwb-preset-delete'])if($(id))$(id).dataset.cwbVariant='danger';
 let maximized=false,restoreRect=null,dragging=null,sizing=null;
 const titlebar=document.createElement('header');titlebar.className='cwb-titlebar';titlebar.tabIndex=0;titlebar.title='拖动移动；双击最大化；方向键移动，Shift+方向键缩放';
 const maximize=document.createElement('button');maximize.id='panel-maximize';maximize.type='button';maximize.setAttribute('aria-label','最大化');maximize.title='最大化';maximize.innerHTML='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor"/></svg>';
 const save=()=>{if(maximized)return;const r=dialog.getBoundingClientRect();try{localStorage.setItem(positionKey,JSON.stringify({x:r.left,y:r.top}));localStorage.setItem(sizeKey,JSON.stringify({width:r.width,height:r.height}));}catch{}};
 const bounds=(x,y,width,height,persist=false)=>{const maxW=Math.max(1,innerWidth-16),maxH=Math.max(1,innerHeight-16),w=Math.min(maxW,Math.max(Math.min(360,maxW),width)),h=Math.min(maxH,Math.max(Math.min(280,maxH),height));dialog.style.width=w+'px';dialog.style.height=h+'px';dialog.style.inset='auto';dialog.style.position='fixed';dialog.style.margin='0';dialog.style.left=Math.max(8,Math.min(x,innerWidth-w-8))+'px';dialog.style.top=Math.max(8,Math.min(y,innerHeight-h-8))+'px';if(persist&&dialog.open)save();};
 const place=(x,y,persist=false)=>{const r=dialog.getBoundingClientRect();bounds(x,y,r.width,r.height,persist);};
 const size=(width,height,persist=false)=>{if(!Number.isFinite(width)||!Number.isFinite(height))return;const r=dialog.getBoundingClientRect();bounds(r.left||24,r.top||24,width,height,persist);};
 const restore=()=>{if(maximized){bounds(8,8,innerWidth-16,innerHeight-16);return;}let savedSize={width:640,height:720},position={x:Math.max(8,(innerWidth-640)/2),y:Math.max(8,(innerHeight-720)/2)};try{savedSize=JSON.parse(localStorage.getItem(sizeKey))||savedSize;position=JSON.parse(localStorage.getItem(positionKey))||position;}catch{}bounds(position.x,position.y,savedSize.width,savedSize.height);};
 const toggle=()=>{if(!maximized){const r=dialog.getBoundingClientRect();restoreRect={x:r.left,y:r.top,width:r.width,height:r.height};maximized=true;bounds(8,8,innerWidth-16,innerHeight-16);}else{maximized=false;const r=restoreRect||{x:24,y:24,width:640,height:720};bounds(r.x,r.y,r.width,r.height,true);}dialog.dataset.maximized=String(maximized);maximize.setAttribute('aria-label',maximized?'还原':'最大化');maximize.title=maximized?'还原':'最大化';};maximize.onclick=toggle;
 titlebar.ondblclick=e=>{if(!e.target.closest('button'))toggle();};
 titlebar.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;if(maximized)toggle();const r=dialog.getBoundingClientRect();dragging={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};titlebar.setPointerCapture(e.pointerId);e.preventDefault();};
 titlebar.onpointermove=e=>{if(dragging?.id===e.pointerId)place(dragging.left+e.clientX-dragging.x,dragging.top+e.clientY-dragging.y);};
 const finishDrag=e=>{if(dragging?.id===e.pointerId){dragging=null;save();}};titlebar.onpointerup=finishDrag;titlebar.onpointercancel=finishDrag;
 titlebar.onkeydown=e=>{const delta={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[e.key];if(!delta||e.target.closest('button'))return;e.preventDefault();if(maximized)toggle();const r=dialog.getBoundingClientRect();if(e.shiftKey)size(r.width+delta[0],r.height+delta[1],true);else place(r.left+delta[0],r.top+delta[1],true);};
 const body=document.createElement('div');body.className='cwb-window-body';for(const child of [...dialog.children])body.append(child);titlebar.append(body.querySelector('#title'),maximize,body.querySelector('#close'));dialog.append(titlebar,body);
 for(const edge of ['n','ne','e','se','s','sw','w','nw']){
  const grip=document.createElement('div');grip.className='cwb-resize';grip.dataset.resizeEdge=edge;const corner=edge.length===2;
  grip.style.cursor=edge==='n'||edge==='s'?'ns-resize':edge==='e'||edge==='w'?'ew-resize':edge==='ne'||edge==='sw'?'nesw-resize':'nwse-resize';
  if(corner){grip.style.width=grip.style.height='14px';grip.style[edge.includes('n')?'top':'bottom']='0';grip.style[edge.includes('w')?'left':'right']='0';}
  else if(edge==='n'||edge==='s'){grip.style.height='6px';grip.style.left=grip.style.right='14px';grip.style[edge==='n'?'top':'bottom']='0';}
  else{grip.style.width='6px';grip.style.top=grip.style.bottom='14px';grip.style[edge==='w'?'left':'right']='0';}dialog.append(grip);
  grip.onpointerdown=e=>{if(e.button!==0||maximized)return;const r=dialog.getBoundingClientRect();sizing={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,width:r.width,height:r.height};grip.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();};
  grip.onpointermove=e=>{if(sizing?.id!==e.pointerId)return;const r=sizing,dx=e.clientX-r.x,dy=e.clientY-r.y,minW=Math.min(360,innerWidth-16),minH=Math.min(280,innerHeight-16);let x=r.left,y=r.top,w=r.width,h=r.height;if(edge.includes('e'))w+=dx;if(edge.includes('s'))h+=dy;if(edge.includes('w')){w=Math.max(minW,r.width-dx);x=r.left+r.width-w;}if(edge.includes('n')){h=Math.max(minH,r.height-dy);y=r.top+r.height-h;}bounds(x,y,w,h);};
  const finish=e=>{if(sizing?.id===e.pointerId){sizing=null;save();}};grip.onpointerup=finish;grip.onpointercancel=finish;
 }
 const help=document.createElement('details');help.className='cwb-feature';help.innerHTML='<summary>帮助</summary>';for(const p of [...body.querySelectorAll('p:not([id])')])if(p.textContent.trim().length>35)help.append(p);if(help.children.length>1)body.append(help);
 const reset=document.createElement('button');reset.id='panel-reset-size';reset.textContent='重置窗口';reset.onclick=()=>{if(maximized)toggle();bounds(24,24,640,720,true);};$('done').before(reset);
 const onResize=()=>restore();restore();addEventListener('resize',onResize);const oldDispose=host.__cwbDispose;host.__cwbDispose=()=>{oldDispose?.();removeEventListener('resize',onResize);};host.__cwbSetPanelSize=(w,h)=>size(w,h,true);
 return {place,size,restore};
}
