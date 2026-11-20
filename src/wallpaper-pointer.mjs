// Serialized into the host document; passive observation never consumes Codex input.
export function installWallpaperPointer(send,{fps=24,type='scene',bounds}={}){
 let frame=0,release=0,last={x:0,y:0,buttons:0,modifiers:0},held=0,until=0;const suppressed=new Set();
 const mods=e=>(e.ctrlKey?1:0)|(e.shiftKey?2:0)|(e.altKey?4:0)|(e.metaKey?8:0);
 const blocked=e=>e.composedPath().some(n=>n?.matches?.('button,input,select,textarea,a,[role="button"],[role="textbox"],[contenteditable]:not([contenteditable="false"]),[data-app-action-timeline-scroll],[data-message-author-role],[data-transcript-role],pre,code,#codex-wallpaper-controls'))||!!getSelection()?.toString();
 const remember=(e,buttons)=>{last={x:e.clientX,y:e.clientY,buttons,modifiers:mods(e)};};
 const emit=()=>{
  if(frame)cancelAnimationFrame(frame);
  frame=0;
  const box=bounds?.()||{left:0,top:0,width:innerWidth,height:innerHeight};
  const ratio=(coordinate,origin,size)=>Math.max(0,Math.min(1,(coordinate-origin)/Math.max(1,size)));
  send({pointer:[ratio(last.x,box.left,box.width),ratio(last.y,box.top,box.height),last.buttons,last.modifiers]});
 };
 const queue=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;emit();});};
 const move=e=>{
  const buttons=performance.now()<until?held:e.buttons;
  const excluded=!!(e.buttons||buttons)&&blocked(e);
  if(excluded&&e.buttons)suppressed.add(e.pointerId);
  remember(e,excluded||suppressed.has(e.pointerId)?0:buttons);
  queue();
 };
 const down=e=>{
  clearTimeout(release);
  if(blocked(e))suppressed.add(e.pointerId);
  held=suppressed.has(e.pointerId)?0:e.buttons;
  until=held?performance.now()+Math.max(20,Math.min(100,1000/fps+1)):0;
  remember(e,held);
  // Only a wallpaper button edge needs immediate delivery. Native controls
  // update the decorative pointer after their own event handlers have run.
  if(held)emit();else queue();
 };
 const up=e=>{
  clearTimeout(release);
  const excluded=suppressed.has(e.pointerId);
  if(excluded){
   if(!e.buttons)suppressed.delete(e.pointerId);
   held=0;until=0;
  }
  remember(e,last.buttons);
  const immediate=!excluded&&!!(held||e.buttons);
  const finish=()=>{
   held=excluded?0:e.buttons;
   last.buttons=held;last.modifiers=mods(e);
   if(immediate)emit();else queue();
  };
  if(held&&!e.buttons&&performance.now()<until)release=setTimeout(finish,until-performance.now());
  else finish();
 };
 const leave=()=>{cancelAnimationFrame(frame);clearTimeout(release);frame=release=0;held=0;until=0;suppressed.clear();last.buttons=0;send({pointerLeave:true});};
 const hidden=()=>{if(document.hidden)leave();};const wheel=e=>{if(!blocked(e))send({wheel:[e.deltaX,e.deltaY,e.deltaMode,mods(e)]});};
 document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerdown',down,{passive:true});document.addEventListener('pointerup',up,{passive:true});document.addEventListener('pointercancel',leave,{passive:true});document.documentElement.addEventListener('pointerleave',leave,{passive:true});addEventListener('blur',leave);document.addEventListener('visibilitychange',hidden);if(type==='web')document.addEventListener('wheel',wheel,{passive:true});
 return ()=>{leave();document.removeEventListener('pointermove',move);document.removeEventListener('pointerdown',down);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',leave);document.documentElement.removeEventListener('pointerleave',leave);removeEventListener('blur',leave);document.removeEventListener('visibilitychange',hidden);document.removeEventListener('wheel',wheel);};
}
