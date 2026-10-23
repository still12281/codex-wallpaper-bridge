export function paintShell(config){
 const state=window.__codexWallpaperBridge;if(!state?.ready)return false;
 const palette=config.palette||{r:30,g:38,b:49,dark:true};
 const dark=palette.dark;
 document.documentElement.setAttribute('data-theme',dark?'dark':'light');document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';
 const shade=[palette.r,palette.g,palette.b].join(',');
 const ink=dark?'#e9eff5':'#15212c',secondary=dark?'#b8c5d1':'#405262';
 const overlay=dark?config.darkOverlay:config.lightOverlay;
 const side=config.sidebarOverlay??0.38,composer=config.composerOverlay??0.25;
 const mediaRoot=document.getElementById('codex-wallpaper-bridge-layer')?.shadowRoot;
 if(mediaRoot){let tint=mediaRoot.querySelector('[data-cwb-shade]');if(!tint){tint=document.createElement('div');tint.setAttribute('data-cwb-shade','');mediaRoot.appendChild(tint)}tint.style.cssText=`position:absolute;inset:0;pointer-events:none;background:rgba(${shade},${overlay})`}
 let style=document.getElementById('codex-wallpaper-bridge-style');if(!style){style=document.createElement('style');style.id='codex-wallpaper-bridge-style';document.head.appendChild(style)}
 style.textContent=`html,body{background:transparent!important}body{isolation:isolate}#root,#app{position:relative;z-index:1;background:transparent!important}
 :root{--color-text-primary:${ink};--color-text-secondary:${secondary};--color-text-tertiary:${secondary};--color-bg-primary:rgba(${shade},.4);--color-bg-secondary:rgba(${shade},.48);--color-bg-tertiary:rgba(${shade},.6);--color-border-primary:rgba(128,150,170,.24);--color-border-secondary:rgba(128,150,170,.14)}
 [data-app-shell-page-surface]{color:${ink}!important}
 [data-app-shell-page-surface][data-app-shell-application-menu-bar]{background:transparent!important}
 [data-app-navigation-rail]{background:transparent!important;color:${ink}!important}
 [class*="_RightPanel_"],[class*="_SidePanel_"],[data-app-shell-right-panel],[class*="_PanelContent_"],[class*="_FeatureNavigation_"]{background:transparent!important;color:${ink}!important}
 main:is(.main-surface,[data-app-shell-main-surface],[class*="_MainContentSurface_"]),aside.app-shell-left-panel,[data-sidebar-navigation-root],header:is(.app-header-tint,[data-app-shell-header-edge-scroll],[class*="_Header_"]){background:transparent!important}
 [data-composer-surface-variant][data-composer-layout]{background:rgba(${shade},${Math.min(composer,.16)})!important;backdrop-filter:none!important}
 [data-thread-scroll-footer] [class*="_background_"],[data-thread-scroll-footer] [class*="_background_"]::before,[data-thread-scroll-footer] [class*="_background_"]::after{background:transparent!important;backdrop-filter:none!important}
 main[data-app-shell-main-surface] [class~="electron:bg-surface"]:has([class~="group/settings"]){background:transparent!important}
 [class~="group/settings"] [class~="rounded-2xl"][class~="border"]{background:rgba(${shade},.28)!important;border-color:rgba(128,150,170,.24)!important;backdrop-filter:none!important}
 [data-cwb-thread-space]:not(:has([data-expanded-composer])){height:calc(100% - var(--cwb-footer-height,160px))!important;flex:0 0 auto!important;box-sizing:border-box!important;--thread-scroll-padding-bottom:16px!important}
 [data-cwb-thread-space] [class*="_background_"][class*="_fade_"]{background:none!important}
 [data-app-shell-main-content-top-fade]:not(:has(*)),[class*="_MainContentTopFade_"]{background:transparent!important}
 #codex-wallpaper-bridge-layer{opacity:1!important;position:fixed!important;inset:0!important;z-index:-1!important;pointer-events:none!important}`;
 if(window.__cwbLayout?.version!==2){
  window.__cwbLayout?.dispose?.();const tracked=new Map();let scheduled=false;
  const refresh=()=>{scheduled=false;for(const [f,o]of tracked)if(!f.isConnected){o.disconnect();tracked.delete(f)}
   for(const f of document.querySelectorAll('[data-thread-scroll-footer]')){if(tracked.has(f))continue;const s=f.parentElement,p=f.offsetParent;if(!s?.matches('[data-app-action-timeline-scroll]')||!p)continue;
    const update=()=>{const h=f.getBoundingClientRect().height,nearBottom=s.scrollHeight-s.scrollTop-s.clientHeight<48;p.style.setProperty('--cwb-footer-height',(h+12)+'px');s.toggleAttribute('data-cwb-thread-space',h>0);if(nearBottom)requestAnimationFrame(()=>{if(s.isConnected)s.scrollTop=s.scrollHeight})};
    const o=new ResizeObserver(update);o.observe(f);tracked.set(f,o);update();
   }
  };
  const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(refresh)}};
  const observer=new MutationObserver(changes=>{if(changes.some(c=>[...c.addedNodes,...c.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('[data-thread-scroll-footer]')||n.querySelector?.('[data-thread-scroll-footer]')))))schedule()});observer.observe(document.body,{childList:true,subtree:true});
  window.__cwbLayout={version:2,refresh,dispose:()=>{observer.disconnect();for(const [f,o]of tracked){o.disconnect();f.parentElement?.removeAttribute('data-cwb-thread-space');f.offsetParent?.style.removeProperty('--cwb-footer-height')}tracked.clear()}};refresh();
 }
 return {painted:true,dark,sharedOverlay:overlay,composerOverlay:Math.min(composer,.16)};
}
