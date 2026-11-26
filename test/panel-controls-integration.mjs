import {installRealtime} from '../src/realtime-player.mjs';
import {libraryGroups} from '../src/library-model.mjs';
import {installPanelWindow} from '../src/panel-window.mjs';
// Isolated headless DOM test: no input is sent to the user's desktop or Codex.
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {createServer} from 'node:net';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';import {installPanel} from '../src/wallpaper-panel.mjs';import {installFeaturePanel} from '../src/feature-panel.mjs';import {defaultSettings} from '../src/runtime-paths.mjs';
import {installFrameFreeze} from '../src/freeze-frame.mjs';import {decorateShell,upstreamRuntime} from '../src/upstream-adapters.mjs';import {paintShell} from '../src/wallpaper-style.mjs';
const temp=await mkdtemp(path.join(os.tmpdir(),'cwb-panel-controls-')),html=path.join(temp,'shell.html');await writeFile(html,'<!doctype html><header class="_ApplicationMenuTopBar_"><nav role="menubar">Fixture</nav></header>');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));const url=pathToFileURL(html).href;
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+path.join(temp,'profile'),url],{windowsHide:true,stdio:'ignore'}),sleep=ms=>new Promise(r=>setTimeout(r,ms));let c;const result={kind:'isolated-panel-control-wiring-not-native-rendering'};
try{
 for(let i=0;i<80;i++){try{const t=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url);if(t){c=await connectCdp(t.webSocketDebuggerUrl);break;}}catch{}await sleep(100);}
 assert(c,'Chromium did not open the panel fixture');
 // The debugging target can advertise the file URL before the page commits.
 let ready=false;
 for(let i=0;i<80&&!ready;i++){
  ready=await c.evaluate('location.href==='+JSON.stringify(url)+'&&document.readyState==="complete"&&!!document.querySelector("header [role=menubar]")');
  if(!ready)await sleep(50);
 }
 assert(ready,'Panel fixture document did not finish loading');
 const config=defaultSettings();config.library=[{id:'fixture',name:'Fixture',mode:'webwallgl',limits:{maxWidth:1280,fps:30}}];config.selectedId='fixture';config.systemMedia={enabled:false,audio:true,audioFps:30};config.palette={r:240,g:241,b:243,dark:false};
 await c.evaluate('window.__cwbLibraryGroups='+libraryGroups.toString()+';window.__cwbInstallPanelWindow='+installPanelWindow.toString()+';window.__cwbInstallFeatures='+installFeaturePanel.toString()+';window.__testConfig='+JSON.stringify(config)+';window.__requests=[];window.__codexWallpaperSend=raw=>{const q=JSON.parse(raw);window.__requests.push(q);if(q.action==="system-media-config")window.__testConfig.systemMedia={enabled:q.enabled,audio:q.audio,audioFps:q.audioFps};if(q.action==="display-tier")window.__testConfig.library[0].displayTier=q.tier;queueMicrotask(()=>window.__cwbReply(q.id,{ok:true,config:window.__testConfig,preview:null}));};('+installPanel.toString()+')(window.__testConfig,"test-token");true');
 const ui=s=>c.evaluate('(()=>{const s=document.getElementById("codex-wallpaper-controls").shadowRoot;'+s+'})()');
 const menuStyles=await ui('const style=e=>{const x=getComputedStyle(e);return [x.height,x.fontFamily,x.fontSize,x.fontWeight,x.lineHeight,x.padding,x.borderRadius,x.backgroundColor,x.color]};return [style(s.getElementById("toggle")),style(s.getElementById("cwb-quick-scan").shadowRoot.querySelector("button"))]');
 assert.deepEqual(menuStyles[0],menuStyles[1]);
 assert.equal(await ui('return s.getElementById("visual-fxEnabled").checked'),false);
 assert.equal(await ui('return s.getElementById("surface-options").classList.contains("cwb-feature")'),true,'Surface adaptation controls must use the same framed section as other settings');
 // The primary selector stays above optional settings at default and narrow sizes.
 for(const [width,height]of [[640,720],[360,500]]){
  await ui(`s.getElementById('toggle').click();document.getElementById('codex-wallpaper-controls').__cwbSetPanelSize(${width},${height});return true`);
  const primary=await ui('const b=s.querySelector(".cwb-window-body"),r=s.getElementById("library").getBoundingClientRect(),clip=b.getBoundingClientRect();return {first:b.firstElementChild.contains(s.getElementById("library")),visible:r.top>=clip.top&&r.bottom<=clip.bottom,focus:s.activeElement?.id,playback:s.getElementById("cwb-playback-options").open,repair:s.getElementById("surface-options").open,importButtons:s.getElementById("cwb-import-entry").contains(s.getElementById("import"))&&s.getElementById("cwb-import-entry").contains(s.getElementById("browse")),overflow:b.scrollWidth>b.clientWidth+1};');
  assert.deepEqual(primary,{first:true,visible:true,focus:'library',playback:false,repair:false,importButtons:true,overflow:false});
  assert.equal(await ui('const b=s.getElementById("cwb-repair"),r=b.getBoundingClientRect();return b.closest(".cwb-titlebar")!==null&&s.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===b'),true);
  await ui('s.querySelector(".cwb-window-body").scrollTop=10000;s.getElementById("close").click();s.getElementById("toggle").click();return true');
  assert.equal(await ui('return s.querySelector(".cwb-window-body").scrollTop'),0);
  if(process.env.CWB_PANEL_EVIDENCE_DIR){await mkdir(process.env.CWB_PANEL_EVIDENCE_DIR,{recursive:true});const png=await c.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(process.env.CWB_PANEL_EVIDENCE_DIR,'primary-panel-'+width+'.png'),Buffer.from(png.data,'base64'));}
  await ui('s.getElementById("close").click();return true');
 }
 result.primarySelectorFirstAndVisible=true;result.reopenReturnsToSelection=true;
 await ui('s.getElementById("toggle").click();window.__savedSend=window.__codexWallpaperSend;window.__codexWallpaperSend=raw=>{const q=JSON.parse(raw);if(q.action!=="wallpaper-repair")return window.__savedSend(raw);window.__repairRequest=q;window.__cwbReply(q.id,{accepted:true});};s.getElementById("cwb-repair").click();return true');
 assert.equal(await ui('return s.getElementById("cwb-repair").disabled'),true);
 assert.equal(await c.evaluate('window.__repairRequest.action'),'wallpaper-repair');
 await c.evaluate('window.__cwbReply(window.__repairRequest.id,{ok:true,message:"恢复完成"});window.__codexWallpaperSend=window.__savedSend;true');
 assert.equal(await ui('return s.getElementById("status").textContent'),'恢复完成');
 assert.equal(await ui('return s.getElementById("cwb-repair").disabled'),false);
 await ui('window.__codexWallpaperSend=undefined;s.getElementById("cwb-repair").click();return true');
 assert.match(await ui('return s.getElementById("error-message").textContent'),/Repair\.cmd/);
 await ui('s.getElementById("error-dismiss").click();window.__codexWallpaperSend=window.__savedSend;return true');
 await ui('s.getElementById("close").click();return true');result.manualRepairReportsCompletion=true;
 // Keyboard scan is independent of the blocked menu-row button. Keep the
 // native modal/focus/drafts intact and dispatch a real trusted CDP key event.
 await c.evaluate('(()=>{const d=document.createElement("dialog");d.id="native-modal";d.innerHTML="<button id=native-focus>Native dialog</button>";document.body.append(d);d.showModal();document.getElementById("native-focus").focus();window.__scanSaved=JSON.stringify(window.__testConfig);return true})()');
 const scansBefore=await c.evaluate('window.__requests.filter(q=>q.action==="surface-rescan").length');
 await c.call('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'W',windowsVirtualKeyCode:87,modifiers:11});await c.call('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'W',windowsVirtualKeyCode:87,modifiers:11});await sleep(80);
 const modalScan=await c.evaluate('({scans:window.__requests.filter(q=>q.action==="surface-rescan").length,modal:document.getElementById("native-modal").matches(":modal"),focus:document.activeElement.id,saved:window.__scanSaved===JSON.stringify(window.__testConfig),panelOpen:window.__cwbPanelHost.shadowRoot.querySelector("dialog").open})');
 assert.deepEqual(modalScan,{scans:scansBefore+1,modal:true,focus:'native-focus',saved:true,panelOpen:false});
 const quickScanCount=()=>c.evaluate('window.__requests.filter(q=>q.action==="surface-rescan").length');
 async function clickQuickScan(locate){
  const point=await c.evaluate(`(()=>{const entry=${locate};const button=entry?.shadowRoot.querySelector('button');if(!button)return null;const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return entry.shadowRoot.elementFromPoint(x,y)===button?{x,y}:null})()`);
  assert(point,'The quick scan must receive pointer input in the active layer');
  for(const type of ['mousePressed','mouseReleased'])await c.call('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});
 }
 await clickQuickScan('document.querySelector("#native-modal #cwb-quick-scan")');
 assert.equal(await quickScanCount(),scansBefore+2);
 await c.evaluate('document.getElementById("native-modal").close();document.getElementById("native-modal").remove();true');
 await sleep(60);
 await clickQuickScan('window.__cwbPanelHost.shadowRoot.getElementById("cwb-quick-scan")');
 assert.equal(await quickScanCount(),scansBefore+3);
 result.scanWorksInsideNativeModal=true;
 await c.evaluate(`(()=>{const d=document.createElement('div');d.className='settings-dialog';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.dataset.state='open';d.style.cssText='position:fixed;inset:50px;z-index:30;pointer-events:auto';document.body.style.pointerEvents='none';document.body.append(d);return true})()`);
 await sleep(60);
 assert.equal(await c.evaluate('getComputedStyle(document.querySelector(".settings-dialog #cwb-quick-scan").shadowRoot.querySelector("button")).backgroundColor'),'rgba(0, 0, 0, 0)');
 await c.evaluate(`window.__savedSend=window.__codexWallpaperSend;window.__codexWallpaperSend=raw=>{const q=JSON.parse(raw);if(q.action!=='surface-rescan')return window.__savedSend(raw);window.__requests.push(q);window.__cwbReply(q.id,{ok:false,error:'Fixture failure'});};true`);
 await clickQuickScan('document.querySelector(".settings-dialog > #cwb-quick-scan")');
 assert.equal(await quickScanCount(),scansBefore+4);
 assert.equal(await c.evaluate('document.querySelector(".settings-dialog #cwb-quick-scan").shadowRoot.querySelector("output:popover-open").textContent'),'扫描适配失败：Fixture failure');
 assert.equal(await ui('return !!s.querySelector("dialog[open]")'),false);
 await c.evaluate(`document.querySelector('.settings-dialog').dataset.state='closed';window.__codexWallpaperSend=window.__savedSend;const m=document.createElement('div');m.setAttribute('role','menu');m.dataset.state='open';m.style.cssText='position:fixed;top:32px;left:4px;width:120px;height:48px;pointer-events:auto';document.body.append(m);true`);
 await sleep(60);
 await clickQuickScan('document.querySelector("[role=menu] > #cwb-quick-scan")');
 assert.equal(await quickScanCount(),scansBefore+5);
 assert.equal(await c.evaluate('document.querySelector("[role=menu]").dataset.state'),'open');
 await c.evaluate('document.querySelector(".settings-dialog").remove();document.querySelector("[role=menu]").remove();document.body.style.pointerEvents="";true');
 result.scanWorksWithSettingsAndMenuOpen=true;
 // Sidebar previews and native hints share the same wrapper layout, even
 // when the wrapper has no ID or uses a different popover mode.
 const readPreview=()=>c.evaluate(`(()=>{
  const host=document.querySelector('#anchor-fixture [popover]'),card=host.firstElementChild,anchor=host.previousElementSibling;
  const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
  return {card:rect(card),anchor:rect(anchor),hostBlur:getComputedStyle(host).backdropFilter,
   cardBlur:getComputedStyle(card).backdropFilter,cardBackground:getComputedStyle(card).backgroundColor,
   scanInMenu:window.__cwbPanelHost.shadowRoot.getElementById('cwb-quick-scan')?.dataset.placement==='menu'};
 })()`);
 const fixtureCases=[
  ['chat preview','role="dialog" popover="hint" id="fixture-hover-card"',true],
  ['project preview','role="dialog" popover="manual"',true],
  ['tooltip','role="tooltip" popover="hint"',true],
  ['manual tooltip','popover="manual"',false],
 ];
 await c.evaluate('window.__codexWallpaperBridge={ready:true};('+paintShell.toString()+')(window.__testConfig);true');
 for(const [name,attrs,glass]of fixtureCases){
  await c.evaluate(`(()=>{
   const fixture=document.createElement('section');
   fixture.id='anchor-fixture';
   fixture.innerHTML='<button style="position:fixed;left:60px;top:180px;width:120px;anchor-name:--anchor-fixture">Row</button><div ${attrs} style="position:fixed;inset:0 auto auto 0;margin:0;padding:0;border:0;width:0;height:0;overflow:visible"><div data-anchor-positioning style="position:fixed;position-anchor:--anchor-fixture;position-area:span-end end;width:180px;height:40px">Preview</div></div>';
   document.head.querySelector('#codex-wallpaper-bridge-style').sheet.disabled=true;
   document.body.append(fixture);
   fixture.querySelector('[popover]').showPopover();
  })()`);
  const nativePreview=await readPreview();
  assert(nativePreview.card[0]>=nativePreview.anchor[0]+nativePreview.anchor[2]&&nativePreview.card[1]>100,name);
  await c.evaluate('document.head.querySelector("#codex-wallpaper-bridge-style").sheet.disabled=false');
  await sleep(60);
  assert.deepEqual(await readPreview(),{...nativePreview,hostBlur:'none',cardBlur:glass?'blur(12px)':'none',cardBackground:glass?'rgba(240, 241, 243, 0.72)':nativePreview.cardBackground,scanInMenu:true},name);
  await c.evaluate('document.getElementById("anchor-fixture").remove();true');
 }
 result.anchoredPreviewsAndTooltipsKeepNativePositionAndMenuScan=true;
 assert.equal(await ui('return s.getElementById("cwb-media-audio-fps").value'),'30');
 assert.deepEqual(await ui('return [...s.getElementById("cwb-media-audio-fps").options].map(e=>Number(e.value))'),[10,20,30,60,90,120]);
 await ui('s.getElementById("cwb-media-audio-fps").value="120";s.getElementById("cwb-media-save").onclick();return true');await sleep(150);
 assert.equal(await c.evaluate('window.__requests.findLast(q=>q.action==="system-media-config").audioFps'),120);
 assert.equal(await ui('return s.getElementById("cwb-media-audio-fps").value'),'120');result.rateSavedAndReadBack=true;
 assert.deepEqual(await ui('return [...s.getElementById("cwb-display-tier").options].map(o=>o.value)'),['static','economy','balanced','smooth','qhd','full','custom']);result.allTiersVisible=true;
 for(const [width,height]of [[1000,900],[700,720],[360,640]]){await c.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await ui('const d=s.querySelector("dialog");if(!d.open)d.showModal();s.getElementById("cwb-playback-options").open=true;return true');await sleep(100);const layout=await ui('const r=e=>{const x=e.getBoundingClientRect();return {top:x.top,bottom:x.bottom,left:x.left,right:x.right}};return {select:r(s.getElementById("cwb-display-tier")),apply:r(s.getElementById("cwb-display-apply")),dialog:r(s.querySelector("dialog")),viewport:innerWidth}');assert(layout.apply.top>=layout.select.bottom+6);assert(layout.dialog.left>=0&&layout.dialog.right<=layout.viewport,JSON.stringify(layout));await ui('s.querySelector("dialog").close();return true');}result.narrowPanelSpacing=true;
 await c.call('Emulation.setDeviceMetricsOverride',{width:1000,height:900,deviceScaleFactor:1,mobile:false});await ui('s.getElementById("toggle").click();return true');const originalBounds=await ui('return JSON.parse(JSON.stringify(s.querySelector("dialog").getBoundingClientRect()))');assert.equal(await ui('return s.querySelectorAll("[data-resize-edge]").length'),8);await ui('s.getElementById("panel-maximize").click();return true');const maximized=await ui('return JSON.parse(JSON.stringify(s.querySelector("dialog").getBoundingClientRect()))');assert(maximized.width>originalBounds.width);assert(maximized.height>originalBounds.height);await ui('s.getElementById("panel-maximize").click();return true');const restored=await ui('return JSON.parse(JSON.stringify(s.querySelector("dialog").getBoundingClientRect()))');assert(Math.abs(restored.width-originalBounds.width)<2);assert(Math.abs(restored.height-originalBounds.height)<2);await ui('s.querySelector("dialog").close();return true');result.windowMaximizeRestoreAndEightEdges=true;
 // Exercise real pointer capture on the isolated panel, without touching Codex.
 await ui('s.getElementById("toggle").click();s.getElementById("panel-reset-size").click();return true');
 const dragStart=await ui('const r=s.querySelector(".cwb-titlebar").getBoundingClientRect();return {x:r.left+60,y:r.top+20,left:s.querySelector("dialog").getBoundingClientRect().left}');
 for(const [type,x,y,button,buttons]of [['mouseMoved',dragStart.x,dragStart.y,'none',0],['mousePressed',dragStart.x,dragStart.y,'left',1],['mouseMoved',dragStart.x+35,dragStart.y+25,'left',1],['mouseReleased',dragStart.x+35,dragStart.y+25,'left',0]])await c.call('Input.dispatchMouseEvent',{type,x,y,button,buttons,clickCount:1});
 assert(Math.abs((await ui('return s.querySelector("dialog").getBoundingClientRect().left'))-dragStart.left-35)<2);result.titlebarPointerDrag=true;
 const edgeStart=await ui('const r=s.querySelector("[data-resize-edge=e]").getBoundingClientRect();return {x:r.left+2,y:r.top+30,width:s.querySelector("dialog").getBoundingClientRect().width}');
 for(const [type,x,y,button,buttons]of [['mousePressed',edgeStart.x,edgeStart.y,'left',1],['mouseMoved',edgeStart.x+45,edgeStart.y,'left',1],['mouseReleased',edgeStart.x+45,edgeStart.y,'left',0]])await c.call('Input.dispatchMouseEvent',{type,x,y,button,buttons,clickCount:1});
 assert(Math.abs((await ui('return s.querySelector("dialog").getBoundingClientRect().width'))-edgeStart.width-45)<2);result.edgePointerResize=true;await ui('s.querySelector("dialog").close();return true');
 const cancelledNative=await c.call('Runtime.evaluate',{expression:'(async()=>{const canvas=document.createElement("canvas");canvas.width=canvas.height=4;const encoded=canvas.toDataURL("image/jpeg").split(",")[1],original=Image.prototype.decode;window.__codexWallpaperBridge={marker:"retained",dispose(){window.__nativeDisposed=true}};window.__cwbSelectionStamp="old";window.__cwbDesiredWallpaperId="native";try{Image.prototype.decode=async function(){await new Promise(r=>setTimeout(r,60));return original.call(this)};const pending=('+installRealtime.toString()+')({pauseOnBlur:false},encoded,{selectionStamp:"old",entryId:"native"});window.__cwbSelectionStamp="new";const result=await pending;return {cancelled:result.superseded,retained:window.__codexWallpaperBridge.marker==="retained"&&!window.__nativeDisposed}}finally{Image.prototype.decode=original;delete window.__codexWallpaperBridge;delete window.__cwbSelectionStamp;delete window.__cwbDesiredWallpaperId;}})()',awaitPromise:true,returnByValue:true});assert.deepEqual(cancelledNative.result.value,{cancelled:true,retained:true});result.nativeDecodeCancellationRetainsOldFrame=true;
 const frozen=await c.evaluate('(()=>{const parent=document.createElement("div"),source=document.createElement("canvas");source.width=source.height=12;const shadow=parent.attachShadow({mode:"open"}),style=document.createElement("style");style.textContent="canvas{display:block}";const shade=document.createElement("div");shade.dataset.cwbShade="";shadow.append(style,source,shade);source.style.filter="brightness(0.7)";source.style.scale="-1 1";document.body.append(parent);source.getContext("2d").fillStyle="red";source.getContext("2d").fillRect(0,0,12,12);const guard=('+installFrameFreeze.toString()+')(source,source.parentNode);guard.hold();source.width=24;const copy=shadow.querySelector("[data-cwb-frozen]"),pixel=[...copy.getContext("2d").getImageData(4,4,1,1).data];window.__freezeTest={guard,parent,copy};return {pixel,held:guard.held,hidden:copy.hidden,beforeShade:source.nextSibling===copy&&copy.nextSibling===shade,filter:copy.style.filter,scale:copy.style.scale}})()');assert.deepEqual(frozen.pixel,[255,0,0,255]);assert(frozen.held&&!frozen.hidden);assert(frozen.beforeShade);assert.equal(frozen.filter,"brightness(0.7)");assert.equal(frozen.scale,"-1 1");assert(await c.evaluate('(()=>{const t=window.__freezeTest;t.guard.release(done=>{t.stale=done;return ()=>{};});t.guard.hold();t.stale();if(t.copy.hidden)return false;t.guard.release(done=>{t.next=done;return ()=>{};});if(t.copy.hidden)return false;t.next();return t.copy.hidden})()'));assert.equal(await c.evaluate('getComputedStyle(window.__freezeTest.copy).display'),'none');await c.evaluate('window.__freezeTest.guard.dispose();window.__freezeTest.parent.remove();true');result.pausedFrameSurvivesBackingStoreReset=true;
 const glass=await c.evaluate('(()=>{const main=document.createElement("div");main.setAttribute("data-cwb-native-surface","");document.body.append(main);window.__codexWallpaperBridge={ready:true};window.__cwbDecorate='+decorateShell.toString()+';('+paintShell.toString()+')({visual:{glassBlur:0,glassOpacity:.8},palette:{r:20,g:22,b:28,dark:true}});const style=getComputedStyle(main),result={background:style.backgroundColor,blur:style.backdropFilter};window.__cwbDecorations.dispose();main.remove();return result})()');assert.equal(glass.background,'rgba(20, 22, 28, 0.8)');assert.equal(glass.blur,'none');result.opacityIndependentOfBlur=true;
 const shell=await c.evaluate('(()=>{const root=document.createElement("div");root.setAttribute("data-app-shell-page-surface","");root.innerHTML=\'<aside class="app-shell-left-panel"><div data-sidebar-navigation-root><div data-sidebar-container></div></div></aside><header data-app-shell-header-edge-scroll="false"></header><main data-app-shell-main-surface></main>\';document.body.append(root);window.__cwbDecorate='+decorateShell.toString()+';('+paintShell.toString()+')({visual:{glassBlur:0,glassOpacity:.5},palette:{r:20,g:22,b:28,dark:true},darkOverlay:.4});const legacy=document.createElement("style");legacy.textContent="aside.app-shell-left-panel,header[data-app-shell-header-edge-scroll]{background-color:rgba(20,22,28,.5)!important}";document.head.append(legacy);const backgrounds=[...root.querySelectorAll("aside,[data-sidebar-navigation-root],[data-sidebar-container],header,main")].map(e=>getComputedStyle(e).backgroundColor);window.__cwbDecorations.dispose();legacy.remove();root.remove();return backgrounds})()');assert(shell.every(color=>color==='rgba(0, 0, 0, 0)'));result.shellDoesNotStackTint=true;
 const themes=[];for(const dark of [false,true]){await c.evaluate('window.__testConfig.palette='+(dark?' {r:20,g:22,b:28,dark:true}':'{r:240,g:241,b:243,dark:false}')+';document.getElementById("codex-wallpaper-controls").__cwbRenderConfig(window.__testConfig);true');const colors=await ui('const e=s.getElementById("error-dialog"),p=s.getElementById("error-message"),o=s.getElementById("resolution").options[0],style=getComputedStyle(o);return {ink:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor,text:getComputedStyle(p).color,optionInk:style.color,optionBackground:style.backgroundColor}');themes.push(colors);assert.equal(colors.ink,colors.text);assert.equal(colors.ink,colors.optionInk);assert(!colors.optionBackground.startsWith('rgba'));const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);const lum=s=>rgb(s).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);const a=lum(colors.ink),b=lum(colors.background);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);}result.dialogThemes=themes;
 await c.evaluate('window.__testConfig.visual.theme="light";document.getElementById("codex-wallpaper-controls").__cwbRenderConfig(window.__testConfig);true');assert.equal(await ui('return getComputedStyle(s.getElementById("resolution").options[0]).color'),'rgb(32, 38, 49)');assert.equal(await ui('return s.getElementById("visual-theme").value'),'light');result.manualThemeOverridesSampling=true;
 const design=await ui('return {theme:document.getElementById("codex-wallpaper-controls").dataset.cwbTheme,fieldHeight:parseFloat(getComputedStyle(s.getElementById("resolution")).minHeight),primary:s.getElementById("engine-import").dataset.cwbVariant,batch:s.getElementById("cwb-batch-import").dataset.cwbVariant||"secondary",done:s.getElementById("done").dataset.cwbVariant||"secondary",backdrop:getComputedStyle(s.querySelector("dialog")).backdropFilter,fonts:[...s.querySelectorAll("style")].some(e=>/@import|@font-face/.test(e.textContent))}');assert.equal(design.theme,'light');assert.equal(design.fieldHeight,36);assert.equal(design.primary,'primary');assert.equal(design.batch,'secondary');assert.equal(design.done,'secondary');assert.equal(design.backdrop,'none');assert.equal(design.fonts,false);result.compactDesignHierarchyAndNoExternalFonts=design;
 // Package A: fixed large viewport, panel-local reflow and real control handlers.
 const adapters=await upstreamRuntime();await c.evaluate('window.__cwbPickerModel='+adapters.picker+';window.__fixtureItems='+JSON.stringify(Array.from({length:54},(_,i)=>({id:String(i),token:'item-'+i,type:'image',title:i?'Fixture '+i:'很长的壁纸项目名称 / '+('长标题'.repeat(22))})))+';window.__requests=[];window.__codexWallpaperSend=raw=>{const q=JSON.parse(raw);window.__requests.push(q);if(window.__hold&&q.action==="display-tier"){window.__held=q;return;}if(q.action==="select")window.__testConfig.selectedId=q.selectedId;const reply={ok:true,config:window.__testConfig,preview:null,...(q.action==="engine-list"?{wallpapers:window.__fixtureItems,roots:[],warnings:[]}:{}),...(q.action==="engine-inspect"?{inspection:{supported:true,label:"可以直接导入"}}:{})};queueMicrotask(()=>window.__cwbReply(q.id,reply));};window.__testConfig.library.push({id:"second",name:"Second preview",mode:"webwallgl"});document.getElementById("codex-wallpaper-controls").__cwbRenderConfig(window.__testConfig);true');
 const waitFor=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await sleep(30);}throw Error('Package A condition timed out');};
 await c.call('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});await ui('s.getElementById("toggle").click();s.getElementById("browse").click();return true');await waitFor(()=>ui('return s.querySelectorAll(".cwb-card").length===24&&!s.getElementById("engine-import").disabled'));
 const layouts=[];
 for(const [width,height,columns]of [[360,280,2],[640,720,3],[1384,984,3]]){
  await ui(`document.getElementById('codex-wallpaper-controls').__cwbSetPanelSize(${width},${height});s.getElementById('cwb-visual-options').open=true;return true`);await sleep(40);
  const layout=await ui('const b=s.querySelector(".cwb-window-body"),g=s.querySelector(".cwb-library-grid"),check=g.querySelector("input"),r=s.querySelector("dialog").getBoundingClientRect();return {width:r.width,height:r.height,body:b.clientWidth,scroll:b.scrollWidth,columns:getComputedStyle(g).gridTemplateColumns.split(" ").length,visualColumns:getComputedStyle(s.getElementById("cwb-visual")).gridTemplateColumns.split(" ").length,checkbox:check.getBoundingClientRect().width,sticky:getComputedStyle(s.getElementById("cwb-import-preview")).position}');layouts.push(layout);assert.equal(layout.columns,columns,JSON.stringify(layout));assert(layout.scroll<=layout.body+1,JSON.stringify(layout));assert.equal(layout.checkbox,16);assert.equal(layout.sticky,'static');if(width===360)assert.equal(layout.visualColumns,1);
  for(const fraction of [0,.5,1]){await ui('const b=s.querySelector(".cwb-window-body");b.scrollTop=b.scrollHeight*'+fraction+';return true');const overlap=await ui('const body=s.querySelector(".cwb-window-body"),clip=body.getBoundingClientRect(),controls=[...body.querySelectorAll("button,select")].filter(e=>!e.closest("details:not([open])")&&e.checkVisibility({visibilityProperty:true,contentVisibilityAuto:true})).map(e=>({id:e.id,r:e.getBoundingClientRect()})).filter(e=>e.r.width>1&&e.r.height>1&&e.r.bottom>clip.top+2&&e.r.top<clip.bottom-2);const bad=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j];if(Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>1)bad.push([a.id,b.id]);}return bad');assert.deepEqual(overlap,[],JSON.stringify({width,fraction,overlap}));}
  await ui('s.querySelector(".cwb-library-grid").scrollIntoView();return true');
  if(process.env.CWB_PANEL_EVIDENCE_DIR){await mkdir(process.env.CWB_PANEL_EVIDENCE_DIR,{recursive:true});const png=await c.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(process.env.CWB_PANEL_EVIDENCE_DIR,'panel-'+width+'.png'),Buffer.from(png.data,'base64'));}
 }
 result.containerLayouts=layouts;
 // Browser zoom reduces the available CSS viewport; device scale also exercises HiDPI.
 await c.call('Emulation.setDeviceMetricsOverride',{width:934,height:667,deviceScaleFactor:1.5,mobile:false});await ui('document.getElementById("codex-wallpaper-controls").__cwbSetPanelSize(360,500);return true');await sleep(30);assert(await ui('const b=s.querySelector(".cwb-window-body");return b.scrollWidth<=b.clientWidth+1'));result.representative150PercentScale=true;
 await ui('s.getElementById("cwb-card-item-1").focus();s.getElementById("cwb-type").dispatchEvent(new Event("change"));return true');assert.equal(await ui('return s.activeElement?.id'),'cwb-card-item-1');result.gridFocusRetained=true;
 await ui('for(const e of [...s.querySelectorAll(".cwb-card input")].slice(0,2)){e.checked=true;e.dispatchEvent(new Event("change"));}return true');
 assert.equal(await ui('return s.getElementById("engine-import").textContent'),'导入当前项并应用');assert.equal(await ui('return s.getElementById("engine-save").textContent'),'仅保存当前项');assert.equal(await ui('return s.getElementById("cwb-batch-import").textContent'),'批量保存 2 项');
 await ui('s.getElementById("engine-save").click();return true');await waitFor(()=>ui('return !s.getElementById("import").disabled'));let requests=await c.evaluate('window.__requests.filter(q=>q.action==="wallpaper-engine")');assert.equal(requests.length,1);assert.equal(requests[0].apply,false);assert.equal(requests[0].projectToken,'item-0');
 await ui('s.getElementById("engine-import").click();return true');await waitFor(()=>ui('return !s.getElementById("import").disabled'));requests=await c.evaluate('window.__requests.filter(q=>q.action==="wallpaper-engine")');assert.equal(requests.length,2);assert.equal(requests[1].apply,true);result.singleItemIgnoresBatchChecks=true;
 await ui('s.getElementById("cwb-batch-import").click();return true');assert(await ui('return s.getElementById("cwb-choice-dialog").open'));await ui('s.getElementById("cwb-choice-confirm").click();return true');await waitFor(()=>ui('return s.getElementById("cwb-choice-title").textContent==="批量导入结果"'));await ui('s.getElementById("cwb-choice-confirm").click();return true');await waitFor(()=>ui('return !s.getElementById("import").disabled'));requests=await c.evaluate('window.__requests.filter(q=>q.action==="wallpaper-engine")');assert.equal(requests.length,4);assert(requests.slice(-2).every(q=>q.apply===false));result.onlyBatchEntrySavesCheckedItems=true;
 await ui('s.getElementById("library").value="second";s.getElementById("library").dispatchEvent(new Event("change"));return true');assert.equal(await c.evaluate('window.__testConfig.selectedId'),'fixture');assert.equal(await c.evaluate('window.__requests.filter(q=>q.action==="select").length'),0);await ui('s.getElementById("library-apply").click();return true');await waitFor(()=>ui('return !s.getElementById("import").disabled'));assert.equal(await c.evaluate('window.__testConfig.selectedId'),'second');result.browseThenConfirmPreserved=true;
 await c.evaluate('window.__hold=true;true');await ui('s.getElementById("cwb-display-apply").click();document.getElementById("codex-wallpaper-controls").__cwbRenderConfig(window.__testConfig);document.getElementById("codex-wallpaper-controls").__cwbSystemMedia({state:1,capabilities:{pause:true,next:true,previous:true}});return true');assert(await ui('return s.querySelector("dialog").getAttribute("aria-busy")==="true"&&[...s.querySelectorAll("[data-cwb-control],#delete,#engine-import,#engine-save")].every(e=>e.disabled)'));await ui('const e=s.querySelector(".cwb-card input");e.checked=true;e.dispatchEvent(new Event("change"));return true');assert.equal(await ui('return s.getElementById("cwb-batch-status").textContent'),'已勾选 0 项');await c.evaluate('window.__hold=false;window.__cwbReply(window.__held.id,{ok:true,config:window.__testConfig});true');await waitFor(()=>ui('return s.querySelector("dialog").getAttribute("aria-busy")==="false"'));result.busyRenderAndMediaCannotUnlockControls=true;
 // Actual observed rail and portal roles; no hand-added CWB surface marker.
 const surfaces=[];for(const dark of [false,true])surfaces.push(await c.evaluate(`(()=>{const root=document.createElement('div');root.innerHTML='<div data-composer-utility-rail>Reference bar</div><div role="tooltip">Reference tooltip</div><div role="dialog"><div class="_Renderer_fixture"><div class="quota-card">Quota</div></div></div><div data-slot="popover-content">Popover</div>';document.body.append(root);window.__codexWallpaperBridge={ready:true};window.__cwbDecorate=${decorateShell.toString()};(${paintShell.toString()})({palette:${dark?'{r:20,g:22,b:28,dark:true}':'{r:240,g:241,b:243,dark:false}'},visual:{glassBlur:6,glassOpacity:.6},darkOverlay:.4,lightOverlay:.4,surfaceSync:{code:false,embedded:false}});const styles=[...root.children].map(e=>({bg:getComputedStyle(e).backgroundColor,ink:getComputedStyle(e).color,blur:getComputedStyle(e).backdropFilter}));window.__cwbDecorations.dispose();root.remove();return styles})()`));assert(surfaces.every(rows=>rows[0].bg.endsWith('0.6)')&&rows[0].blur==='blur(6px)'&&rows.slice(1).every(s=>s.bg.endsWith('0.72)')&&s.blur==='blur(12px)')));result.observedRailAndPortalMaterials=surfaces;
 // Author UI: typed combo, conditional controls and stale-selection protection.
 await c.evaluate(`window.__testConfig.library=[{id:'author-a',name:'Author A',mode:'webwallgl',projectRoot:'fixture-a'},{id:'author-b',name:'Author B',mode:'webwallgl',projectRoot:'fixture-b'}];window.__testConfig.selectedId='author-a';window.__authorModel=id=>{const entry=window.__testConfig.library.find(e=>e.id===id),values=entry.userProperties||{};return {mode:'webwallgl',total:3,definitions:[{name:'enabled',text:'Enabled',ptype:'bool',editable:true,visible:true,value:values.enabled||false,overridden:'enabled'in values},{name:'gain',text:'Gain',ptype:'slider',editable:true,visible:!!values.enabled,value:.5,min:0,max:1,overridden:false},{name:'choice',text:'Choice',ptype:'combo',editable:true,visible:true,value:values.choice??2,options:[{label:'Number',value:2},{label:'String',value:'2'}],overridden:'choice'in values}]};};window.__priorSend=window.__codexWallpaperSend;window.__codexWallpaperSend=raw=>{const q=JSON.parse(raw);if(!q.action.startsWith('wallpaper-properties-'))return window.__priorSend(raw);window.__requests.push(q);if(window.__holdAuthor&&q.action==='wallpaper-properties-read'&&q.selectedId==='author-b'){window.__heldAuthor=q;return;}if(q.action==='wallpaper-properties-save')Object.assign(window.__testConfig.library.find(e=>e.id===q.selectedId).userProperties??={},q.values);queueMicrotask(()=>window.__cwbReply(q.id,{ok:true,config:window.__testConfig,properties:window.__authorModel(q.selectedId)}));};document.getElementById('codex-wallpaper-controls').__cwbRenderConfig(window.__testConfig);true`);
 await ui('s.getElementById("cwb-author-properties").open=true;return true');await waitFor(()=>ui('return !!s.getElementById("cwb-author-enabled")'));
 await ui('const e=s.getElementById("cwb-author-enabled");e.checked=true;e.dispatchEvent(new Event("change"));return true');await waitFor(()=>ui('return !!s.getElementById("cwb-author-gain")&&!s.getElementById("cwb-author-gain").disabled'));
 await ui('const e=s.getElementById("cwb-author-choice");e.value="1";e.dispatchEvent(new Event("change"));return true');await waitFor(()=>ui('return !s.getElementById("import").disabled'));assert.equal(await c.evaluate('window.__requests.findLast(q=>q.action==="wallpaper-properties-save").values.choice'),'2');result.authorConditionalControlsAndTypedCombo=true;
 await ui('window.__staleAuthorInput=s.getElementById("cwb-author-enabled");window.__holdAuthor=true;window.__testConfig.selectedId="author-b";document.getElementById("codex-wallpaper-controls").__cwbRenderConfig(window.__testConfig);return true');assert.equal(await ui('return s.getElementById("cwb-author-fields").children.length'),0);const priorWrites=await c.evaluate('window.__requests.filter(q=>q.action==="wallpaper-properties-save").length');await c.evaluate('window.__staleAuthorInput.onchange();true');assert.equal(await c.evaluate('window.__requests.filter(q=>q.action==="wallpaper-properties-save").length'),priorWrites);await c.evaluate('window.__holdAuthor=false;window.__cwbReply(window.__heldAuthor.id,{ok:true,properties:window.__authorModel("author-b")});true');await waitFor(()=>ui('return !!s.getElementById("cwb-author-enabled")'));result.authorStaleSelectionCannotWrite=true;
 assert(await ui('return ["fxEnabled","fxClick","fxTrail","volume"].every(key=>{const input=s.getElementById("visual-"+key);return s.getElementById(input.getAttribute("aria-describedby"))?.textContent.length>0})'));
 await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 const paintFx=config=>c.evaluate('window.__cwbInstallFx='+adapters.fx+';('+decorateShell.toString()+')('+JSON.stringify(config)+');true');
 const fxBase={pauseOnBlur:false,visual:{fxEnabled:true,fxClick:true,fxTrail:true,fxBlend:'auto'}};
 const paintLight={...fxBase,selectedId:'fixture',library:[{id:'fixture',palette:{r:223,g:235,b:245,dark:false}}],palette:{r:20,g:22,b:28,dark:true}};
 await paintFx(paintLight);
 await sleep(75);
 assert.equal(await c.evaluate('!!document.getElementById("we-fx-layer")'),false,'Enabling idle pointer effects allocated a canvas before input');
 const effects=await c.call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const move=(type,x,y,target=document.body)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'mouse',clientX:x,clientY:y}));
  const painted=async()=>{
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const canvas=document.querySelector('#we-fx-layer canvas');
   const rgba=canvas.getContext('2d').getImageData(0,0,Math.min(300,canvas.width),Math.min(240,canvas.height)).data;
   for(let i=3;i<rgba.length;i+=4)if(rgba[i])return true;
   return false;
  };
  const start=performance.now();move('pointerdown',120,100);const click=await painted(),firstPointerMs=performance.now()-start;
  const original=document.getElementById('we-fx-layer'),hasFocus=document.hasFocus;
  document.hasFocus=()=>false;
  const config={...${JSON.stringify(paintLight)},pauseOnBlur:true};
  window.__cwbDecorations.update(config);
  if(!original.hidden)throw Error('Pointer canvas did not pause on blur');
  document.hasFocus=()=>true;
  window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const idle=original.hidden&&original===document.getElementById('we-fx-layer');
  const transcript=document.createElement('div');transcript.setAttribute('data-app-action-timeline-scroll','');document.body.append(transcript);
  const editor=document.createElement('div');editor.contentEditable='true';transcript.append(editor);
  const context=original.firstElementChild.getContext('2d'),clear=context.clearRect;
  let draws=0;context.clearRect=function(...args){draws++;return clear.apply(this,args);};
  const budgetStart=performance.now();
  move('pointermove',60,70,transcript);move('pointermove',140,70,editor);move('pointermove',225,100,editor);
  const trail=await painted(),reused=original===document.getElementById('we-fx-layer')&&!original.hidden;
  await new Promise(resolve=>setTimeout(resolve,220));
  const drawBudget=draws>=2&&draws<=Math.ceil((performance.now()-budgetStart)*30/1000)+1;
  context.clearRect=clear;
  transcript.remove();
  document.hasFocus=hasFocus;
  return {click,trail,idle,reused,drawBudget,firstPointerMs,blend:original.style.mixBlendMode};
 })()`});
 if(effects.exceptionDetails)throw Error(effects.exceptionDetails.exception?.description||effects.exceptionDetails.text);
 const {firstPointerMs,...pointerEffects}=effects.result.value;
 assert.deepEqual(pointerEffects,{click:true,trail:true,idle:true,reused:true,drawBudget:true,blend:'normal'});
 result.clickAndTrailPainted=true;result.firstPointerMs=firstPointerMs;
 assert.equal(await c.evaluate('document.body.style.getPropertyValue("--we-accent")'),'rgb(76,80,83)');
 await paintFx({...fxBase,palette:{r:18,g:42,b:89,dark:true}});
 const blendAfter=async()=>{
  const outcome=await c.call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`new Promise(resolve=>{
   document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:120,clientY:100}));
   requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(document.getElementById('we-fx-layer').style.mixBlendMode)));
  })`});
  return outcome.result.value;
 };
 assert.equal(await blendAfter(),'screen');
 assert.equal(await c.evaluate('document.body.style.getPropertyValue("--we-accent")'),'rgb(168,177,193)');
 await paintFx({...paintLight,visual:{...fxBase.visual,fxBlend:'lighten'}});
 assert.equal(await blendAfter(),'lighten');
 result.wallpaperAccentAndManualBlend=true;
 const filters=await c.evaluate(`(()=>{
  const layer=document.createElement('div');
  layer.id='codex-wallpaper-bridge-layer';
  const shadow=layer.attachShadow({mode:'open'}),media=document.createElement('div'),frozen=document.createElement('div');
  frozen.setAttribute('data-cwb-frozen','');shadow.append(media,frozen);document.body.append(layer);
  const effects=[{},{wallpaperBlur:4},{brightness:.75},{wallpaperBlur:4,brightness:.75},{}].map(visual=>{
   window.__cwbDecorations.update({visual});
   return [getComputedStyle(media).filter,getComputedStyle(frozen).filter];
  });
  layer.remove();return effects;
 })()`);
 assert.deepEqual(filters,['none','blur(4px)','brightness(0.75)','blur(4px) brightness(0.75)','none'].map(filter=>[filter,filter]));result.identityFilterBypassed=true;
 await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await ui('return getComputedStyle(s.getElementById("engine-import")).transitionDuration'),'0s');
 await c.call('Runtime.evaluate',{awaitPromise:true,expression:'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'});
 assert.equal(await c.evaluate('!!document.getElementById("we-fx-layer")'),false);result.reducedMotion=true;result.passed=true;
 result.passed=false;
 await c.evaluate('window.__fixtureItems[2].location="E:/Projects/Example/";window.__testConfig.library.push({id:"imported-0-video",workshopId:"0",name:"Saved video"},{id:"imported-0-gpu",workshopId:"0",mode:"webwallgl",name:"Saved GPU"},{id:"imported-1",sourceKey:"1",name:"Saved source"},{id:"imported-2",projectRoot:"e:\\\\projects\\\\example",name:"Saved project"});document.getElementById("codex-wallpaper-controls").__cwbRenderConfig(window.__testConfig);true');
 await ui('s.getElementById("cwb-type").value="all";s.getElementById("cwb-rating").value="all";s.getElementById("cwb-hidden").value="visible";s.getElementById("engine-search").value="";s.getElementById("cwb-imported").value="imported";s.getElementById("cwb-imported").dispatchEvent(new Event("change"));return true');
 assert.equal(await ui('return s.getElementById("engine-library").options.length'),3);assert(await ui('return [...s.querySelectorAll(".cwb-import-state")].every(e=>e.textContent==="已导入")'));assert((await ui('return s.getElementById("cwb-selected-import-state").textContent')).includes('已导入'));
 await c.evaluate('window.__testConfig.library=window.__testConfig.library.filter(e=>e.id!=="imported-0-video");document.getElementById("codex-wallpaper-controls").__cwbRenderConfig(window.__testConfig);true');assert.equal(await ui('return s.getElementById("engine-library").options.length'),3);
 await ui('s.getElementById("cwb-imported").value="new";s.getElementById("cwb-imported").dispatchEvent(new Event("change"));return true');assert.equal(await ui('return s.getElementById("engine-library").options.length'),51);
 await c.evaluate('window.__testConfig.library.push({id:"imported-3",workshopId:"3",name:"New save"});document.getElementById("codex-wallpaper-controls").__cwbRenderConfig(window.__testConfig);true');assert.equal(await ui('return s.getElementById("engine-library").options.length'),50);result.importStateFilterTracksProjectVariantsAndNewSaves=true;
 await ui('document.getElementById("codex-wallpaper-controls").__cwbSetPanelSize(440,780);s.getElementById("cwb-imported").scrollIntoView({block:"start"});return true');await sleep(40);
 const spacing=await ui('const r=id=>s.getElementById(id).getBoundingClientRect(),mode=r("engine-render-mode"),apply=r("engine-import-actions"),batch=r("cwb-batch-status"),save=r("engine-import"),keep=r("engine-save"),body=s.querySelector(".cwb-window-body");return {selectToActions:apply.top-mode.bottom,actionsToBatch:batch.top-apply.bottom,buttonGap:keep.left-save.right,bodyWidth:body.clientWidth,scrollWidth:body.scrollWidth}');assert(spacing.selectToActions>=8&&spacing.actionsToBatch>=12&&spacing.buttonGap>=8&&spacing.scrollWidth<=spacing.bodyWidth+1,JSON.stringify(spacing));result.importControlSpacing=spacing;
 if(process.env.CWB_PANEL_EVIDENCE_DIR){const png=await c.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(process.env.CWB_PANEL_EVIDENCE_DIR,'import-panel-440.png'),Buffer.from(png.data,'base64'));}
 result.steeringRails=[];
 for(const dark of [false,true])result.steeringRails.push(await c.evaluate(`(()=>{const root=document.createElement("main");root.innerHTML='<div data-composer-rail><div data-composer-rail-item data-composer-rail-framed class="bg-surface-elevated-secondary" style="background:rgb(90,90,90)"><button>引导任务</button></div><div data-composer-rail-item data-composer-rail-framed class="warning-native" style="background:rgb(180,100,10)">Warning</div></div><div class="relative w-fit overflow-hidden rounded-3xl"><div class="bg-surface-elevated-secondary" style="background:rgb(90,90,90)">Floating neutral bar</div></div>';document.body.append(root);const button=root.querySelector("button"),before=button.getBoundingClientRect();window.__codexWallpaperBridge={ready:true};window.__cwbDecorate=${decorateShell.toString()};(${paintShell.toString()})({palette:${dark?'{r:20,g:22,b:28,dark:true}':'{r:240,g:241,b:243,dark:false}'},visual:{glassBlur:6,glassOpacity:.6},surfaceSync:{code:false,embedded:false}});const after=button.getBoundingClientRect(),rows=[...root.querySelectorAll("[data-composer-rail-item],.rounded-3xl>div")].map(e=>({background:getComputedStyle(e).backgroundColor,blur:getComputedStyle(e).backdropFilter}));window.__cwbDecorations.dispose();root.remove();return {rows,sameGeometry:before.width===after.width&&before.height===after.height}})()`));
 assert(result.steeringRails.every(s=>s.sameGeometry&&s.rows[0].background.endsWith('0.6)')&&s.rows[2].background.endsWith('0.6)')&&s.rows[0].blur==='blur(6px)'&&s.rows[1].background==='rgb(180, 100, 10)'));result.steeringNeutralMaterialsAndWarningPreserved=true;result.passed=true;
 await c.evaluate('window.__originalSend=window.__codexWallpaperSend;window.__updateFixture={currentVersion:"0.2.2",latestVersion:"0.3.0",available:true,phase:"idle"};window.__codexWallpaperSend=raw=>{const q=JSON.parse(raw);if(!q.action.startsWith("update-"))return window.__originalSend(raw);if(q.action==="update-install")window.__updateFixture.phase="downloading";queueMicrotask(()=>window.__cwbReply(q.id,{ok:true,update:window.__updateFixture}));};true');
 await ui('s.getElementById("cwb-update-check").click();return true');await sleep(30);
 assert.equal(await ui('return s.getElementById("toggle").textContent'),'壁纸 · 有更新');assert.equal(await ui('return s.getElementById("cwb-update-install").hidden'),false);
 await ui('s.getElementById("cwb-update-install").click();return true');await sleep(30);assert.equal(await ui('return s.getElementById("cwb-update-install").disabled'),true);
 await c.evaluate('window.__updateFixture.phase="installed";window.__updateFixture.message="更新已安装，正常退出后重新打开生效。";true');await sleep(2150);
 assert.equal(await ui('return s.getElementById("cwb-update-install").hidden'),true);assert.match(await ui('return s.getElementById("cwb-update-status").textContent'),/正常退出/);result.updateNoticeDownloadAndRestartStatus=true;
 if(process.env.CWB_PANEL_EVIDENCE_DIR){await ui('document.getElementById("codex-wallpaper-controls").__cwbSetPanelSize(440,700);s.getElementById("cwb-update-title").scrollIntoView({block:"start"});return true');const png=await c.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(process.env.CWB_PANEL_EVIDENCE_DIR,'panel-updates.png'),Buffer.from(png.data,'base64'));}
}catch(e){result.error=e.stack;process.exitCode=1;}finally{if(c){await c.call('Browser.close').catch(()=>{});c.close();}browser.kill();console.log(JSON.stringify(result,null,2));}
