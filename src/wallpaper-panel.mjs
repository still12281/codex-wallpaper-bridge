export function installPanel(config,token){
 const previous=window.__cwbPanelHost||document.getElementById('codex-wallpaper-controls');
 if(previous?.__cwbToken===token&&previous.__cwbPanelVersion===43){previous.__cwbPlace?.();previous.__cwbRenderConfig?.(config);return;}
 previous?.__cwbDispose?.();previous?.remove();
 const host=document.createElement('div');host.id='codex-wallpaper-controls';host.style.cssText='position:static;display:inline-flex;align-items:center;flex:0 0 auto;margin-inline-end:8px;app-region:no-drag;-webkit-app-region:no-drag';
 host.__cwbToken=token;host.__cwbPanelVersion=43;let features=null,scanShortcut=null,scanToastTimer=null,updateTimer=null;
 window.__cwbPanelHost=host;
 const s=host.attachShadow({mode:'open'});
 const menuButtonStyle=selector=>`
 ${selector}{box-sizing:border-box;display:block;min-height:0;padding:4px 10px;border:1px solid transparent;border-radius:var(--radius-md,8px);background:transparent;box-shadow:none;color:var(--color-text-tertiary,var(--cwb-muted,CanvasText));font:400 var(--text-base,14px)/1 var(--font-sans,system-ui);white-space:nowrap}
 ${selector}:is(:hover,:focus-visible){outline:none;background:color-mix(in srgb,var(--color-text,CanvasText) 5%,transparent);color:var(--color-codex-description,var(--cwb-muted,CanvasText))}`;
 // Share the native menu row's layout instead of covering workspace tabs.
 const anchorSelector='[class*="ApplicationMenuTopBar"] > [role="menubar"]';
 const findMenu=()=>{const native=document.getElementById('application-menu-trigger-file-menu')?.closest('[role="menubar"]');if(native)return native;const matches=document.querySelectorAll(anchorSelector);return matches.length===1?matches[0]:null;};
 let menuAnchor=null,placementQueued=false,disposed=false;
 const place=()=>{if(disposed)return;const candidate=findMenu(),rect=candidate?.getBoundingClientRect();const menu=rect?.width>0&&rect.height>0?candidate:null;menuAnchor=menu;if(menu){host.style.cssText='position:static;display:inline-flex;align-items:center;flex:0 0 auto;margin-inline-end:8px;app-region:no-drag;-webkit-app-region:no-drag';if(host.parentElement!==menu.parentElement||host.previousElementSibling!==menu)menu.after(host);}else{host.style.cssText='position:fixed;display:inline-flex;align-items:center;top:4px;right:clamp(8px,11vw,144px);z-index:2147483000;app-region:no-drag;-webkit-app-region:no-drag';if(host.parentElement!==document.body)document.body.append(host);}host.dataset.cwbPlacement=menu?'menu':'fallback';};
 const queuePlace=()=>{if(placementQueued||disposed)return;placementQueued=true;requestAnimationFrame(()=>{placementQueued=false;place();placeScan();});};
 // Hint popovers and manual wrappers for anchored previews leave the scan
 // control in the menu. Explicit dialogs and native menus still take priority.
 const overlaySelector=':is(dialog,[role="dialog"],[role="alertdialog"],[role="menu"],[popover]):not([popover="hint"],[popover="manual"]:has(> [data-anchor-positioning]):not([aria-modal="true"],[data-state="open"]))';
 const relevant='[class*="ApplicationMenuTopBar"],[role="menubar"],#application-menu-trigger-file-menu,'+overlaySelector;
 const observer=new MutationObserver(changes=>{if(!host.isConnected||(menuAnchor&&!menuAnchor.isConnected)||changes.some(c=>c.type==='attributes'?c.target!==scanEntry&&c.target.matches(overlaySelector):[...c.addedNodes,...c.removedNodes].some(n=>n.nodeType===1&&n!==scanEntry&&(n.matches(relevant)||n.querySelector(relevant)))))queuePlace();});
 const watchToggle=event=>{if(event.target!==scanEntry&&event.target!==scanToast&&event.target.matches?.(overlaySelector))queuePlace();};
 observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','data-state']});
 document.addEventListener('toggle',watchToggle,true);s.addEventListener('toggle',watchToggle,true);window.addEventListener('resize',queuePlace);
 host.__cwbPlace=()=>{place();placeScan();};host.__cwbDispose=()=>{disposed=true;observer.disconnect();document.removeEventListener('toggle',watchToggle,true);s.removeEventListener('toggle',watchToggle,true);window.removeEventListener('resize',queuePlace);if(scanShortcut)window.removeEventListener('keydown',scanShortcut,true);clearTimeout(scanToastTimer);clearTimeout(updateTimer);scanEntry.remove();};
 host.__cwbEntryState=()=>{const button=s.getElementById('toggle'),r=button?.getBoundingClientRect(),style=getComputedStyle(host);return {visible:!!(host.isConnected&&r?.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight&&style.display!=='none'&&style.visibility!=='hidden'),placement:host.dataset.cwbPlacement};};place();
 s.innerHTML=`<style>:host{font:13px system-ui;color:var(--cwb-ink,#1d1d1f)}button,select,input{font:inherit}dialog::backdrop{background:rgba(0,0,0,.32)}${menuButtonStyle(':host #toggle')}#realtime-notice{white-space:pre-line}#realtime-confirm,#error-dialog,#cwb-choice-dialog{background:var(--cwb-confirm-bg,#ffffff)!important;color:var(--cwb-confirm-ink,#1d1d1f)!important}#realtime-confirm p,#error-dialog p,#cwb-choice-dialog p{opacity:1;color:inherit!important}#error-dialog p{white-space:pre-wrap;overflow-wrap:anywhere}#cwb-update-status{overflow-wrap:anywhere}</style>
 <button id="toggle" aria-label="打开壁纸设置">壁纸</button><dialog aria-labelledby="title"><button id="close" aria-label="关闭"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5"/></svg></button><h2 id="title">壁纸与外观</h2><label id="cwb-library-select-wrap">我的壁纸<select id="library"></select></label><label id="cwb-shade-row"><span class="cwb-row-meta"><span class="cwb-row-title">遮罩浓度</span><span class="cwb-row-desc">压暗壁纸以提升对话文字对比度</span></span><span class="cwb-row-ctrl cwb-slider-wrap"><input id="shade" type="range" min="25" max="85" step="5"><output id="opacity"></output></span></label><label id="cwb-pause-row"><span class="cwb-row-meta"><span class="cwb-row-title">仅聚焦 Codex 时播放动态壁纸</span></span><span class="cwb-row-ctrl"><input id="pause" type="checkbox"></span></label><p id="status" role="status" aria-live="polite">就绪</p><footer><button id="import">导入本地</button><button id="done" hidden>完成</button></footer><input id="file" type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"></dialog>`;
 const surfaceRepair=document.createElement('div');surfaceRepair.id='cwb-surface-repair';surfaceRepair.className='cwb-setting-row';
 surfaceRepair.innerHTML='<span class="cwb-row-meta"><span class="cwb-row-title">立即扫描并适配</span><span id="cwb-surface-scan-note" class="cwb-row-desc">检查所有已打开的页面 · 快捷键 Ctrl+Alt+Shift+W</span><span id="cwb-surface-scan-result" class="cwb-row-desc" role="status"></span></span><span class="cwb-row-ctrl"><button id="cwb-surface-scan" type="button" aria-describedby="cwb-surface-scan-note">执行扫描</button></span>';
 const scanEntry=document.createElement('span');scanEntry.id='cwb-quick-scan';
 const scanRoot=scanEntry.attachShadow({mode:'open'});
 scanRoot.innerHTML=`<style>
 :host{display:inline-flex;pointer-events:auto;flex:none;app-region:no-drag;-webkit-app-region:no-drag}
 :host([popover]){position:fixed;inset:44px 12px auto auto;margin:0;padding:4px;border:0;border-radius:var(--radius-lg,12px);background:var(--cwb-raised-background,Canvas);backdrop-filter:var(--cwb-raised-filter);box-shadow:0 3px 14px #0002}
 :host([popover]:not(:popover-open)){display:none}
 :host([data-placement="settings"]){position:absolute;inset:16px 48px auto auto;z-index:1}
 button{min-height:24px;padding:4px 8px;border:0;border-radius:var(--radius-md,8px);background:transparent;color:var(--cwb-ink,var(--color-text,CanvasText));font:400 var(--text-base,14px)/1 var(--font-sans,system-ui);white-space:nowrap;cursor:pointer}
 button:hover{background:var(--color-background-secondary-ghost-hover,color-mix(in srgb,currentColor 6%,transparent))}button:focus-visible{outline:2px solid var(--color-ring,Highlight);outline-offset:-2px}button[aria-disabled=true]{cursor:progress}
 button svg,button span{pointer-events:none}
 .cwb-scan-ico{display:none;flex:none}
 :host([data-placement="panel"]) button{display:inline-flex;align-items:center;gap:5px;min-height:28px;height:28px;padding:0 9px;border-radius:7px;font-size:12px;font-weight:500;color:var(--cwb-muted,CanvasText)}
 :host([data-placement="panel"]) button:hover{background:var(--cwb-seg-bg,rgba(0,0,0,.06));color:var(--cwb-ink,CanvasText)}
 :host([data-placement="panel"]) .cwb-scan-ico{display:inline-block}
 :host([data-placement="panel"][data-compact="true"]) button{padding:0 7px}
 :host([data-placement="panel"][data-compact="true"]) .cwb-scan-label{display:none}
 ${menuButtonStyle(':host([data-placement="menu"]) button')}
 output{position:fixed;inset:auto 16px 20px auto;max-width:min(420px,80vw);margin:0;padding:10px 14px;border:1px solid var(--cwb-border,#8195a480);border-radius:10px;background:var(--cwb-ink,#1d1d1f);color:var(--cwb-surface,#ffffff);font:12px system-ui;box-shadow:0 8px 24px #0004;pointer-events:none}
 </style><button type="button" aria-keyshortcuts="Control+Alt+Shift+W" title="扫描并适配页面背景（Ctrl+Alt+Shift+W）"><svg class="cwb-scan-ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg><span class="cwb-scan-label">扫描适配</span></button><output popover="manual" role="status"></output>`;
 const scanButton=scanRoot.querySelector('button'),scanLabel=scanRoot.querySelector('.cwb-scan-label'),scanToast=scanRoot.querySelector('output');
 const notifyStatus=text=>{if(disposed)return;placeScan();if(!scanEntry.isConnected)return;scanToast.textContent=text;scanToast.showPopover();clearTimeout(scanToastTimer);scanToastTimer=setTimeout(()=>scanToast.hidePopover(),6000);};
 function placeScan(){
  if(disposed)return;
  const own=[...s.querySelectorAll('dialog:modal')].at(-1);
  const active='dialog:modal,[role="dialog"]:is([aria-modal="true"],[data-state="open"]):not([data-state="closed"]),[role="alertdialog"]:not([data-state="closed"]),[role="menu"][data-state="open"],:popover-open';
  const native=[...document.querySelectorAll(active)].filter(e=>e!==scanEntry&&e.matches(overlaySelector)&&e.getClientRects().length>0).at(-1);
  const overlay=own||native;
  const parent=overlay===dialog?dialog.querySelector('.cwb-titlebar')||dialog:overlay||s;
  const mode=native?.classList.contains('settings-dialog')&&!own?'settings':overlay&&overlay!==dialog?'popover':own?'panel':'menu';
  if(scanEntry.parentNode===parent&&scanEntry.dataset.placement===mode)return;
  const showStatus=scanToast.matches(':popover-open');
  if(showStatus)scanToast.hidePopover();
  if(scanEntry.matches(':popover-open'))scanEntry.hidePopover();
  scanEntry.dataset.placement=mode;
  if(mode==='popover')scanEntry.setAttribute('popover','manual');else scanEntry.removeAttribute('popover');
  if(mode==='menu')s.insertBefore(scanEntry,dialog);
  else if(mode==='panel'&&parent.contains(repair))repair.before(scanEntry);
  else parent.append(scanEntry);
  if(mode==='popover')scanEntry.showPopover();
  if(showStatus)scanToast.showPopover();
 }
 const playback=document.createElement('div');playback.id='cwb-playback-custom';
 playback.innerHTML=`<div class="cwb-inset-group"><label class="cwb-setting-row"><span class="cwb-row-meta"><span class="cwb-row-title">最大宽度</span></span><span class="cwb-row-ctrl"><select id="resolution"><option value="960">960 · 省电</option><option value="1280">1280 · 均衡</option><option value="1920">1920 · 清晰</option><option value="2560">2560 · 2K</option><option value="3840">3840 · 原画优先</option></select></span></label><label class="cwb-setting-row"><span class="cwb-row-meta"><span class="cwb-row-title">帧率上限</span></span><span class="cwb-row-ctrl"><select id="fps"><option value="12">12 FPS</option><option value="24">24 FPS · 推荐</option><option value="30">30 FPS</option><option value="60">60 FPS</option><option value="120">120 FPS · 仅GPU</option><option value="144">144 FPS · 仅GPU</option></select></span></label><div class="cwb-group-footer"><span class="cwb-row-meta"><span id="cwb-import-profile-note" class="cwb-row-desc"></span></span><button id="apply" type="button">应用播放规格</button></div></div>`;
 const quality=document.createElement('div');quality.id='cwb-playback-options';quality.className='cwb-section-stack';
 const customPlayback=document.createElement('details');customPlayback.id='cwb-custom-playback';customPlayback.className='cwb-feature';customPlayback.innerHTML='<summary>自定义播放规格与 WebGL 细节</summary>';customPlayback.append(playback);quality.append(customPlayback);s.getElementById('status').before(quality);
 const engine=document.createElement('button');engine.id='engine';engine.type='button';engine.textContent='导入当前 Wallpaper Engine 壁纸';s.querySelector('footer').before(engine);
 const controlPalette=document.createElement('style');s.append(controlPalette);
 const paintControls=c=>{
  const dark=c.visual?.theme==='light'?false:c.visual?.theme==='dark'?true:c.palette?.dark!==false;
  const p=c.palette||{r:20,g:22,b:28},tint=[p.r,p.g,p.b].join(',');host.dataset.cwbTheme=dark?'dark':'light';
  controlPalette.textContent=`:host{color-scheme:${dark?'dark':'light'};--cwb-canvas:color-mix(in srgb,${dark?'#1c1c1e':'#f5f5f7'} 95%,rgb(${tint}));--cwb-sidebar:color-mix(in srgb,${dark?'#232326':'#e9ebf0'} 92%,rgb(${tint}));--cwb-surface:${dark?'#28282b':'#ffffff'};--cwb-surface-hover:${dark?'#313136':'#f2f3f6'};--cwb-raised:${dark?'#35353a':'#e4e6ec'};--cwb-ink:${dark?'#f5f5f7':'#1d1d1f'};--cwb-muted:${dark?'#a1a1a6':'#6e6e73'};--cwb-field:${dark?'#1f1f23':'#ffffff'};--cwb-hairline:${dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)'};--cwb-border:${dark?'rgba(255,255,255,.12)':'rgba(0,0,0,.11)'};--cwb-divider:${dark?'rgba(255,255,255,.09)':'rgba(0,0,0,.09)'};--cwb-confirm-bg:var(--cwb-surface);--cwb-confirm-ink:var(--cwb-ink);--cwb-accent:${dark?'#0a84ff':'#0071e3'};--cwb-accent-hover:${dark?'#2d96ff':'#0062c4'};--cwb-accent-text:${dark?'#4da3ff':'#0066cc'};--cwb-accent-soft:${dark?'rgba(10,132,255,.18)':'rgba(0,113,227,.12)'};--cwb-on-accent:#ffffff;--cwb-danger:${dark?'#ff453a':'#d93025'};--cwb-danger-bg:${dark?'rgba(255,69,58,.16)':'rgba(217,48,37,.10)'};--cwb-success:${dark?'#30d158':'#34c759'};--cwb-seg-bg:${dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.06)'};--cwb-seg-active:${dark?'#3c3c42':'#ffffff'};--cwb-switch-off:${dark?'rgba(120,120,128,.38)':'rgba(120,120,128,.24)'};--cwb-track:${dark?'rgba(255,255,255,.16)':'rgba(0,0,0,.12)'};--cwb-shadow:${dark?'0 28px 80px rgba(0,0,0,.56),0 2px 12px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.08)':'0 24px 68px rgba(0,0,0,.24),0 2px 10px rgba(0,0,0,.08),inset 0 0 0 1px rgba(255,255,255,.72)'};color:var(--cwb-ink)}dialog{background:var(--cwb-canvas);color:var(--cwb-ink)}`;
 };
 const regions=[['code','代码与终端保留原生底色','阅读长代码或 Diff 时提升清晰度'],['embedded','内嵌网页保留原生底色','']];
 const surfaces=document.createElement('div');surfaces.id='surface-options';surfaces.className='cwb-feature cwb-inset-group';
 surfaces.innerHTML=regions.map(([key,label,desc])=>`<label class="cwb-setting-row"><span class="cwb-row-meta"><span class="cwb-row-title">${label}</span>${desc?`<span class="cwb-row-desc">${desc}</span>`:''}</span><span class="cwb-row-ctrl"><input type="checkbox" id="sync-${key}"></span></label>`).join('')+'<p id="surface-status" class="cwb-inline-note" role="status" aria-live="polite"></p>';
 surfaces.append(surfaceRepair);
 quality.before(surfaces);
 const remove=document.createElement('button');remove.id='delete';remove.type='button';remove.textContent='删除';
 const deletePicker=document.createElement('div');deletePicker.className='cwb-setting-row cwb-row-stack';deletePicker.innerHTML='<span class="cwb-row-meta"><span class="cwb-row-title">删除指定壁纸（仅 Codex）</span><span class="cwb-row-desc">仅从 Codex 移除，原素材保持不变</span></span><span class="cwb-row-ctrl cwb-ctrl-wrap"><select id="delete-target" aria-label="选择要删除的壁纸"></select></span>';
 deletePicker.querySelector('.cwb-row-ctrl').append(remove);
 const management=document.createElement('div');management.id='cwb-management-group';management.className='cwb-inset-group';
 const clearSwitchCache=document.createElement('button');clearSwitchCache.id='clear-switch-cache';clearSwitchCache.type='button';clearSwitchCache.className='cwb-soft-btn';clearSwitchCache.textContent='清理缓存';clearSwitchCache.title='切换缓存最多512 MB，转换缓存最多256 MB；不删除原素材、已保存副本或当前画面';clearSwitchCache.onclick=()=>busy(async()=>{const cache=await caches.open('codex-wallpaper-resources-v1');for(const key of await cache.keys())await cache.delete(key);const r=await send({action:'conversion-cache-clear'});return {message:'切换缓存已清理。'+r.message};});
 const cacheRow=document.createElement('div');cacheRow.className='cwb-setting-row';cacheRow.innerHTML='<span class="cwb-row-meta"><span class="cwb-row-title">清理壁纸缓存</span><span class="cwb-row-desc">清理切换与转换缓存，不删除原素材或已保存副本</span></span><span class="cwb-row-ctrl"></span>';
 cacheRow.querySelector('.cwb-row-ctrl').append(clearSwitchCache);
 management.append(cacheRow,deletePicker);
 s.getElementById('status').before(management);
 const browse=document.createElement('button');browse.id='browse';browse.type='button';
 const picker=document.createElement('div');picker.id='engine-picker';picker.hidden=true;picker.innerHTML='<div class="cwb-picker-head"><strong>浏览壁纸库</strong><button id="cwb-picker-close" type="button" class="cwb-soft-btn">收起</button></div><label>搜索范围<select id="engine-scope"><option value="global">全局 · 所有磁盘已发现的壁纸库</option><option value="folder">自选文件夹</option></select></label><div id="folder-options" hidden><label>文件夹路径<input id="engine-folder" type="text" placeholder="选择或粘贴文件夹完整路径"></label><button id="choose-folder" type="button">选择文件夹…</button></div><button id="engine-scan" type="button">搜索壁纸</button><details id="engine-roots"><summary>搜索位置</summary><p id="engine-locations"></p></details><label>筛选壁纸<input id="engine-search" type="search" placeholder="名称或工坊 ID"></label><select id="engine-library" size="5" aria-label="已下载的 Wallpaper Engine 壁纸"></select><p id="engine-selection"></p><div id="engine-import-actions"><button id="engine-import" type="button">导入并应用</button><button id="engine-save" type="button">仅保存到我的壁纸</button></div>';
 picker.append(engine);
 s.querySelector('dialog').append(browse,picker);
 picker.querySelector('#cwb-picker-close').onclick=()=>{picker.hidden=true;};
 const errorDialog=document.createElement('dialog');errorDialog.id='error-dialog';errorDialog.setAttribute('role','alertdialog');errorDialog.setAttribute('aria-labelledby','error-title');errorDialog.setAttribute('aria-describedby','error-message');errorDialog.innerHTML='<h2 id="error-title">操作失败</h2><p id="error-message"></p><button id="error-dismiss" type="button" autofocus>知道了</button>';s.append(errorDialog);
 const choiceDialog=document.createElement('dialog');choiceDialog.id='cwb-choice-dialog';choiceDialog.setAttribute('aria-labelledby','cwb-choice-title');choiceDialog.innerHTML='<h2 id="cwb-choice-title"></h2><p id="cwb-choice-message" style="white-space:pre-wrap"></p><form method="dialog"><footer><button value="cancel" id="cwb-choice-cancel" autofocus>取消</button><button value="confirm" id="cwb-choice-confirm">确定</button></footer></form>';s.append(choiceDialog);
 const askChoice=(title,text,accept='确定',cancel='取消')=>new Promise(resolve=>{s.getElementById('cwb-choice-title').textContent=title;s.getElementById('cwb-choice-message').textContent=text;s.getElementById('cwb-choice-confirm').textContent=accept;s.getElementById('cwb-choice-confirm').dataset.cwbVariant=accept==='删除'?'danger':'primary';s.getElementById('cwb-choice-cancel').textContent=cancel;s.getElementById('cwb-choice-cancel').hidden=!cancel;choiceDialog.returnValue='cancel';choiceDialog.addEventListener('close',()=>resolve(choiceDialog.returnValue==='confirm'),{once:true});choiceDialog.showModal();});
 const notice=(title,text)=>askChoice(title,text,'知道了','');
 const confirmationDialog=document.createElement('dialog');confirmationDialog.id='realtime-confirm';confirmationDialog.setAttribute('aria-labelledby','realtime-title');confirmationDialog.setAttribute('aria-describedby','realtime-notice');confirmationDialog.innerHTML='<h2 id="realtime-title">确认实时壁纸</h2><p id="realtime-name"></p><p id="realtime-notice"></p><form method="dialog"><footer><button value="cancel" autofocus>取消</button><button id="realtime-accept" value="confirm">确认导入并应用</button></footer></form>';s.append(confirmationDialog);
 const renderMode=document.createElement('label');renderMode.innerHTML='场景导入方式<select id="engine-render-mode"><option value="auto">自动（场景 GPU、网页原版）</option><option value="webwallgl">GPU 直绘（WebGL）</option><option value="chromium-web">网页浏览器（试验）</option><option value="realtime">原版兼容模式</option></select>';picker.querySelector('#engine-import-actions').before(renderMode);
 const kindLabel=document.createElement('label');kindLabel.innerHTML='搜索类型<select id="engine-kind"><option value="engine">Wallpaper Engine 壁纸</option><option value="media">其它图片 / 视频（指定文件夹）</option></select>';picker.querySelector('.cwb-picker-head').after(kindLabel);
 let seq=0,activeImportId=null,importCancelled=false;const pending=new Map();
 const offlineMessage='壁纸宿主无响应。请运行壁纸数据目录中的 Repair.cmd。';
 const send=payload=>new Promise((resolve,reject)=>{
  const id=++seq,repair=payload.action==='wallpaper-repair';
  if(repair&&typeof window.__codexWallpaperSend!=='function'){reject(Error(offlineMessage));return;}
  const timeout=(duration,text)=>setTimeout(()=>{pending.delete(id);reject(Error(text));},duration);
  const entry={resolve,reject,timer:repair?timeout(5000,offlineMessage):timeout(['import-end','wallpaper-engine'].includes(payload.action)?1200000:180000,'处理超时，请检查背景助手')};
  if(repair)entry.accept=()=>{clearTimeout(entry.timer);entry.timer=timeout(120000,'恢复尚未完成，请检查当前壁纸。');};
  pending.set(id,entry);
  try{window.__codexWallpaperSend(JSON.stringify({...payload,...(activeImportId?{operationId:activeImportId}:{}),id,token}));}
  catch(error){pending.delete(id);clearTimeout(entry.timer);reject(repair?Error(offlineMessage):error);}
 });
 window.__cwbReply=(id,result)=>{
  const p=pending.get(id);if(!p)return;
  if(result.accepted){p.accept?.();p.accept=null;return;}
  pending.delete(id);clearTimeout(p.timer);result.ok?p.resolve(result):p.reject(Object.assign(Error(result.error||'操作失败'),{code:result.code}));
 };
 const $=id=>s.getElementById(id),dialog=s.querySelector('dialog');
 let windowChrome;const restorePanelPosition=()=>windowChrome?.restore(),placePanel=(...args)=>windowChrome?.place(...args);
 const groups=c=>window.__cwbLibraryGroups(c.library,c.selectedId);
 const syncRange=el=>{if(!el)return;const min=Number(el.min||0),max=Number(el.max||100),val=Number(el.value||0);el.style.setProperty('--cwb-range-pct',(max>min?Math.max(0,Math.min(100,((val-min)/(max-min))*100)):0)+'%');};
 const baseRender=c=>{config=c;$('library').replaceChildren(...groups(c).map(e=>{const o=document.createElement('option');o.value=e.id;o.textContent=e.name;return o}));if(!c.selectedId){const empty=document.createElement('option');empty.value='';empty.textContent='选择壁纸';$('library').prepend(empty);}$('library').value=c.selectedId||'';$('shade').value=Math.round(c.darkOverlay*100);$('opacity').value=$('shade').value+'%';syncRange($('shade'));$('pause').checked=c.pauseOnBlur!==false;const selected=c.library.find(e=>e.id===c.selectedId),p=selected?.limits||c.playback||{maxWidth:1280,fps:24};$('resolution').value=String(p.maxWidth);$('fps').value=String(p.fps||24);syncImportProfileNote();for(const option of $('fps').options)if(Number(option.value)>60)option.disabled=selected?.mode!=='webwallgl'||selected.displayTier==='static';for(const [key]of regions)$('sync-'+key).checked=c.surfaceSync?.[key]===false;};
 const render=c=>{if(livePending&&desiredId&&c.selectedId!==desiredId)return;if(!livePending)window.__cwbDesiredWallpaperId=c.selectedId;baseRender(c);paintControls(c);const autoOption=$('engine-render-mode').querySelector('option[value=auto]');autoOption.textContent='自动（场景 '+(c.rendererPriority?.scene==='native'?'原版':'GPU')+'、网页 '+(c.rendererPriority?.web==='chromium-web'?'浏览器':'原版')+'）';const selected=$('delete-target').value;$('delete-target').replaceChildren(...groups(c).map(e=>{const o=document.createElement('option');o.value=e.id;o.textContent=e.name+(e.entries.some(item=>item.id===c.selectedId)?'（正在使用）':'');return o}));$('delete-target').value=groups(c).some(g=>g.id===selected)?selected:c.selectedId||groups(c)[0]?.id||'';$('delete').disabled=processing||livePending||!c.library.length;features?.render(c);};
 const message=text=>{$('status').textContent=text;windowChrome?.toast?.(text);};
 const cancelImport=document.createElement('button');cancelImport.id='import-cancel';cancelImport.type='button';cancelImport.hidden=true;cancelImport.textContent='取消导入';$('status').after(cancelImport);cancelImport.onclick=async()=>{if(!activeImportId)return;importCancelled=true;cancelImport.disabled=true;try{const r=await send({action:'import-cancel'});message(r.message)}catch(error){message(error.message)}};
 host.__cwbImportProgress=value=>{if(!activeImportId||value.operationId!==activeImportId)return;const percent=value.duration>0&&value.processedSeconds!==undefined?' · '+Math.min(99,Math.round(value.processedSeconds/value.duration*100))+'%':'';message((value.item?value.item+' · ':'')+value.phase+percent+(value.duration>0?'（当前阶段）':''));};
 const showError=(title,text)=>{$('error-title').textContent=title;$('error-message').textContent=text;if(!errorDialog.open)errorDialog.showModal()};
 const confirmRealtime=info=>new Promise(resolve=>{$('realtime-name').textContent=info.name;$('realtime-notice').textContent=info.renderer==='chromium-web'?`无窗口 Chromium 执行此网页的本地脚本；外网资源不加载。\n输出 ${info.limits.maxWidth} × ${info.limits.maxHeight}，上限 ${info.limits.fps} FPS。\n暂停关闭专用浏览器，恢复重新加载，网页内部状态会重置。作者属性初始生效；无系统音频/鼠标转发。\n${info.apply?'首帧成功后切换，失败保留旧背景。':'仅保存引用；当前不执行脚本、不切换背景。'}`:info.renderer==='webwallgl'?`使用 GPU 直接绘制，并运行此场景的脚本。\n最大宽度 ${info.limits.maxWidth}，帧率上限 ${info.limits.fps} FPS。\n${info.apply?'确认后加载，首帧成功再切换。':'仅保存引用，不执行脚本、不切换背景。'}`:`由 Wallpaper Engine 运行完整场景，采集会增加占用。\n本次输出：${info.limits.maxWidth} × ${info.limits.maxHeight}，采集上限 ${info.limits.fps} FPS。源端帧率仍受 Wallpaper Engine 设置限制。\n${info.apply?'确认后应用；后台暂停时释放源。':'仅保存项目引用，不启动渲染、不切换背景；稍后应用时会再次确认。'}`;$('realtime-accept').textContent=info.apply?'确认导入并应用':'确认仅保存';confirmationDialog.returnValue='cancel';confirmationDialog.addEventListener('close',()=>resolve(confirmationDialog.returnValue==='confirm'),{once:true});confirmationDialog.showModal()});
 $('error-dismiss').onclick=()=>errorDialog.close();
 host.__cwbRuntimeError=text=>{message(text);showError('实时壁纸已停止更新',text)};
 host.__cwbCaptureStats=text=>{if(dialog.open){const output=s.getElementById('cwb-display-note');if(output)output.textContent=text}};
 for(const [key,label]of regions)$('sync-'+key).onchange=async()=>{const native=$('sync-'+key).checked;const r=await busy(()=>send({action:'surface-sync',region:key,enabled:!native}));$('surface-status').textContent=r?`${label.replace('保留原生底色','')}：${native?'已保留原生底色':'已跟随壁纸'}。`:'切换未完成，请查看下方错误提示。';};
 let processing=false,livePending=false,selectionUiRevision=0,desiredId=null;
 const lockSelectionControls=()=>{const locked=processing||livePending;dialog.setAttribute('aria-busy',String(locked));for(const id of ['library-apply','library-delete','cwb-batch-import','cwb-batch-clear','import','engine','library','shade','pause','resolution','fps','apply','delete','delete-target','browse','engine-import','engine-save','engine-library','engine-search','engine-render-mode','engine-kind','engine-scope','engine-folder','choose-folder','engine-scan',...regions.map(([key])=>'sync-'+key),...Array.from(s.querySelectorAll('[data-cwb-control]'),element=>element.id)]){if($(id))$(id).disabled=id==='library'?processing||!config.library.length:locked;}if(!locked){features?.render(config);if(!config.library.length)for(const id of ['delete','apply','library'])$(id).disabled=true;}};
 const settle=async(r,{batchSave=false}={})=>{while(r.confirmation||r.duplicate||r.mediaReview){if(r.mediaReview){const review=r.mediaReview;if(!await askChoice('导入前容量检查','当前规格估算可能约 '+review.estimatedMiB+' MiB，播放上限为 '+review.maxMiB+' MiB。\n实际结果可能不同；超过上限会停止并清理，不采用截短视频。\n可返回调整规格，或按原规格尝试。','按原规格尝试','返回调整规格')){await send({action:'import-cancel',uploadId:review.retry.uploadId});return {config,cancelled:true,message:'已取消本次准备，请调整规格后重试；原素材和当前背景保持不变。'};}r=await send({...review.retry,acceptSizeRisk:true});continue;}if(r.duplicate){const info=r.duplicate;if(!await askChoice('壁纸已存在',info.name+'\n已在“我的壁纸”中，无需重复导入。',info.apply?'应用已有壁纸':'保留已有壁纸'))return {config,cancelled:true,message:'已取消重复导入，当前背景保持不变。'};r=await send({action:'duplicate-use',existingId:info.existingId,apply:info.apply});continue;}const info=r.confirmation;if(!(batchSave&&!info.apply)&&!await confirmRealtime(info)){await send({action:'import-cancel'});return {config,cancelled:true,message:'已取消实时导入；未启动渲染，当前背景保持不变。'};}message(info.apply?'正在启动实时渲染并等待首帧…':'正在保存实时壁纸引用…');r=await send({action:'wallpaper-engine-confirm',confirmationToken:info.token,confirmed:true});}return r;};
 const busy=async(fn,failureTitle='操作失败',cancelable=false)=>{if(processing||livePending)return;processing=true;if(cancelable){activeImportId='import-'+crypto.randomUUID();importCancelled=false;cancelImport.hidden=false;cancelImport.disabled=false;}dialog.setAttribute('aria-busy','true');const controls=['library-apply','library-delete','cwb-batch-import','cwb-batch-clear','import','engine','library','shade','pause','resolution','fps','apply','delete','delete-target','browse','engine-import','engine-save','engine-library','engine-search','engine-render-mode','engine-kind','engine-scope','engine-folder','choose-folder','engine-scan',...regions.map(([key])=>'sync-'+key),...Array.from(s.querySelectorAll('[data-cwb-control]'),element=>element.id)];for(const id of controls)if($(id))$(id).disabled=true;message('正在处理…');try{let r=await fn();r=await settle(r);if(r.superseded){message('这次切换已被新的选择替代。');return r;}if(r.config)render(r.config);message(r.message||'已热更新并保存，无需重启 Codex。');return r}catch(e){if(cancelable&&activeImportId)await send({action:'import-cancel'}).catch(()=>{});render(config);message(e.message);if(e.code!=='IMPORT_CANCELLED')showError(failureTitle,e.message)}finally{activeImportId=null;cancelImport.hidden=true;if(cancelable)$('file').value='';processing=false;dialog.setAttribute('aria-busy','false');for(const id of controls)if($(id))$(id).disabled=false;if(!config.library.length)for(const id of ['delete','apply','library'])$(id).disabled=true;features?.render(config);selection()}};
 host.__cwbMediaPanelVisible=()=>{const el=s.getElementById('cwb-media-options');return dialog.open&&!!el&&!el.closest('[hidden]');};
 dialog.addEventListener('close',()=>{clearTimeout(scanToastTimer);scanToast.hidePopover?.();window.__cwbMediaActivity?.report();});
 const applyLive=async id=>{
  if(processing)return;const revision=++selectionUiRevision;desiredId=id;window.__cwbDesiredWallpaperId=id;livePending=true;lockSelectionControls();message('正在切换壁纸…');
  try{const result=await send({action:'select',selectedId:id});if(revision!==selectionUiRevision||result.superseded)return;livePending=false;if(result.config)render(result.config);message('已切换壁纸。');}
  catch(error){if(revision!==selectionUiRevision)return;livePending=false;render(config);message(error.message);showError('壁纸切换失败',error.message);}
  finally{if(revision===selectionUiRevision){livePending=false;desiredId=null;lockSelectionControls();}}
 };
 const deleteWallpaper=async id=>{const group=groups(config).find(g=>g.entries.some(e=>e.id===id));if(!group)throw Error('壁纸不存在');if(!await askChoice('删除壁纸',group.name+'\n从 Codex 删除此壁纸的全部播放版本，原素材保持不变。','删除'))return {config,cancelled:true,message:'已取消删除。'};return send({action:'delete',selectedId:id,allVersions:true});};
 $('toggle').onclick=()=>{dialog.showModal();windowChrome?.activateTab?.('wallpapers');restorePanelPosition();const r=dialog.getBoundingClientRect();placePanel(r.left,r.top);const body=dialog.querySelector('.cwb-window-body');if(body)body.scrollTop=0;features?.render?.(config);window.__cwbMediaActivity?.report();(s.querySelector('.cwb-saved-card')||$('browse')).focus({preventScroll:true});};$('close').onclick=$('done').onclick=()=>dialog.close();
 const repair=document.createElement('button');repair.id='cwb-repair';repair.type='button';repair.dataset.cwbControl='';repair.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg><span class="cwb-tb-label">一键恢复</span>';repair.title='重新加载当前壁纸及其音频连接';
 const repairLabel=repair.querySelector('.cwb-tb-label');
 repair.onclick=async()=>{
  if(processing||livePending)return;
  repairLabel.textContent='正在恢复…';
  try{
   const result=await busy(()=>{message('正在恢复壁纸和音频…');return send({action:'wallpaper-repair'});},'壁纸恢复失败');
   if(result)notifyStatus(result.message);
  }finally{repairLabel.textContent='一键恢复';}
 };
 $('library').onchange=()=>features?.selectSaved($('library').value,true);
 $('shade').oninput=()=>{$('opacity').value=$('shade').value+'%';syncRange($('shade'));const tint=document.getElementById('codex-wallpaper-bridge-layer')?.shadowRoot?.querySelector('[data-cwb-shade]');if(tint){const p=config.palette||{r:20,g:22,b:28};tint.style.background=`rgba(${p.r},${p.g},${p.b},${Number($('shade').value)/100})`}};
 $('shade').onchange=$('pause').onchange=()=>busy(()=>send({action:'appearance',darkOverlay:Number($('shade').value)/100,pauseOnBlur:$('pause').checked}));
 $('import').onclick=()=>busy(async()=>{const picked=await send({action:'media-pick'});if(picked.cancelled||importCancelled)return {config,cancelled:true,message:'已取消选择文件。'};message('正在准备本机文件：'+picked.name);return send({action:'wallpaper-engine',projectToken:picked.projectToken,apply:true,profile:chosenProfile()});},'壁纸导入失败',true);
 function syncImportProfileNote(){const high=Number($('fps').value)>60,profile=high?(config.playback||{maxWidth:1280,fps:24}):{maxWidth:Number($('resolution').value),fps:Number($('fps').value)},capacity=profile.maxWidth<=1280&&profile.fps<=30?32:128;$('cwb-import-profile-note').textContent=(high?'GPU高刷独立保存；':'')+'新导入规格：'+profile.maxWidth+' / '+profile.fps+' FPS · 图片保护 '+capacity+' MiB';}$('fps').addEventListener('change',syncImportProfileNote);$('resolution').addEventListener('change',syncImportProfileNote);const chosenProfile=()=>Number($('fps').value)>60?{...(config.playback||{maxWidth:1280,fps:24})}:{maxWidth:Number($('resolution').value),fps:Number($('fps').value)};
 $('engine').onclick=()=>busy(()=>{message('正在读取 Wallpaper Engine 当前壁纸…');return send({action:'wallpaper-engine',renderMode:$('engine-render-mode').value,profile:chosenProfile()})},'壁纸导入失败',true);
 $('apply').onclick=()=>busy(()=>{message('正在按所选规格生成播放副本…');return send({action:'playback',selectedId:config.selectedId,maxWidth:Number($('resolution').value),fps:Number($('fps').value)})});
 $('delete').onclick=()=>busy(()=>deleteWallpaper($('delete-target').value));
 let engineItems=[];
 let inspectionKey='',inspectionState=null,inspectionLoading=false,inspectionGeneration=0;
 const showInspection=()=>{const item=engineItems.find(e=>e.token===$('engine-library').value);features?.inspect(item,inspectionState,inspectionLoading);$('engine-selection').textContent=item?(inspectionLoading?'正在检查当前选中壁纸…':inspectionState?inspectionState.label+(inspectionState.supported?'':'\n'+inspectionState.reason):'请选择壁纸'):'没有选中壁纸';for(const id of ['engine-import','engine-save'])$(id).disabled=processing||livePending||inspectionLoading||!item||!inspectionState?.supported;features?.syncImportButtons();};
 const selection=()=>{const projectToken=$('engine-library').value,item=engineItems.find(e=>e.token===projectToken),mode=['scene','web'].includes(item?.type)?$('engine-render-mode').value:'auto',key=projectToken+'|'+mode;if(!item){inspectionKey='';inspectionState=null;inspectionLoading=false;inspectionGeneration++;showInspection();return}if(key===inspectionKey&&(inspectionLoading||inspectionState)){showInspection();return}inspectionKey=key;inspectionState=null;inspectionLoading=true;const generation=++inspectionGeneration;showInspection();send({action:'engine-inspect',projectToken,renderMode:mode}).then(r=>{if(generation!==inspectionGeneration)return;inspectionState=r.inspection}).catch(error=>{if(generation!==inspectionGeneration)return;inspectionState={supported:false,label:'当前壁纸检查失败',reason:error.message}}).finally(()=>{if(generation!==inspectionGeneration)return;inspectionLoading=false;showInspection()})};
 $('engine-render-mode').onchange=selection;
 const renderEngine=()=>{if(features){features.engine(engineItems);return;}const q=$('engine-search').value.trim().toLowerCase();const items=engineItems.filter(e=>(e.title+' '+e.id).toLowerCase().includes(q));$('engine-library').replaceChildren(...items.map(e=>{const o=document.createElement('option');o.value=e.token;o.dataset.projectId=e.id;o.textContent=`[${({video:'视频',image:'图片',scene:'场景',web:'网页'})[e.type]||'暂不支持'}] ${e.title}`;o.title=e.location;o.disabled=!['video','image','scene','web'].includes(e.type);return o}));const first=items.find(e=>['video','image','scene','web'].includes(e.type));if(first)$('engine-library').value=first.token;selection()};
 const scan=()=>busy(async()=>{message('正在搜索素材…');const search={scope:$('engine-scope').value,folder:$('engine-folder').value.trim(),kind:$('engine-kind').value};const r=await send({action:'engine-list',...search});config.engineSearch=search;engineItems=r.wallpapers;renderEngine();$('engine-locations').textContent=[...r.roots,...r.warnings].join('\n')||'没有发现壁纸库，可改为自选文件夹。';picker.hidden=false;return {message:`找到 ${engineItems.length} 个${search.kind==='engine'?'壁纸项目':'图片/视频'}。${r.truncated?'已达到搜索上限，请缩小文件夹范围。':'可选择导入。'}`}});
 $('browse').onclick=()=>{picker.hidden=false;scan()};$('engine-scan').onclick=scan;
 $('engine-kind').value='engine';$('engine-scope').value='global';$('engine-folder').value=config.engineSearch?.folder||'';
 const scope=()=>{$('folder-options').hidden=$('engine-scope').value!=='folder'};scope();$('engine-scope').onchange=()=>{scope();if($('engine-scope').value==='global')scan()};
 const kind=()=>{const media=$('engine-kind').value==='media';$('engine-scope').querySelector('[value="global"]').disabled=media;if(media)$('engine-scope').value='folder';scope();engineItems=[];renderEngine()};$('engine-kind').onchange=kind;kind();
 $('choose-folder').onclick=()=>busy(async()=>{const r=await send({action:'engine-pick-folder'});if(r.folder)$('engine-folder').value=r.folder;return {message:r.cancelled?'已取消选择。':'文件夹已选择，点击“搜索壁纸”。'}});
 $('engine-library').onchange=selection;
 $('engine-search').oninput=renderEngine;
 const importSelected=apply=>{return busy(()=>{if(!$('engine-library').value)throw Error('请选择可导入的壁纸');message(apply?'正在导入并应用所选壁纸…':'正在保存到我的壁纸，当前背景保持不变…');const item=engineItems.find(e=>e.token===$('engine-library').value);return send({action:'wallpaper-engine',projectToken:$('engine-library').value,apply,renderMode:['scene','web'].includes(item?.type)?$('engine-render-mode').value:'auto',profile:chosenProfile()})},'壁纸导入失败',true);};
 $('engine-import').onclick=()=>importSelected(true);$('engine-save').onclick=()=>importSelected(false);
 $('file').onchange=()=>busy(async()=>{const f=$('file').files[0];if(!f)return {config};if(f.size>250*1024*1024)throw Error('文件超过250MB，请先压缩视频');const start=await send({action:'import-start',name:f.name,mime:f.type,size:f.size});for(let p=0;p<f.size;p+=2*1024*1024){if(importCancelled)throw Object.assign(Error('已取消上传'),{code:'IMPORT_CANCELLED'});const bytes=new Uint8Array(await f.slice(p,p+2*1024*1024).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));await send({action:'import-chunk',uploadId:start.uploadId,data:btoa(str)});message('正在导入 '+Math.min(100,Math.round((p+bytes.length)/f.size*100))+'%')}message('正在生成轻量副本，请稍候…');const result=await send({action:'import-end',uploadId:start.uploadId,profile:chosenProfile()});$('file').value='';return result},'壁纸导入失败',true);
 features=window.__cwbInstallFeatures?.(host,s,config,send,busy,{settle,message,notice,askChoice,chosenProfile,applyLive,deleteWallpaper,libraryGroups:groups,isBusy:()=>processing||livePending,isCancelled:()=>importCancelled});
 const libraryWrap=$('cwb-library-select-wrap'),savedPreview=$('cwb-saved-preview');
 const importEntry=document.createElement('div');importEntry.id='cwb-import-entry';importEntry.className='cwb-page-actions';importEntry.setAttribute('role','group');importEntry.setAttribute('aria-label','添加壁纸');
 browse.className='cwb-soft-btn';browse.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>浏览壁纸库</span>';browse.title='搜索 Wallpaper Engine 壁纸及本地图片、视频';
 $('import').innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>导入本地</span>';$('import').title='导入图片 / 视频';
 importEntry.append(browse,$('import'));
 (savedPreview||libraryWrap).after(importEntry);importEntry.after(picker);
 const displayOptions=$('cwb-display-options');if(displayOptions)quality.prepend(displayOptions);
 host.__cwbRenderConfig=render;windowChrome=window.__cwbInstallPanelWindow?.(host,s,dialog);
 const title=$('title');title.after(repair);
 render(config);
 let scanning=false;
 host.__cwbScanSurfaces=async()=>{
  if(scanning||disposed)return;
  scanning=true;
  const button=$('cwb-surface-scan'),output=$('cwb-surface-scan-result');
  const status=text=>{output.textContent=text;if(!disposed)notifyStatus(text);};
  button.disabled=true;button.textContent=scanLabel.textContent='正在扫描…';scanButton.setAttribute('aria-disabled','true');
  surfaceRepair.setAttribute('aria-busy','true');status('正在检查已打开的页面…');
  try{const result=await send({action:'surface-rescan'});status(result.message||'扫描完成。');}
  catch(error){status('扫描适配失败：'+error.message);}
  finally{scanning=false;button.disabled=false;button.textContent='执行扫描';scanLabel.textContent='扫描适配';scanButton.removeAttribute('aria-disabled');surfaceRepair.setAttribute('aria-busy','false');}
 };
 $('cwb-surface-scan').onclick=scanButton.onclick=host.__cwbScanSurfaces;
 placeScan();
 const updates=document.createElement('div');updates.id='cwb-update-options';updates.className='cwb-inset-group';updates.setAttribute('aria-labelledby','cwb-update-title');
 updates.innerHTML='<div class="cwb-setting-row"><span class="cwb-row-meta"><span id="cwb-update-title" class="cwb-row-title">版本与更新</span><span id="cwb-update-status" class="cwb-row-desc" role="status" aria-live="polite" aria-atomic="true">正在读取版本…</span></span><span class="cwb-row-ctrl cwb-ctrl-wrap"><button id="cwb-update-check" type="button" class="cwb-soft-btn">检查更新</button><button id="cwb-update-install" type="button" data-cwb-variant="primary" hidden>一键更新</button></span></div>';
 if(windowChrome?.placeUpdates)windowChrome.placeUpdates(updates);else $('status').before(updates);
 let updateBusy=false;
 const showUpdate=u=>{
  if(!u){$('cwb-update-status').textContent='版本服务没有返回状态，请重新检查。';$('cwb-update-check').disabled=false;return;}const working=['checking','downloading','installing'].includes(u.phase),installed=u.phase==='installed';
  $('cwb-update-status').textContent='当前版本 v'+u.currentVersion+' · '+(u.message||(u.available?'发现新版本 v'+u.latestVersion:'已是最新正式版本。'));
  $('cwb-update-install').hidden=!u.available||installed;$('cwb-update-install').disabled=working;$('cwb-update-check').disabled=working||installed;
  $('cwb-update-install').textContent=u.phase==='downloading'?'正在下载…':u.phase==='installing'?'正在安装…':'一键更新至 v'+u.latestVersion;
  $('toggle').textContent=u.available&&!installed?'壁纸 · 有更新':'壁纸';$('toggle').setAttribute('aria-label',u.available&&!installed?'打开壁纸设置，有新版本可更新':'打开壁纸设置');
  clearTimeout(updateTimer);if(working&&!disposed)updateTimer=setTimeout(()=>refreshUpdate('update-status'),u.phase==='checking'?700:2000);
 };
 const refreshUpdate=async(action='update-check',force=false)=>{
  if(disposed||updateBusy)return;updateBusy=true;$('cwb-update-check').disabled=true;
  try{const r=await send({action,force});if(!disposed)showUpdate(r.update);}
  catch(error){if(!disposed){$('cwb-update-status').textContent='更新检查失败：'+error.message;$('cwb-update-check').disabled=false;$('cwb-update-install').disabled=false;}}
  finally{updateBusy=false;}
 };
 $('cwb-update-check').onclick=()=>refreshUpdate('update-check',true);
 $('cwb-update-install').onclick=()=>{if(processing||livePending)return;void refreshUpdate('update-install');};
 const openPanel=$('toggle').onclick;$('toggle').onclick=()=>{openPanel();void refreshUpdate();};
 void refreshUpdate();
 scanShortcut=event=>{if(event.code==='KeyW'&&event.ctrlKey&&event.altKey&&event.shiftKey&&!event.metaKey&&!event.repeat&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();void host.__cwbScanSurfaces();}};
 window.addEventListener('keydown',scanShortcut,true);
 if(!config.library.length)for(const id of ['delete','apply','library'])$(id).disabled=true;
}
