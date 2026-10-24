export function paintShell(config){
 const state=window.__codexWallpaperBridge;if(!state?.ready)return false;
 const palette=config.palette||{r:30,g:38,b:49,dark:true};
 const dark=palette.dark;
 document.documentElement.setAttribute('data-theme',dark?'dark':'light');document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';
 const shade=[palette.r,palette.g,palette.b].join(',');
 const ink=dark?'#e9eff5':'#15212c',secondary=dark?'#b8c5d1':'#405262';
 const overlay=dark?config.darkOverlay:config.lightOverlay;
 const sync={composer:true,context:true,menus:false,settings:true,navigation:true,panels:true,code:true,embedded:true,...config.surfaceSync};
 const mediaRoot=document.getElementById('codex-wallpaper-bridge-layer')?.shadowRoot;
 if(mediaRoot){let tint=mediaRoot.querySelector('[data-cwb-shade]');if(!tint){tint=document.createElement('div');tint.setAttribute('data-cwb-shade','');mediaRoot.appendChild(tint)}tint.style.cssText=`position:absolute;inset:0;pointer-events:none;background:rgba(${shade},${overlay})`}
 let style=document.getElementById('codex-wallpaper-bridge-style');if(!style){style=document.createElement('style');style.id='codex-wallpaper-bridge-style';document.head.appendChild(style)}
 style.textContent=`html,body{background:transparent!important}body{isolation:isolate}#root,#app{position:relative;z-index:1;background:transparent!important}
 :root{--color-text-primary:${ink};--color-text-secondary:${secondary};--color-text-tertiary:${secondary};--color-bg-primary:rgba(${shade},.4);--color-bg-secondary:rgba(${shade},.48);--color-bg-tertiary:rgba(${shade},.6);--color-border-primary:rgba(128,150,170,.24);--color-border-secondary:rgba(128,150,170,.14)}
 :root{--color-surface:transparent;--color-surface-canvas:transparent;--color-surface-secondary:rgba(${shade},.22);--color-surface-tertiary:rgba(${shade},.35);--color-surface-card:rgba(${shade},.55)}
 [role="dialog"],[role="menu"],[role="listbox"],[data-slot="popover-content"],[data-radix-popper-content-wrapper]{--color-surface:var(--color-surface-elevated);--color-surface-canvas:var(--color-surface-elevated);--color-surface-secondary:var(--color-surface-elevated-secondary)}
 [role="dialog"],[role="menu"],[role="listbox"]{background:var(--color-surface-elevated)!important}
 ${sync.code?`.cm-editor,.monaco-editor{background:rgba(${shade},.58)!important;color:${ink}!important}.cm-content{color:${ink}!important}.cm-gutters{background:transparent!important;color:${secondary}!important}[data-cwb-terminal-surface]{--color-codex-terminal-background:rgba(${shade},.58)!important;--color-codex-terminal-foreground:${ink}!important;background:rgba(${shade},.58)!important;color:${ink}!important}[data-cwb-terminal-surface] .xterm{background:transparent!important}`:`.cm-editor,.monaco-editor{background:var(--app-color-background-editor-opaque,var(--color-surface-elevated-secondary))!important}`}
 ${sync.code?`[data-cwb-terminal-surface]{--color-text:${ink}!important;--color-text-primary:${ink}!important;--color-text-secondary:${secondary}!important;--color-text-tertiary:${secondary}!important;--app-color-text-foreground:${ink}!important;--app-color-text-foreground-secondary:${secondary}!important;--app-color-icon-primary:${ink}!important;--app-color-icon-secondary:${secondary}!important}`:''}
 [data-app-shell-page-surface]{color:${ink}!important}
 [data-app-shell-page-surface][data-app-shell-application-menu-bar]{background:transparent!important}
 [data-app-navigation-rail]{background:transparent!important;color:${ink}!important}
 ${sync.panels?`[class*="_RightPanel_"],[class*="_SidePanel_"],[data-app-shell-right-panel],[class*="_PanelContent_"],[class*="_FeatureNavigation_"],[class*="_SideChat"],main[class~="bg-surface"],[data-summary-panel-variant]{background:transparent!important;color:${ink}!important}[data-app-shell-right-panel] [class~="bg-surface"],[class*="_SideChat"] [class~="bg-surface"]{background:transparent!important}`:''}
 ${sync.panels?`[data-app-shell-focus-area="right-panel"]{--app-shell-panel-background:transparent}[data-app-shell-focus-area="right-panel"] [class~="bg-surface"],[data-app-shell-focus-area="right-panel"] [data-new-tab-scroll-root]{background:transparent!important;color:${ink}!important}`:''}
 ${sync.navigation?`aside.app-shell-left-panel,[data-sidebar-navigation-root],[data-sidebar-container],[class*="_SidebarPopover"],[class*="_SidebarFlyout"],[role="dialog"]:has([data-sidebar-navigation-root]),[data-radix-popper-content-wrapper]:has([data-sidebar-navigation-root]){background:rgba(${shade},.22)!important;color:${ink}!important}`:''}
 main:is(.main-surface,[data-app-shell-main-surface],[class*="_MainContentSurface_"]),header:is(.app-header-tint,[data-app-shell-header-edge-scroll],[class*="_Header_"]){background:transparent!important}
 ${sync.embedded?`webview[class~="bg-surface"]{background:transparent!important}`:`webview[class~="bg-surface"]{background:var(--color-surface-elevated-secondary)!important}`}
 ${sync.composer?`[data-composer-surface-variant][data-composer-layout]{background:rgba(${shade},.48)!important;backdrop-filter:none!important}[data-composer-surface-variant] [data-composer-body]{background:transparent!important;backdrop-filter:none!important}`:''}
 ${sync.composer?`[data-composer-surface-variant][data-composer-utility-bar-variant="home"]{background:transparent!important}[data-composer-utility-bar-variant="home"] [data-composer-body]{background:rgba(${shade},.48)!important}`:''}
 [data-thread-scroll-footer] [class*="_background_"],[data-thread-scroll-footer] [class*="_background_"]::before,[data-thread-scroll-footer] [class*="_background_"]::after{background:transparent!important;backdrop-filter:none!important}
 ${sync.settings?`main[data-app-shell-main-surface] [class~="electron:bg-surface"]:has([class~="group/settings"]){background:transparent!important}[class~="group/settings"] [class~="rounded-2xl"][class~="border"]{background:rgba(${shade},.48)!important;border-color:rgba(128,150,170,.24)!important;backdrop-filter:none!important}`:''}
 ${sync.context?`[data-composer-rail]{background:transparent!important;backdrop-filter:none!important}[data-composer-utility-rail]{background:rgba(${shade},.48)!important;backdrop-filter:none!important}`:''}
 ${sync.menus?`[role="menu"],[data-radix-menu-content],[role="listbox"][data-state="open"],[data-radix-popper-content-wrapper] > [role="dialog"],[data-slot="popover-content"]{background:rgba(${shade},.58)!important;color:${ink}!important;border-color:rgba(128,150,170,.24)!important;backdrop-filter:none!important}`:''}
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
 window.__cwbApplyWidgets?.(config)?.catch(error=>{if(window.__cwbWidgets)window.__cwbWidgets.status={phase:'unsupported',reason:error.message}});
 return {painted:true,dark,sharedOverlay:overlay,composerOverlay:sync.composer ? .48 : null,surfaces:sync};
}

export function paintEmbedded(config){
 if(location.origin!=='https://chatgpt.com')return {applied:false,reason:'not-chatgpt'};
 const id='codex-wallpaper-embedded-style',enabled=config.enabled!==false&&config.surfaceSync?.embedded!==false;
 let style=document.getElementById(id);if(!enabled){style?.remove();if(window.__cwbEmbeddedOriginal){document.documentElement.style.colorScheme=window.__cwbEmbeddedOriginal.scheme;document.documentElement.classList.toggle('dark',window.__cwbEmbeddedOriginal.dark);delete window.__cwbEmbeddedOriginal}return {applied:false,reason:'disabled'}}
 const p=config.palette||{r:20,g:22,b:28,dark:true},shade=[p.r,p.g,p.b].join(','),ink=p.dark?'#e9eff5':'#15212c';
 window.__cwbEmbeddedOriginal??={scheme:document.documentElement.style.colorScheme,dark:document.documentElement.classList.contains('dark')};document.documentElement.style.colorScheme=p.dark?'dark':'light';document.documentElement.classList.toggle('dark',!!p.dark);
 if(!style){style=document.createElement('style');style.id=id;(document.head||document.documentElement).append(style)}
 style.textContent=`:root{--main-surface-primary:transparent;--main-surface-secondary:rgba(${shade},.4);--main-surface-tertiary:rgba(${shade},.5);--sidebar-surface-primary:transparent;--sidebar-surface-secondary:rgba(${shade},.3);--text-primary:${ink};--text-secondary:${ink}}html,body,#root,#__next,main,[data-sidebar-container],[class~="bg-token-main-surface-primary"],[class~="bg-token-sidebar-surface-primary"]{background:transparent!important;color:${ink}}[role="dialog"],[role="menu"],[class~="bg-token-main-surface-secondary"]{background:rgba(${shade},.97)!important}[data-testid="composer"],[id="composer-background"]{background:rgba(${shade},.6)!important}`;
 return {applied:true,dark:p.dark};
}
