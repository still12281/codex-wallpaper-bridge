import {readFile} from 'node:fs/promises';
// Keep upstream files intact for license/hash verification; adapt their shared scope here.
export async function upstreamRuntime(){
 const read=async name=>(await readFile(new URL('../vendor/dsh-wallpaper/'+name,import.meta.url),'utf8')).replace(/export\s*\{[^}]*\};?\s*$/,'');
 const [picker,fx]=await Promise.all([read('picker-model.js'),read('fx-layer.js')]);
 return {picker:'(()=>{'+picker+'\nreturn pickerModel;})()',fx:'function(config){if(window.__cwbFx){window.__cwbFx.update(config);return;}let selection=config;const weNow=()=>performance.now(),weClampTo=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;'+fx+'\nwindow.__cwbFx={update(next){selection=next;syncFxLayer();},dispose(){disposeFxLayer();delete window.__cwbFx;}};syncFxLayer();}'};
}

export function decorateShell(config){
 const state=window.__codexWallpaperBridge;if(!state?.ready)return;
 if(window.__cwbDecorations&&window.__cwbDecorations.version!==3)window.__cwbDecorations.dispose();
 if(!window.__cwbDecorations){
  const style=document.createElement('style');style.id='cwb-decoration-style';document.head.append(style);let current=config,frame=0,target={x:0,y:0},position={x:0,y:0},effectBlend='screen';const savedAccent=document.body.style.getPropertyValue('--we-accent'),animated=new WeakSet(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const render=()=>{frame=0;const amount=reduced.matches?0:current.visual?.parallax||0,layer=document.getElementById('codex-wallpaper-bridge-layer');position.x+=(target.x-position.x)*.12;position.y+=(target.y-position.y)*.12;if(layer){layer.style.transform=amount?'translate('+position.x.toFixed(2)+'px,'+position.y.toFixed(2)+'px) scale('+(1+amount*2/Math.max(200,Math.min(innerWidth,innerHeight)))+')':'';}if(amount&&(Math.abs(target.x-position.x)>.05||Math.abs(target.y-position.y)>.05))frame=requestAnimationFrame(render);};
  const kick=()=>{if(!frame)frame=requestAnimationFrame(render);};const move=event=>{const amount=reduced.matches?0:current.visual?.parallax||0;target={x:(event.clientX/innerWidth-.5)*amount,y:(event.clientY/innerHeight-.5)*amount};if(amount)kick();};
  const pause=()=>{const visual={...current.visual,fxBlend:effectBlend};if(document.hidden||(current.pauseOnBlur&&!document.hasFocus())||reduced.matches)visual.fxEnabled=false;window.__cwbInstallFx?.(visual);};
  document.addEventListener('pointermove',move,{passive:true});document.addEventListener('visibilitychange',pause);addEventListener('focus',pause);addEventListener('blur',pause);reduced.addEventListener('change',pause);
  window.__cwbDecorations={version:3,update(next){current=next;const v=current.visual||{},layer=document.getElementById('codex-wallpaper-bridge-layer'),media=layer?.shadowRoot?.firstElementChild;
   if(media){media.style.filter='blur('+(v.wallpaperBlur||0)+'px) brightness('+(v.brightness??1)+')';media.style.scale=v.flip?'-1 1':'';const frozen=layer.shadowRoot.querySelector('[data-cwb-frozen]');if(frozen){frozen.style.filter=media.style.filter;frozen.style.scale=media.style.scale;}if(media.tagName==='VIDEO'){media.playbackRate=v.speed||1;media.volume=v.volume||0;media.muted=!v.volume;}}
   window.__codexWallpaperBridge?.setVolume?.(v.volume||0);if(layer&&!animated.has(layer)){animated.add(layer);if(!window.__cwbStartupAppearance&&!reduced.matches&&v.transitionMs)layer.animate([{opacity:0},{opacity:1}],{duration:v.transitionMs,easing:'ease-out'});}
   const palette=current.library?.find(entry=>entry.id===current.selectedId)?.palette||current.palette;
   const lightBackground=palette?.dark===false;
   effectBlend=v.fxBlend&&v.fxBlend!=='auto'?v.fxBlend:lightBackground?'normal':'screen';
   const darkAccent=lightBackground&&effectBlend==='normal';
   const channels=[palette?.r,palette?.g,palette?.b];
   // Canvas needs a concrete color. Use the wallpaper sample already cached
   // by the host, even when the user has forced a different interface theme.
   const accent=channels.every(value=>Number.isFinite(value)&&value>=0&&value<=255)
    ? 'rgb('+channels.map(value=>Math.round(darkAccent?value*.34:162+value*.35)).join(',')+')'
    : darkAccent?'#155db1':'#6cd9e8';
   document.body.style.setProperty('--we-accent',accent);
   const font=v.fontFamily==='inherit'?'':v.fontFamily,code=v.codeFontFamily==='inherit'?'':v.codeFontFamily;
   style.textContent='#we-fx-layer{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}#we-fx-layer canvas{display:block;width:100%;height:100%}'+
    (font?'#root,#app,button,input,select,textarea{font-family:"'+font+'",system-ui!important}':'')+(code?'code,pre,[class*="terminal"],.xterm{font-family:"'+code+'",monospace!important}':'')+
    (v.fontSize&&v.fontSize!==14?'#root,#app{font-size:'+v.fontSize+'px!important}':'');
   target={x:0,y:0};kick();pause();},dispose(){cancelAnimationFrame(frame);document.removeEventListener('pointermove',move);document.removeEventListener('visibilitychange',pause);removeEventListener('focus',pause);removeEventListener('blur',pause);reduced.removeEventListener('change',pause);window.__cwbFx?.dispose();if(savedAccent)document.body.style.setProperty('--we-accent',savedAccent);else document.body.style.removeProperty('--we-accent');const layer=document.getElementById('codex-wallpaper-bridge-layer');if(layer)layer.style.transform='';style.remove();delete window.__cwbDecorations;}};
 }
 window.__cwbDecorations.update(config);
}
