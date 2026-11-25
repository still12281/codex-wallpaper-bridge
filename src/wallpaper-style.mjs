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
 const overlay=Math.max(0,Math.min(1,(dark?config.darkOverlay:config.lightOverlay)??.4));
 const controlOpacity=config.visual?.glassOpacity??.5,controlBlur=config.visual?.glassBlur??0;
 const controlColor=`rgba(${shade},${controlOpacity})`;
 const controlBackground=controlColor,controlFilter=controlBlur?`blur(${controlBlur}px)`:'none';
 // Budget the final reading tint, including the wallpaper's existing overlay.
 // Keep this composition paired with the terminal's zero-alpha RGB reference.
 // Bound every composited channel to <=80 in dark themes or >=172 in light
 // themes. This keeps all syntax colours readable even on extreme pixels.
 const readingFloor=dark?(255-80)/(255-Math.max(palette.r,palette.g,palette.b)):172/Math.min(palette.r,palette.g,palette.b);
 const readingCoverage=Math.min(1,Math.max(.72,readingFloor,controlOpacity,overlay)),readingOpacity=overlay<1?(readingCoverage-overlay)/(1-overlay):0;
 const codeColor=`rgba(${shade},${readingOpacity})`;
 const syntax=dark?{comment:'#d0d8e0',keyword:'#dfc6ff',literal:'#ffdaaa',string:'#a3edbf',variable:'#b2d5ff',attribute:'#ffe0a3',name:'#b2d5ff',error:'#ffb6bf'}:{comment:'#263746',keyword:'#482063',literal:'#65270d',string:'#15432a',variable:'#133d5f',attribute:'#573509',name:'#133d5f',error:'#7a1929'};
 const raisedColor=`rgba(${shade},${Math.max(.72,controlOpacity)})`,raisedFilter=`blur(${Math.max(12,controlBlur)}px)`;
 const sync={composer:true,context:true,menus:true,settings:true,navigation:true,panels:true,code:true,embedded:true,...config.surfaceSync};
 // Exact class selectors keep unrelated class changes out of :has()'s
 // ancestor/descendant invalidation path (for example the native thinking shimmer).
 // Match card semantics, independent of native background utility variants.
 const controlSelectors=[sync.composer&&':root [data-composer-surface-variant][data-composer-layout]',sync.context&&'main .overflow-hidden:has(>.group\\/turn-diff-header)',':root [data-user-message-bubble]'].filter(Boolean).join(',');
 // Backdrop filters on popover wrappers trap their fixed children in a new
 // containing block. Paint the positioned surface of native previews and hints.
 const anchorHost='[popover]:has(> [data-anchor-positioning])';
 const anchoredSurface=':where([popover]:is([role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[role="tooltip"])) > [data-anchor-positioning]';
 const raisedSelectors='[data-composer-overlay-floating-ui] > :is(.bg-surface-elevated-secondary,.bg-surface-elevated-secondary\\/90),[data-composer-expanded-top-tray]:not([data-composer-overlay-floating-ui]),.global-command-menu-dialog > :is([cmdk-root],[data-cmdk-root]),[role="dialog"]:not(.global-command-menu-dialog),[role="alertdialog"],[role="menu"],[role="listbox"]:not([cmdk-list],[data-cmdk-list]),[role="tooltip"]:not(.group\\/diff-preview),[data-slot="popover-content"],[data-slot="hover-card-content"],[data-radix-menu-content],[data-radix-tooltip-content]:not(.group\\/diff-preview),[class*="_SidebarPopover"],[class*="_SidebarFlyout"],[data-browser-comment-editor-surface] > .bg-surface-elevated-secondary,.group\\/diff-preview div:has(> [data-testid="diff-preview-scroll"]),'+anchoredSurface;
 // These Codex builds use a root custom property to pause decorative animations.
 // Keep its inherited computed value stable and relay the native pause only to
 // the animation selectors in the matched build. Other builds keep native CSS.
 const assets=new Set(Array.from(document.scripts??[],script=>script.getAttribute('src')));
 const oldMotion=assets.has('/assets/782259.7a3e865ee5.js')&&assets.has('/assets/348410.1a97dde15f.js');
 const testedBuild=assets.has('/assets/903838.979fd3f34c.js')&&assets.has('/assets/348410.374a9b8f98.js');
 let nativeMotionCss='';
 if(oldMotion||testedBuild){
  const property='--decorative-animation-play-state';
  const paused=':where(:root[style*="'+property+': paused"])';
  const animated=String.raw`.animate-pulse,.animate-spin,.loading-shimmer-mask,.loading-shimmer-pure-text,
   .loading-shimmer,.loading-shimmer-dot-grid,.motion-safe\:animate-pulse,.motion-safe\:animate-spin,
   .pulsing-dot,.waveDot-qgKugp,.PrimaryAction-l16Nk7[data-animate-ready],.ReadyPulse-nQiolT[data-animate-ready],
   .LoadingResultsShimmer-IzeCFB[data-variant=chatgpt],.Overlay-UCNs2a,.screen-H27rG_`;
  const added=testedBuild?',.drifting-hMMvfl.sleeping-tS2eBh>span,.frames-EwrXvD,.gentleDot-qSvDKz,.ink-TiVe8k[data-pending]>path,.multiRow-gjn_FO .rows-zGFWQj,.reveal-uB2mBR,.box-Yz_phO,.revealing-apMfJ3,.travel-uSvNwI.paused-lapaxL,.wakeGlyphs-h36OSO':'';
  nativeMotionCss=` :root{${property}:running!important}
   ${paused} :where(${animated}${added}),
   ${paused} :where(.Placeholder-GJXpwo[data-animate],.LoadingResultsShimmer-IzeCFB)::before,
   ${paused} :where(.dots-Qf_9QK,.DetailsShimmer-w0X_00)::after{${property}:paused}
  `;
 }
 const mediaRoot=document.getElementById('codex-wallpaper-bridge-layer')?.shadowRoot;
 if(mediaRoot){let tint=mediaRoot.querySelector('[data-cwb-shade]');if(!tint){tint=document.createElement('div');tint.setAttribute('data-cwb-shade','');mediaRoot.appendChild(tint)}tint.style.cssText=`position:absolute;inset:0;pointer-events:none;background:rgba(${shade},${overlay})`}
 let style=document.getElementById('codex-wallpaper-bridge-style');if(!style){style=document.createElement('style');style.id='codex-wallpaper-bridge-style';document.head.appendChild(style)}
 // Require the native spacer and out-of-flow footer before shrinking the
 // scrollport. Both the port and spacer lose the same native clearance.
 const spacer=String.raw`.h-\[calc\(var\(--thread-scroll-padding-bottom\)-var\(--spacing\)\*4\)\]`;
 const thread='[data-request-input-activity-root] > .thread-scroll-container[data-app-action-timeline-scroll][style*="--thread-scroll-padding-bottom:"]';
 const footer='> .absolute.bottom-0 > [data-thread-scroll-footer]';
 const layoutMark='data-cwb-separated-scroll';
 const separated=thread+'['+layoutMark+']';
 // Native browser guests are portaled beside #root. A positive root z-index
 // would place its transparent pane above the guest and intercept mouse input.
 // Clipping belongs to the marked element, not every text/code descendant.
 style.textContent=`${nativeMotionCss}@property --cwb-code-clip-top{syntax:"<length>";inherits:false;initial-value:0px}
 html,body{background:transparent!important}body{isolation:isolate}#root,#app{position:relative;background:transparent!important}
 :root{${themeTokens};--color-bg-primary:rgba(${shade},.4);--color-bg-secondary:rgba(${shade},.48);--color-bg-tertiary:rgba(${shade},.6);--color-border-primary:rgba(128,150,170,.24);--color-border-secondary:rgba(128,150,170,.14)}
 [data-composer-surface-variant]{--composer-editor-placeholder-opacity:1!important}
 [data-cwb-surface],[data-cwb-native-surface]{background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important}
 ${controlSelectors?`${controlSelectors}{--cwb-control-background:${controlBackground};--cwb-control-filter:${controlFilter};--color-background-neutral-soft-alpha:rgba(${dark?'233,239,245':'21,33,44'},.08)!important;--color-background-secondary-ghost-hover:rgba(${dark?'233,239,245':'21,33,44'},.14)!important;--color-text:${ink};color:${ink}}`:''}
 :root [data-user-message-bubble]{--color-background-user-message:${controlColor}!important;--color-text-user-message:${ink}!important;--user-message-background-color:${controlColor}!important;--user-message-text-color:${ink}!important;background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important;color:${ink}!important}
 :root [data-browser-comment-editor-surface] > .bg-surface-elevated-secondary > .bg-inherit{background:transparent!important}
 :root{--cwb-control-background:${controlBackground};--cwb-control-filter:${controlFilter};--cwb-raised-background:${raisedColor};--cwb-raised-filter:${raisedFilter};--color-surface:transparent!important;--color-surface-canvas:transparent!important;--color-surface-secondary:rgba(${shade},.22)!important;--color-surface-tertiary:rgba(${shade},.35)!important;--color-surface-card:${controlColor}!important;--color-surface-elevated:${raisedColor}!important;--color-surface-elevated-secondary:${raisedColor}!important;--app-color-background-surface:transparent!important;--app-color-background-surface-under:transparent!important;--app-color-background-elevated-primary:${raisedColor}!important;--app-color-background-elevated-secondary:${raisedColor}!important;--app-color-background-elevated-secondary-opaque:${raisedColor}!important;--app-color-background-elevated-tertiary-opaque:${raisedColor}!important;--app-color-background-control:${controlColor}!important;--color-background-panel:transparent!important;--color-background-tooltip-classic:${raisedColor}!important;--color-background-composer-surface:${controlColor}!important;--color-background-composer-action-bar:transparent!important;--color-background-primary-soft:${controlColor}!important;--color-background-primary-soft-alpha:${controlColor}!important;--color-background-neutral-soft-alpha:rgba(${dark?'233,239,245':'21,33,44'},.08)!important;--app-shell-panel-background:transparent!important;--app-shell-sidebar-popover-background:${raisedColor}!important}
 :root :is(${raisedSelectors}):not(.group\\/diff-preview,:where(${anchorHost})){background:var(--cwb-raised-background)!important;backdrop-filter:var(--cwb-raised-filter)!important;color:${ink}!important;--color-text:${ink};--color-text-primary:${ink};--color-text-secondary:${secondary};--color-text-tertiary:${secondary};--color-surface:transparent!important;--color-surface-canvas:transparent!important;--color-surface-secondary:transparent!important;--color-surface-elevated:transparent!important;--color-surface-elevated-secondary:transparent!important;--app-color-background-elevated-primary:transparent!important;--app-color-background-elevated-secondary:transparent!important;--app-color-background-elevated-secondary-opaque:transparent!important;--app-color-background-elevated-tertiary-opaque:transparent!important}
 :root :is(${raisedSelectors}) > .bg-inherit{background:transparent!important}
 /* Composer shells position cards; each card owns one material layer. */
 :root [data-composer-overlay-floating-ui],:root .global-command-menu-dialog{background:transparent!important;backdrop-filter:none!important}
 :root [data-composer-expanded-top-tray]{--composer-top-tray-background:transparent!important}
 :root [data-composer-expanded-top-tray]:not([data-composer-overlay-floating-ui]) :is([cmdk-root],[data-cmdk-root],[cmdk-list],[data-cmdk-list]),:root .global-command-menu-dialog > :is([cmdk-root],[data-cmdk-root]) :is([cmdk-root],[data-cmdk-root],[cmdk-list],[data-cmdk-list]){background:transparent!important;backdrop-filter:none!important}

 :root .group\\/diff-preview,:root ${anchorHost}{background:transparent!important;backdrop-filter:none!important}
 :root{--color-background-control-opaque:${controlColor}!important;--color-background-callout-surface:${raisedColor}!important;--color-background-activity-current:${controlColor}!important;--color-background-activity-input:${controlColor}!important;--color-background-activity-soft:${controlColor}!important;--color-background-message-reaction:${controlColor}!important;--color-background-user-message-compact:${controlColor}!important;--app-color-background-application-menu:transparent!important}
 ${sync.code?`.cm-editor,.monaco-editor{background:${codeColor}!important;color:${ink}!important}.cm-content{color:${ink}!important}.cm-gutters{background:transparent!important;color:${secondary}!important}[data-cwb-terminal-surface]{--color-codex-terminal-background:${codeColor}!important;--color-codex-terminal-foreground:${ink}!important;background:${codeColor}!important;color:${ink}!important}[data-cwb-terminal-surface] .xterm{background:transparent!important}`:''}
 ${sync.code?`:root [data-code-block][data-markdown-copy="code-block"]{background:${codeColor}!important;background-image:none!important;backdrop-filter:var(--cwb-control-filter)!important;color:${ink}!important;--color-text:${ink}!important;--color-text-primary:${ink}!important;--color-text-secondary:${syntax.comment}!important;--color-text-tertiary:${syntax.comment}!important;--color-surface:transparent!important;${Object.entries(syntax).map(([key,value])=>'--color-codex-syntax-'+key+':'+value+'!important').join(';')}}:root [data-code-block][data-markdown-copy="code-block"] > [data-markdown-copy="exclude"]:has([data-code-block-controls]){background:transparent!important;background-image:none!important}:root [data-code-block][data-markdown-copy="code-block"] [data-code-block-source]{background:transparent!important;background-image:none!important;color:${ink}!important}`:''}
 diffs-container{--color-surface:${sync.code?'transparent':'var(--app-color-background-editor-opaque,Canvas)'}!important;--codex-diffs-surface:${sync.code?'transparent':'var(--app-color-background-editor-opaque,Canvas)'}!important}
 ${!sync.code?`:root[data-theme="light"] :is(.cm-editor,.monaco-editor,diffs-container){color-scheme:light}:root[data-theme="dark"] :is(.cm-editor,.monaco-editor,diffs-container){color-scheme:dark}:is(.cm-editor,.monaco-editor,diffs-container){--color-text:CanvasText;--color-text-primary:CanvasText;color:CanvasText}`:''}
 ${sync.code?`[data-cwb-terminal-surface]{--color-text:${ink}!important;--color-text-primary:${ink}!important;--color-text-secondary:${secondary}!important;--color-text-tertiary:${secondary}!important;--app-color-text-foreground:${ink}!important;--app-color-text-foreground-secondary:${secondary}!important;--app-color-icon-primary:${ink}!important;--app-color-icon-secondary:${secondary}!important}`:''}
 ${sync.code?`/* The terminal DOM renderer flattens its selection against an opaque background. */
 [data-cwb-terminal-surface] .xterm .xterm-selection>div{background-color:var(--cwb-terminal-selection-inactive)!important}
 [data-cwb-terminal-surface] .xterm.focus .xterm-selection>div{background-color:var(--cwb-terminal-selection-active)!important}
 [data-cwb-terminal-surface] .xterm[data-cwb-clipped-selection] .xterm-selection{width:100%;height:100%;clip-path:var(--cwb-terminal-selection-clip)}`:''}
 [data-app-shell-page-surface]{color:${ink}!important}
 [data-app-shell-page-surface][data-app-shell-application-menu-bar]{background:transparent!important}
 [data-app-navigation-rail]{background:transparent!important;color:${ink}!important}
 ${sync.panels?`[class*="_RightPanel_"],[class*="_SidePanel_"],[data-app-shell-right-panel],[class*="_PanelContent_"],[class*="_FeatureNavigation_"],[class*="_SideChat"],main.bg-surface,[data-summary-panel-variant]{background:transparent!important;color:${ink}!important}[data-app-shell-right-panel] .bg-surface,[class*="_SideChat"] .bg-surface{background:transparent!important}`:''}
 ${sync.panels?`[data-app-shell-focus-area="right-panel"]{--app-shell-panel-background:transparent}[data-app-shell-focus-area="right-panel"] .bg-surface,[data-app-shell-focus-area="right-panel"] [data-new-tab-scroll-root]{background:transparent!important;color:${ink}!important}`:''}
 ${sync.navigation?`aside.app-shell-left-panel,aside.app-shell-left-panel [data-sidebar-navigation-root],aside.app-shell-left-panel [data-sidebar-container]{background:transparent!important;color:${ink}!important}`:''}
 main:is(.main-surface,[data-app-shell-main-surface],[class*="_MainContentSurface_"]),header:is(.app-header-tint,[data-app-shell-header-edge-scroll],[class*="_Header_"]){background:transparent!important}
 [data-app-shell-page-surface] aside.app-shell-left-panel,[data-app-shell-page-surface] header[data-app-shell-header-edge-scroll]{background:transparent!important}
 ${sync.embedded?`webview.bg-surface{background:transparent!important}`:`webview.bg-surface{background:var(--app-color-background-editor-opaque,Canvas)!important}`}
 ${sync.composer?`:root [data-composer-surface-variant][data-composer-layout]{background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important}[data-composer-surface-variant] [data-composer-body]{background:transparent!important;backdrop-filter:none!important}`:''}
 ${sync.composer?`:root [data-composer-surface-variant][data-composer-utility-bar-variant="home"]{background:transparent!important;backdrop-filter:none!important}:root [data-composer-utility-bar-variant="home"] [data-composer-body]{background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important}`:''}

 ${sync.settings?`main[data-app-shell-main-surface] .electron\\:bg-surface:has(.group\\/settings){background:transparent!important}.group\\/settings .rounded-2xl.border:where(:not([data-settings-panel] *)){background:var(--cwb-control-background)!important;border-color:rgba(128,150,170,.24)!important;backdrop-filter:var(--cwb-control-filter)!important}`:''}
 ${sync.context?`[data-composer-rail]{background:transparent!important;backdrop-filter:none!important}[data-composer-utility-rail]{background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important}`:''}
 ${sync.context?`[data-composer-rail-item].bg-surface-elevated-secondary,main .relative.w-fit.overflow-hidden.rounded-3xl>.bg-surface-elevated-secondary{background:var(--cwb-control-background)!important;color:${ink}!important;backdrop-filter:var(--cwb-control-filter)!important}`:''}
 ${sync.context?`main .overflow-hidden:has(>.group\\/turn-diff-header){background:var(--cwb-control-background)!important;backdrop-filter:var(--cwb-control-filter)!important}`:''}
 [data-thread-scroll-footer]{background-color:rgb(${shade})!important}
 ${separated}{height:calc(100% - max(0px, var(--thread-scroll-padding-bottom) - var(--spacing)*4))!important;scroll-padding-bottom:0!important}
 ${separated} > div > ${spacer}{height:0!important}
 ${separated} ${footer},${separated} ${footer} > [aria-hidden="true"]{background:transparent!important}
 [data-cwb-code-source]{clip-path:inset(var(--cwb-code-clip-top,0px) 0 0 0)}
 [data-app-shell-main-content-top-fade]:not(:has(*)),[class*="_MainContentTopFade_"]{background:transparent!important}
 #codex-wallpaper-bridge-layer{opacity:1!important;position:fixed!important;inset:0!important;z-index:-1!important;pointer-events:none!important}`;
 // Remove legacy bridge geometry once; native layout owns transcript spacing.
 if(window.__cwbLayout){window.__cwbLayout.dispose?.();delete window.__cwbLayout;for(const e of document.querySelectorAll('[data-cwb-thread-space],[style*="--cwb-footer-height"]')){e.removeAttribute('data-cwb-thread-space');e.style.removeProperty('--cwb-footer-height');}}
 // Sticky code retains its own local clip; the transcript uses browser overflow.
 if(window.__cwbTranscriptPaint&&window.__cwbTranscriptPaint.version!==10)window.__cwbTranscriptPaint.dispose();
 if(!window.__cwbTranscriptPaint){
  const codeMarked=new Set(),observed=new Set(),pendingCode=new Set();
  let frame=0,codeFrame=0,disposed=false;
  const codeSelector='[data-code-block][data-markdown-copy="code-block"]';
  const structureSelector=[codeSelector,'[data-code-block-source]','[data-code-block-controls]'].join(',');
  let codeRoots=[];
  let readingAnchor;
  const cleanCode=e=>{e.removeAttribute('data-cwb-code-source');e.style.removeProperty('--cwb-code-clip-top');codeMarked.delete(e);};
  const writePx=(element,property,pixels)=>{
   const value=pixels+'px';
   if(element.style.getPropertyValue(property)!==value)element.style.setProperty(property,value);
  };
  const update=()=>{
   if(disposed)return;
   cancelAnimationFrame(frame);frame=0;
   cancelAnimationFrame(codeFrame);codeFrame=0;pendingCode.clear();
   const watch=new Set();
   codeRoots=window.__cwbTranscriptPaint.codeEnabled?[...document.querySelectorAll(codeSelector)]:[];
   const codes=measureCode(codeRoots,watch);
   paintCode(codes);
   for(const e of codeMarked)if(!codes.has(e))cleanCode(e);
   for(const e of watch)if(!observed.has(e)){observed.add(e);resize.observe(e);}
   for(const e of observed)if(!watch.has(e)){resize.unobserve(e);observed.delete(e);}
  };
  const measureCode=(roots,watch)=>{
   const codes=new Map();
   for(const root of roots){
    const header=root.querySelector(':scope > [data-markdown-copy="exclude"]:has([data-code-block-controls])'),source=root.querySelector('[data-code-block-source]');
    if(!header||!source)continue;
    if(watch)for(const e of [root,header,source])watch.add(e);
    const r=root.getBoundingClientRect();if(!r.width||!r.height||r.bottom<=0||r.top>=innerHeight)continue;
    const h=header.getBoundingClientRect(),s=source.getBoundingClientRect();if(!h.height||!s.height)continue;
    codes.set(source,Math.max(0,Math.min(s.height,h.bottom-s.top)));
   }
   return codes;
  };
  const paintCode=codes=>{
   for(const [e,clip]of codes){
    if(!e.hasAttribute('data-cwb-code-source'))e.setAttribute('data-cwb-code-source','');
    writePx(e,'--cwb-code-clip-top',clip);
    codeMarked.add(e);
   }
  };
  const queue=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(update);};
  const affectedBy=(target,element)=>target===element||target.contains(element)||element.contains(target);
  const scrollPaint=event=>{
   const target=event.target;
   for(const root of codeRoots)if(affectedBy(target,root))pendingCode.add(root);
   if(pendingCode.size&&!codeFrame)codeFrame=requestAnimationFrame(()=>{
    codeFrame=0;
    if(!frame)paintCode(measureCode(pendingCode));
    pendingCode.clear();
   });
  };
  const resize=new ResizeObserver(update);
  const layout=watchScrollLayout();
  const mutation=new MutationObserver(changes=>{
   layout.changed(changes);
   readingAnchor?.changed(changes);
   if(window.__cwbTranscriptPaint.codeEnabled&&changes.some(c=>[...c.addedNodes,...c.removedNodes].some(n=>n.nodeType===1&&
    (n.matches(structureSelector)||n.querySelector(structureSelector)))))queue();
  });
  mutation.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('scroll',scrollPaint,{capture:true,passive:true});window.addEventListener('resize',queue);
  window.__cwbTranscriptPaint={version:10,codeEnabled:sync.code,refresh(anchorSupported){
   if(anchorSupported)readingAnchor??=watchReadingAnchor();
   else{readingAnchor?.dispose();readingAnchor=null;}
   readingAnchor?.refresh();update();
  },dispose(){
   disposed=true;cancelAnimationFrame(frame);cancelAnimationFrame(codeFrame);resize.disconnect();mutation.disconnect();
   readingAnchor?.dispose();layout.dispose();
   document.removeEventListener('scroll',scrollPaint,true);window.removeEventListener('resize',queue);
   for(const e of codeMarked)cleanCode(e);delete window.__cwbTranscriptPaint;
  }};
 }
 window.__cwbTranscriptPaint.codeEnabled=sync.code;window.__cwbTranscriptPaint.refresh(testedBuild);
 window.__cwbApplyWidgets?.(config)?.catch(error=>{if(window.__cwbWidgets)window.__cwbWidgets.status={phase:'unsupported',reason:error.message}});
 window.__cwbDecorate?.(config);
 window.__cwbStartupAppearance?.dispose();
 return {painted:true,dark,sharedOverlay:overlay,composerOverlay:sync.composer ? controlOpacity : null,surfaces:sync};

 // Only structural changes can affect this guard. Keeping it out of the
 // stylesheet avoids rechecking the transcript subtree while the user types.
 function watchScrollLayout(){
  const port='[data-app-action-timeline-scroll]';
  const modes='[data-expanded-composer],[data-thread-focus-mode]';
  const landmarks=port+','+modes;
  let ports=new Set();
  const shallow=new MutationObserver(refresh);
  const attributes=new MutationObserver(refresh);
  attributes.observe(document.body,{subtree:true,attributeFilter:['data-app-action-timeline-scroll','data-expanded-composer','data-thread-focus-mode']});
  function refresh(){
   const next=new Set(document.querySelectorAll(port));
   for(const e of ports)if(!next.has(e))e.removeAttribute(layoutMark);
   ports=next;
   shallow.disconnect();
   for(const e of ports){
    // Only these two levels can supply the native spacer and footer.
    for(const wrapper of e.children){
     shallow.observe(wrapper,{attributeFilter:['class']});
     for(const child of wrapper.children)shallow.observe(child,{attributeFilter:['class','data-thread-scroll-footer']});
    }
    e.toggleAttribute(layoutMark,!!e.querySelector(':scope > div > '+spacer)&&
     !!e.querySelector(':scope '+footer)&&!e.querySelector(modes));
   }
  }
  refresh();
  return {
   changed(changes){
    if(changes.some(({target,addedNodes,removedNodes})=>{
     const shallowChange=ports.has(target)||ports.has(target.parentElement);
     return [...addedNodes,...removedNodes].some(n=>n.nodeType===1&&
      (shallowChange||n.matches(landmarks)||(n.childElementCount&&n.querySelector(landmarks))));
    }))refresh();
   },
   dispose(){
    attributes.disconnect();shallow.disconnect();
    for(const e of ports)e.removeAttribute(layoutMark);
   }
  };
 }

 function watchReadingAnchor(){
  const port='.scrollContainer-fG6qEo',content='.transcriptContent-l_FOQD';
  const gate='[data-thread-has-reading-passage]:not([data-native-end-snap-following])';
  const selector=prefix=>[port,prefix+' > :not(:first-child)',prefix+' > :first-child > :not('+content+')',prefix+' '+content+' > *'].join(', ');
  const native=selector(port+gate),stable=selector(port);
  const files=new Set(['59d93f9e7acb.css','8f26e793d206.css','ad03c4677215.css']);
  const isNativeSheet=href=>files.has(href?.split('/').at(-1));
  const patches=new Set();
  let layouts=[],containers=new Set(),seenSheets=new WeakSet();
  const attributes=new MutationObserver(refresh);
  const restore=()=>{
   for(const rule of patches)if(rule.selectorText===stable)rule.selectorText=native;
   patches.clear();
   seenSheets=new WeakSet();
  };
  const rulesIn=function*(rules){
   for(const rule of rules){
    if(rule.style?.cssText==='overflow-anchor: none;')yield rule;
    if(rule.cssRules?.length)yield* rulesIn(rule.cssRules);
   }
  };
  function refresh(){
   const next=[...document.querySelectorAll(port)].map(host=>{
    const [wrapper,footer]=host.children;
    const [transcript,padding]=wrapper?.children??[];
    return [host,wrapper,transcript,footer,padding,transcript?.firstElementChild];
   });
   if(next.length!==layouts.length||next.some((nodes,i)=>nodes.some((node,j)=>node!==layouts[i][j]))){
    attributes.disconnect();
    containers.clear();
    for(const nodes of next){
     for(const e of nodes.slice(0,3))if(e){containers.add(e);attributes.observe(e,{attributeFilter:['class']});}
     for(const e of nodes.slice(3))if(e)attributes.observe(e,{attributeFilter:['class','style']});
    }
    layouts=next;
   }
   // A direct nested scroller can pick its own anchor even when the outer
   // port has opted out. All mounted conversations share this stylesheet.
   if(!layouts.length||layouts.some(([host,wrapper,transcript,footer,padding,turns])=>
    !host.matches('[data-app-action-timeline-scroll]')||host.children.length!==2||
    !wrapper?.matches('div.overflow-clip')||wrapper.children.length!==2||
    !footer?.matches('div.footer-A8ZvKV.absolute')||
    !transcript?.matches('div'+content+'[data-thread-user-message-navigation-content]')||transcript.children.length!==1||
    !padding?.matches('div[aria-hidden=true].pointer-events-none'+spacer)||
    !turns?.matches('div[data-thread-find-target]')||
    [footer,padding,turns].some(e=>{
     const {overflowX,overflowY}=getComputedStyle(e);
     return !['visible','clip'].includes(overflowX)||!['visible','clip'].includes(overflowY);
    }))){
    restore();
    return;
   }
   try{
    for(const sheet of document.styleSheets){
     if(!isNativeSheet(sheet.href)||seenSheets.has(sheet))continue;
     for(const rule of rulesIn(sheet.cssRules)){
      if(rule.selectorText!==native)continue;
      rule.selectorText=stable;
      if(rule.selectorText!==stable)throw Error('Native reading anchor selector did not update');
      patches.add(rule);
     }
     seenSheets.add(sheet);
    }
   }catch{restore();}
  }
  const stylesheetLoaded=event=>{if(isNativeSheet(event.target?.href))refresh();};
  document.addEventListener('load',stylesheetLoaded,true);
  return {
   refresh,
   changed(changes){
    if(layouts.some(([host])=>!host.isConnected)||changes.some(({target,addedNodes})=>
     containers.has(target)||[...addedNodes].some(node=>
      node.nodeType===1&&(node.matches(port)||node.querySelector(port)))))refresh();
   },
   dispose(){document.removeEventListener('load',stylesheetLoaded,true);attributes.disconnect();restore();}
  };
 }
}

// Serialized cleanup shared by disabling wallpaper and stopping its host while
// the native client remains open. No bridge paint listeners survive teardown.
export function clearShell(){
 window.__cwbTranscriptPaint?.dispose();window.__cwbLayout?.dispose?.();delete window.__cwbLayout;
 window.__cwbDecorations?.dispose();window.__cwbWidgets?.dispose?.();delete window.__cwbWidgets;
 window.__cwbThemeGuard?.dispose();document.getElementById('codex-wallpaper-bridge-style')?.remove();
}
