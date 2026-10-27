// Serialized into the host document; passive observation never consumes Codex input.
export function installWallpaperPointer(send,{fps=24,type='scene'}={}){
 let frame=0,release=0,last=[.5,.5,0,0],held=0,until=0;
 const mods=e=>(e.ctrlKey?1:0)|(e.shiftKey?2:0)|(e.altKey?4:0)|(e.metaKey?8:0);
 const blocked=e=>e.composedPath().some(n=>n?.matches?.('button,input,select,textarea,a,[role="button"],[role="textbox"],[contenteditable]:not([contenteditable="false"]),[data-app-action-timeline-scroll],[data-message-author-role],[data-transcript-role],pre,code,#codex-wallpaper-controls'))||!!getSelection()?.toString();
 const position=e=>[Math.max(0,Math.min(1,e.clientX/Math.max(1,innerWidth))),Math.max(0,Math.min(1,e.clientY/Math.max(1,innerHeight)))];
 const move=e=>{last=[...position(e),blocked(e)?0:performance.now()<until?held:e.buttons,mods(e)];if(!frame)frame=requestAnimationFrame(()=>{frame=0;send({pointer:last});});};
 const down=e=>{clearTimeout(release);held=blocked(e)?0:e.buttons;until=held?performance.now()+Math.max(20,Math.min(100,1000/fps+1)):0;last=[...position(e),held,mods(e)];send({pointer:last});};
 const up=e=>{clearTimeout(release);last=[...position(e),last[2],mods(e)];const finish=()=>{held=0;last=[last[0],last[1],0,mods(e)];send({pointer:last});};if(held&&performance.now()<until)release=setTimeout(finish,until-performance.now());else finish();};
 const leave=()=>{cancelAnimationFrame(frame);clearTimeout(release);frame=release=0;held=0;until=0;last[2]=0;send({pointerLeave:true});};
 const hidden=()=>{if(document.hidden)leave();};const wheel=e=>{if(!blocked(e))send({wheel:[e.deltaX,e.deltaY,e.deltaMode,mods(e)]});};
 document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerdown',down,{passive:true});document.addEventListener('pointerup',up,{passive:true});document.addEventListener('pointercancel',leave,{passive:true});document.documentElement.addEventListener('pointerleave',leave,{passive:true});addEventListener('blur',leave);document.addEventListener('visibilitychange',hidden);if(type==='web')document.addEventListener('wheel',wheel,{passive:true});
 return ()=>{leave();document.removeEventListener('pointermove',move);document.removeEventListener('pointerdown',down);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',leave);document.documentElement.removeEventListener('pointerleave',leave);removeEventListener('blur',leave);document.removeEventListener('visibilitychange',hidden);document.removeEventListener('wheel',wheel);};
}
