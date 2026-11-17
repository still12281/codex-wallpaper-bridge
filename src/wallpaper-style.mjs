export function paintShell(config){
 const state=window.__codexWallpaperBridge;if(!state?.ready)return false;
 const palette=config.palette||{r:30,g:38,b:49,dark:true};
 const dark=palette.dark;
 // Own the wallpaper's CSS, not the application's theme state. Native hydration
 // and the bridge must not keep changing one another's data-theme/class.
 if(window.__cwbThemeGuard){const h=document.documentElement,theme=h.getAttribute('data-theme'),cls=h.className,scheme=h.style.colorScheme;window.__cwbThemeGuard.dispose();if(theme===null)h.removeAttribute('data-theme');else h.setAttribute('data-theme',theme);h.className=cls;h.style.colorScheme=scheme;}
 const shade=[palette.r,palette.g,palette.b].join(',');
 const ink=dark?'#e9eff5':'#15212c',secondary=dark?'#b8c5d1':'#405262',inverse=dark?'#15212c':'#e9eff5';
 // Native hydration restores data-theme and precomputed app tokens after our
 // first paint. Keep neutral foreground/background pairs in persistent CSS;
 // changing only foreground also changes the native solid-button background.
 const themeTokens=`color-scheme:${dark?'dark':'light'}!important;--app-color-text-foreground:${ink}!important;--app-color-text-foreground-secondary:${secondary}!important;--app-color-text-foreground-tertiary:${secondary}!important;--app-color-icon-primary:${ink}!important;--app-color-icon-secondary:${secondary}!important;--app-color-icon-tertiary:${secondary}!important;--app-color-text-button-primary:${inverse}!important;--app-color-text-button-secondary:${ink}!important;--app-color-text-button-tertiary:${secondary}!important;--app-color-background-button-primary:${ink}!important;--app-color-text-primary-solid:${inverse}!important;--color-text-primary-solid:${inverse}!important;--color-text-primary:${ink}!important;--color-text-secondary:${secondary}!important;--color-text-tertiary:${secondary}!important`;
 const overlay=dark?config.darkOverlay:config.lightOverlay;
 const controlOpacity=config.visual?.glassOpacity??.5,controlBlur=config.visual?.glassBlur??0;
 const controlColor=`rgba(${shade},${controlOpacity})`;
 const controlBackground=controlColor,controlFilter=controlBlur?`blur(${controlBlur}px)`:'none';
 const raisedColor=`rgba(${shade},${Math.max(.72,controlOpacity)})`,raisedFilter=`blur(${Math.max(12,controlBlur)}px)`;
 const sync={composer:true,context:true,menus:true,settings:true,navigation:true,panels:true,code:true,embedded:true,...config.surfaceSync};
 // Match card semantics, independent of native background utility variants.
 const controlSelectors=[sync.composer&&':root [data-composer-surface-variant][data-composer-layout]',sync.context&&'main [class~="overflow-hidden"]:has(>[class~="group/turn-diff-header"])',':root [data-user-message-bubble]'].filter(Boolean).join(',');
 const raisedSelectors='[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"]:not([class~="group/diff-preview"]),[data-slot="popover-content"],[data-slot="hover-card-content"],[data-radix-menu-content],[data-radix-tooltip-content]:not([class~="group/diff-preview"]),[class*="_SidebarPopover"],[class*="_SidebarFlyout"],[data-browser-comment-editor-surface] > [class~="bg-surface-elevated-secondary"],[class~="group/diff-preview"] div:has(> [data-testid="diff-preview-scroll"])';
 const mediaRoot=document.getElementById('codex-wallpaper-bridge-layer')?.shadowRoot;
 if(mediaRoot){let tint=mediaRoot.querySelector('[data-cwb-shade]');if(!tint){tint=document.createElement('div');tint.setAttribute('data-cwb-shade','');mediaRoot.appendChild(tint)}tint.style.cssText=`position:absolute;inset:0;pointer-events:none;background:rgba(${shade},${overlay})`}
 let style=document.getElementById('codex-wallpaper-bridge-style');if(!style){style=document.createElement('style');style.id='codex-wallpaper-bridge-style';document.head.appendChild(style)}
 // Native browser guests are portaled beside #root. A positive root z-index
 // would place its transparent pane above the guest and intercept mouse input.
 style.textContent=`html,body{background:transparent!important}body{isolation:isolate}#root,#app{position:relative;background:transparent!important}
 :root{${themeTokens};--color-bg-primary:rgba(${shade},.4);--color-bg-secondary:rgba(${shade},.48);--color-bg-tertiary:rgba(${shade},.6);--color-border-primary:rgba(128,150,170,.24);--color-border-secondary:rgba(128,150,170,.14)}
 [data-composer-surface-variant]{--composer-editor-placeholder-opacity:1!important}
 [data-cwb-surface],[data-cwb-native-surface]{background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important}
 ${controlSelectors?`${controlSelectors}{--cwb-control-background:${controlBackground};--cwb-control-filter:${controlFilter};--color-background-neutral-soft-alpha:rgba(${dark?'233,239,245':'21,33,44'},.08)!important;--color-background-secondary-ghost-hover:rgba(${dark?'233,239,245':'21,33,44'},.14)!important;--color-text:${ink};color:${ink}}`:''}
 :root [data-user-message-bubble]{--color-background-user-message:${controlColor}!important;--color-text-user-message:${ink}!important;--user-message-background-color:${controlColor}!important;--user-message-text-color:${ink}!important;background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important;color:${ink}!important}
 :root [data-browser-comment-editor-surface] > [class~="bg-surface-elevated-secondary"] > [class~="bg-inherit"]{background:transparent!important}
 :root{--cwb-control-background:${controlBackground};--cwb-control-filter:${controlFilter};--cwb-raised-background:${raisedColor};--cwb-raised-filter:${raisedFilter};--color-surface:transparent!important;--color-surface-canvas:transparent!important;--color-surface-secondary:rgba(${shade},.22)!important;--color-surface-tertiary:rgba(${shade},.35)!important;--color-surface-card:${controlColor}!important;--color-surface-elevated:${raisedColor}!important;--color-surface-elevated-secondary:${raisedColor}!important;--app-color-background-surface:transparent!important;--app-color-background-surface-under:transparent!important;--app-color-background-elevated-primary:${raisedColor}!important;--app-color-background-elevated-secondary:${raisedColor}!important;--app-color-background-elevated-secondary-opaque:${raisedColor}!important;--app-color-background-elevated-tertiary-opaque:${raisedColor}!important;--app-color-background-control:${controlColor}!important;--color-background-panel:transparent!important;--color-background-tooltip-classic:${raisedColor}!important;--color-background-composer-surface:${controlColor}!important;--color-background-composer-action-bar:transparent!important;--color-background-primary-soft:${controlColor}!important;--color-background-primary-soft-alpha:${controlColor}!important;--color-background-neutral-soft-alpha:rgba(${dark?'233,239,245':'21,33,44'},.08)!important;--app-shell-panel-background:transparent!important;--app-shell-sidebar-popover-background:${raisedColor}!important}
 :root :is(${raisedSelectors}):not([class~="group/diff-preview"]){background:var(--cwb-raised-background)!important;backdrop-filter:var(--cwb-raised-filter)!important;color:${ink}!important;--color-text:${ink};--color-text-primary:${ink};--color-text-secondary:${secondary};--color-text-tertiary:${secondary};--color-surface:transparent!important;--color-surface-canvas:transparent!important;--color-surface-secondary:transparent!important;--color-surface-elevated:transparent!important;--color-surface-elevated-secondary:transparent!important;--app-color-background-elevated-primary:transparent!important;--app-color-background-elevated-secondary:transparent!important;--app-color-background-elevated-secondary-opaque:transparent!important;--app-color-background-elevated-tertiary-opaque:transparent!important}
 :root :is(${raisedSelectors}) > [class~="bg-inherit"]{background:transparent!important}
 :root [class~="group/diff-preview"]{background:transparent!important;backdrop-filter:none!important}
 :root{--color-background-control-opaque:${controlColor}!important;--color-background-callout-surface:${raisedColor}!important;--color-background-activity-current:${controlColor}!important;--color-background-activity-input:${controlColor}!important;--color-background-activity-soft:${controlColor}!important;--color-background-message-reaction:${controlColor}!important;--color-background-user-message-compact:${controlColor}!important;--app-color-background-application-menu:transparent!important}
 ${sync.code?`.cm-editor,.monaco-editor{background:${controlColor}!important;color:${ink}!important}.cm-content{color:${ink}!important}.cm-gutters{background:transparent!important;color:${secondary}!important}[data-cwb-terminal-surface]{--color-codex-terminal-background:${controlColor}!important;--color-codex-terminal-foreground:${ink}!important;background:${controlColor}!important;color:${ink}!important}[data-cwb-terminal-surface] .xterm{background:transparent!important}`:''}
 diffs-container{--color-surface:${sync.code?'transparent':'var(--app-color-background-editor-opaque,Canvas)'}!important;--codex-diffs-surface:${sync.code?'transparent':'var(--app-color-background-editor-opaque,Canvas)'}!important}
 ${!sync.code?`:root[data-theme="light"] :is(.cm-editor,.monaco-editor,diffs-container){color-scheme:light}:root[data-theme="dark"] :is(.cm-editor,.monaco-editor,diffs-container){color-scheme:dark}:is(.cm-editor,.monaco-editor,diffs-container){--color-text:CanvasText;--color-text-primary:CanvasText;color:CanvasText}`:''}
 ${sync.code?`[data-cwb-terminal-surface]{--color-text:${ink}!important;--color-text-primary:${ink}!important;--color-text-secondary:${secondary}!important;--color-text-tertiary:${secondary}!important;--app-color-text-foreground:${ink}!important;--app-color-text-foreground-secondary:${secondary}!important;--app-color-icon-primary:${ink}!important;--app-color-icon-secondary:${secondary}!important}`:''}
 [data-app-shell-page-surface]{color:${ink}!important}
 [data-app-shell-page-surface][data-app-shell-application-menu-bar]{background:transparent!important}
 [data-app-navigation-rail]{background:transparent!important;color:${ink}!important}
 ${sync.panels?`[class*="_RightPanel_"],[class*="_SidePanel_"],[data-app-shell-right-panel],[class*="_PanelContent_"],[class*="_FeatureNavigation_"],[class*="_SideChat"],main[class~="bg-surface"],[data-summary-panel-variant]{background:transparent!important;color:${ink}!important}[data-app-shell-right-panel] [class~="bg-surface"],[class*="_SideChat"] [class~="bg-surface"]{background:transparent!important}`:''}
 ${sync.panels?`[data-app-shell-focus-area="right-panel"]{--app-shell-panel-background:transparent}[data-app-shell-focus-area="right-panel"] [class~="bg-surface"],[data-app-shell-focus-area="right-panel"] [data-new-tab-scroll-root]{background:transparent!important;color:${ink}!important}`:''}
 ${sync.navigation?`aside.app-shell-left-panel,aside.app-shell-left-panel [data-sidebar-navigation-root],aside.app-shell-left-panel [data-sidebar-container]{background:transparent!important;color:${ink}!important}`:''}
 main:is(.main-surface,[data-app-shell-main-surface],[class*="_MainContentSurface_"]),header:is(.app-header-tint,[data-app-shell-header-edge-scroll],[class*="_Header_"]){background:transparent!important}
 [data-app-shell-page-surface] aside.app-shell-left-panel,[data-app-shell-page-surface] header[data-app-shell-header-edge-scroll]{background:transparent!important}
 ${sync.embedded?`webview[class~="bg-surface"]{background:transparent!important}`:`webview[class~="bg-surface"]{background:var(--app-color-background-editor-opaque,Canvas)!important}`}
 ${sync.composer?`:root [data-composer-surface-variant][data-composer-layout]{background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important}[data-composer-surface-variant] [data-composer-body]{background:transparent!important;backdrop-filter:none!important}`:''}
 ${sync.composer?`:root [data-composer-surface-variant][data-composer-utility-bar-variant="home"]{background:transparent!important;backdrop-filter:none!important}:root [data-composer-utility-bar-variant="home"] [data-composer-body]{background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important}`:''}

 ${sync.settings?`main[data-app-shell-main-surface] [class~="electron:bg-surface"]:has([class~="group/settings"]){background:transparent!important}[class~="group/settings"] [class~="rounded-2xl"][class~="border"]{background:var(--cwb-control-background)!important;border-color:rgba(128,150,170,.24)!important;backdrop-filter:var(--cwb-control-filter)!important}`:''}
 ${sync.context?`[data-composer-rail]{background:transparent!important;backdrop-filter:none!important}[data-composer-utility-rail]{background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important}`:''}
 ${sync.context?`[data-composer-rail-item][class~="bg-surface-elevated-secondary"],main [class~="relative"][class~="w-fit"][class~="overflow-hidden"][class~="rounded-3xl"]>[class~="bg-surface-elevated-secondary"]{background:var(--cwb-control-background)!important;color:${ink}!important;backdrop-filter:var(--cwb-control-filter)!important}`:''}
 ${sync.context?`main [class~="overflow-hidden"]:has(>[class~="group/turn-diff-header"]){background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important}`:''}
 [data-thread-scroll-footer] > [aria-hidden="true"]{background:transparent!important}
 [data-cwb-transcript-content]{clip-path:inset(0 0 var(--cwb-transcript-clip,0px) 0)}
 [data-app-shell-main-content-top-fade]:not(:has(*)),[class*="_MainContentTopFade_"]{background:transparent!important}
 #codex-wallpaper-bridge-layer{opacity:1!important;position:fixed!important;inset:0!important;z-index:-1!important;pointer-events:none!important}`;
 // Remove legacy bridge geometry once; native layout owns transcript spacing.
 if(window.__cwbLayout){window.__cwbLayout.dispose?.();delete window.__cwbLayout;for(const e of document.querySelectorAll('[data-cwb-thread-space],[style*="--cwb-footer-height"]')){e.removeAttribute('data-cwb-thread-space');e.style.removeProperty('--cwb-footer-height');}}
 // A transparent composer reveals wallpaper, never earlier turns. Clip only
 // transcript painting using native footer bounds; leave scrollport dimensions,
 // padding, scroll positions and the composer itself entirely native.
 if(window.__cwbTranscriptPaint&&window.__cwbTranscriptPaint.version!==3)window.__cwbTranscriptPaint.dispose();
 if(!window.__cwbTranscriptPaint){
  const marked=new Set(),observed=new Set();let frame=0,disposed=false;
  const clean=e=>{e.removeAttribute('data-cwb-transcript-content');e.style.removeProperty('--cwb-transcript-clip');marked.delete(e);};
  const update=()=>{
   if(disposed)return;const active=new Set(),watch=new Set();
   for(const scroll of document.querySelectorAll('[data-app-action-timeline-scroll]')){
    const sr=scroll.getBoundingClientRect();if(!sr.width||!sr.height)continue;
    const layout=scroll.closest('[data-request-input-activity-root]')||scroll.parentElement;
    const footer=[...layout.querySelectorAll('[data-thread-scroll-footer]')].find(f=>{const r=f.getBoundingClientRect();return r.width&&r.height&&r.bottom>sr.top&&r.top<sr.bottom;});if(!footer)continue;
    const edge=Math.max(sr.top,Math.min(sr.bottom,footer.getBoundingClientRect().top));watch.add(scroll);watch.add(footer);
    const contents=[...scroll.children];
    for(let i=0;i<contents.length;i++){const e=contents[i];
     if(e.matches('[data-thread-scroll-footer]'))continue;
     if(e.querySelector('[data-thread-scroll-footer]')){contents.push(...e.children);continue;}
     const r=e.getBoundingClientRect();e.setAttribute('data-cwb-transcript-content','');e.style.setProperty('--cwb-transcript-clip',Math.max(0,r.bottom-edge)+'px');marked.add(e);active.add(e);watch.add(e);
    }
   }
   for(const e of [...marked])if(!active.has(e))clean(e);
   for(const e of watch)if(!observed.has(e)){observed.add(e);resize.observe(e);}
   for(const e of [...observed])if(!watch.has(e)){resize.unobserve(e);observed.delete(e);}
  };
  const queue=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(()=>{frame=0;update();});};
  const resize=new ResizeObserver(update),mutation=new MutationObserver(changes=>{if(changes.some(c=>[...c.addedNodes,...c.removedNodes].some(n=>n.nodeType===1&&!n.closest?.('#codex-wallpaper-bridge-layer,#codex-wallpaper-controls'))))queue();});
  mutation.observe(document.body,{childList:true,subtree:true});document.addEventListener('scroll',update,{capture:true,passive:true});document.addEventListener('input',queue,true);document.addEventListener('focusin',queue,true);document.addEventListener('click',queue,true);window.addEventListener('resize',queue);
  window.__cwbTranscriptPaint={version:3,refresh:update,dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();document.removeEventListener('scroll',update,true);document.removeEventListener('input',queue,true);document.removeEventListener('focusin',queue,true);document.removeEventListener('click',queue,true);window.removeEventListener('resize',queue);for(const e of [...marked])clean(e);delete window.__cwbTranscriptPaint;}};update();
 }else window.__cwbTranscriptPaint.refresh();
 window.__cwbApplyWidgets?.(config)?.catch(error=>{if(window.__cwbWidgets)window.__cwbWidgets.status={phase:'unsupported',reason:error.message}});
 window.__cwbDecorate?.(config);
 window.__cwbStartupAppearance?.dispose();
 return {painted:true,dark,sharedOverlay:overlay,composerOverlay:sync.composer ? controlOpacity : null,surfaces:sync};
}

// Serialized cleanup shared by disabling wallpaper and stopping its host while
// the native client remains open. No bridge paint listeners survive teardown.
export function clearShell(){
 window.__cwbTranscriptPaint?.dispose();window.__cwbLayout?.dispose?.();delete window.__cwbLayout;
 window.__cwbDecorations?.dispose();window.__cwbWidgets?.dispose?.();delete window.__cwbWidgets;
 window.__cwbThemeGuard?.dispose();document.getElementById('codex-wallpaper-bridge-style')?.remove();
}
