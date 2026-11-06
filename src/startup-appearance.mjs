// Serialized into the trusted top-level app document. Keep native animation,
// layout and input intact; only bridge the palette until paintShell takes over.
export function installStartupAppearance(palette,appUrl){
 if(window.top!==window)return false;
 const allowed=location.href===appUrl||(appUrl==='app://-/index.html'&&location.href.startsWith('app://-/detached-window.html'));
 if(!allowed)return false;
 if(!palette){window.__cwbStartupAppearance?.dispose();return false;}
 if(window.__codexWallpaperBridge?.ready){window.__cwbStartupAppearance?.dispose();return false;}
 window.__cwbStartupAppearance?.dispose();
 const values=[palette.r,palette.g,palette.b].map(v=>Number.isFinite(v)?Math.round(Math.max(0,Math.min(255,v))):24);
 const shade=values.join(','),dark=palette.dark!==false,ink=dark?'#e9eff5':'#15212c',secondary=dark?'#b8c5d1':'#405262';
 const style=document.createElement('style');style.id='codex-wallpaper-startup-style';
 style.textContent=`:root{color-scheme:${dark?'dark':'light'}!important;--color-text-primary:${ink}!important;--color-text-secondary:${secondary}!important;--color-text-tertiary:${secondary}!important;--app-color-text-foreground:${ink}!important;--app-color-text-foreground-secondary:${secondary}!important;--color-surface:rgb(${shade})!important;--color-surface-canvas:rgb(${shade})!important;--color-surface-secondary:rgb(${shade})!important;--color-bg-primary:rgb(${shade})!important;--color-bg-secondary:rgb(${shade})!important}html,body,#root,#app,[data-app-shell-page-surface],aside.app-shell-left-panel,main[data-app-shell-main-surface]{background:rgb(${shade})!important;color:${ink}!important}`;
 let disposed=false;
 const place=()=>{if(!disposed&&!style.isConnected&&(document.head||document.documentElement))(document.head||document.documentElement).appendChild(style);};
 const observer=new MutationObserver(place);observer.observe(document,{childList:true,subtree:true});place();
 const state={dispose(){if(disposed)return;disposed=true;observer.disconnect();style.remove();if(window.__cwbStartupAppearance===state)delete window.__cwbStartupAppearance;}};
 window.__cwbStartupAppearance=state;
 return true;
}

export async function syncStartupAppearance(c,palette,appUrl){
 const key=JSON.stringify(palette||null);
 if(c.startupPaletteKey===key)return;
 if(c.startupPaletteScript){await c.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:c.startupPaletteScript});delete c.startupPaletteScript;}
 const source='('+installStartupAppearance.toString()+')('+JSON.stringify(palette||null)+','+JSON.stringify(appUrl)+')';
 if(palette){const script=await c.call('Page.addScriptToEvaluateOnNewDocument',{source});c.startupPaletteScript=script.identifier;}
 await c.evaluate(source);c.startupPaletteKey=key;
}

export async function clearStartupAppearance(c){
 try{
  if(c.startupPaletteScript)await c.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:c.startupPaletteScript},undefined,500);
  await c.call('Runtime.evaluate',{expression:'window.__cwbStartupAppearance?.dispose();true',returnByValue:true},undefined,500);
 }catch{}finally{delete c.startupPaletteScript;delete c.startupPaletteKey;}
}
