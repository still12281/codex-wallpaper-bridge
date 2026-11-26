// Serialized into the client. macOS System Settings style desktop panel (prototype parity).
export function installPanelWindow(host,shadow,dialog){
 const $=id=>shadow.getElementById(id),positionKey='codex-wallpaper-panel-position-v1',sizeKey='codex-wallpaper-panel-size-v1';
 const style=document.createElement('style');style.textContent=`
 :host{font:13.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI","Microsoft YaHei UI",system-ui,sans-serif;--cwb-radius:7px;--cwb-control-height:30px}
 :host [hidden]{display:none!important}
 dialog,dialog *{box-sizing:border-box}
 .cwb-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
 dialog[aria-labelledby="title"]{position:fixed;padding:0;min-width:0;min-height:0;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:hidden;border:1px solid var(--cwb-border);border-radius:14px;background:var(--cwb-canvas);color:var(--cwb-ink);box-shadow:var(--cwb-shadow,0 24px 68px rgba(0,0,0,.28));container:cwb-dialog / inline-size}
 dialog[aria-labelledby="title"][open]{display:flex;flex-direction:column}
 dialog:not([aria-labelledby="title"]){max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;padding:22px;border:1px solid var(--cwb-border);border-radius:14px;background:var(--cwb-surface);color:var(--cwb-ink);box-shadow:var(--cwb-shadow,0 24px 68px rgba(0,0,0,.35))}
 dialog:not([aria-labelledby="title"]) h2{font-size:16px;font-weight:650;line-height:1.4;margin:0 0 10px}
 dialog:not([aria-labelledby="title"]) p{color:var(--cwb-muted);line-height:1.65;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}
 dialog:not([aria-labelledby="title"]) footer{margin-top:16px;padding-top:12px;border-top:1px solid var(--cwb-hairline);display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}

 /* macOS Titlebar */
 .cwb-titlebar{display:flex;align-items:center;flex:0 0 46px;gap:6px;padding:0 10px 0 16px;touch-action:none;user-select:none;background:var(--cwb-sidebar);border-bottom:1px solid var(--cwb-hairline);min-width:0}
 .cwb-app-badge{width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#4b8bff,#8e6dff);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;box-shadow:0 1px 3px rgba(0,0,0,.18)}
 .cwb-titlebar h2{font-size:13px;line-height:1.4;font-weight:600;letter-spacing:-.01em;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0}
 .cwb-titlebar button{position:static;float:none;min-height:28px;height:28px;padding:0 9px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--cwb-muted);font-size:12px;font-weight:500;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}
 .cwb-titlebar button *{pointer-events:none}
 .cwb-titlebar button:hover{background:var(--cwb-seg-bg);color:var(--cwb-ink)}
 .cwb-titlebar #panel-maximize,.cwb-titlebar #close{width:28px;padding:0}
 .cwb-titlebar #close:hover{background:var(--cwb-danger);color:#fff}
 .cwb-tb-sep{width:1px;height:16px;background:var(--cwb-hairline);margin:0 2px;flex-shrink:0}
 dialog[data-compact-title="true"] .cwb-tb-label{display:none}
 dialog[data-compact-title="true"] .cwb-titlebar #cwb-repair{padding:0 7px}

 /* Main Shell & Sidebar (exact prototype proportions) */
 .cwb-shell{flex:1;min-height:0;display:flex;flex-direction:row;min-width:0}
 .cwb-sidebar{width:176px;flex:0 0 176px;background:var(--cwb-sidebar);border-right:1px solid var(--cwb-hairline);padding:12px 10px;display:flex;flex-direction:column;gap:3px;overflow-y:auto}
 .cwb-nav-item{display:flex;align-items:center;justify-content:flex-start;gap:9px;width:100%;min-height:34px;padding:7px 10px;border:0;border-radius:8px;background:transparent;color:var(--cwb-ink);font-size:13px;font-weight:500;text-align:left;cursor:pointer;white-space:nowrap;transition:background-color 100ms,color 100ms}
 .cwb-nav-item *{pointer-events:none}
 .cwb-nav-item:hover{background:var(--cwb-seg-bg)}
 .cwb-nav-item.active{background:var(--cwb-accent);color:var(--cwb-on-accent);font-weight:600}
 .cwb-nav-item.active:hover{background:var(--cwb-accent-hover,var(--cwb-accent));color:var(--cwb-on-accent)}
 .cwb-nav-icon{width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;color:#fff}
 .cwb-nav-item.active .cwb-nav-icon{background:rgba(255,255,255,.22)!important;color:#fff}
 .cwb-nav-short{display:none}
 .cwb-sidebar-footer{margin-top:auto;padding-top:10px;border-top:1px solid var(--cwb-hairline);display:flex;flex-direction:column;gap:6px}
 .cwb-status-pill{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:7px;background:var(--cwb-seg-bg);font-size:11px;color:var(--cwb-muted);min-width:0}
 .cwb-status-dot{width:7px;height:7px;border-radius:999px;background:var(--cwb-success);flex:0 0 7px}
 :host dialog[aria-busy="true"] .cwb-status-dot{background:var(--cwb-accent)}
 .cwb-status-pill #status{margin:0;padding:0;border:0;background:transparent;font-size:11px;line-height:1.35;color:var(--cwb-muted);min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 :host dialog[aria-busy="true"] #status{color:var(--cwb-accent-text,var(--cwb-accent));white-space:normal}
 #import-cancel{min-height:26px;padding:3px 8px;font-size:11.5px;width:100%}

 /* Content Area */
 .cwb-window-body{container:cwb-panel / inline-size;flex:1;min-height:0;min-width:0;overflow:auto;padding:18px 20px 24px;scroll-padding:14px;overscroll-behavior:contain;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:var(--cwb-border) transparent}
 .cwb-page{display:block;min-width:0;width:100%}
 .cwb-page-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 14px;flex-wrap:wrap}
 .cwb-page-title{font-size:16px;font-weight:650;letter-spacing:-.015em;margin:0;color:var(--cwb-ink)}
 .cwb-page-actions{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
 :where(.cwb-window-body label,.cwb-window-body select,.cwb-window-body input,.cwb-window-body details,.cwb-window-body section,.cwb-window-body .cwb-preview){min-width:0;max-width:100%}
 .cwb-window-body :where(p,strong,summary,button,label){overflow-wrap:anywhere}
 .cwb-window-body p{margin:6px 0;font-size:12px;color:var(--cwb-muted);line-height:1.5;opacity:1}
 .cwb-section-stack{display:flex;flex-direction:column;gap:0}

 /* Base Controls (zero-specificity :where so component classes win cleanly) */
 :host :is(button,input,select){font-family:inherit}
 :where(dialog button){min-height:30px;padding:0 12px;border:1px solid var(--cwb-border);border-radius:7px;line-height:1.35;font-size:12.5px;font-weight:500;background:var(--cwb-surface);color:var(--cwb-ink);transition:background-color 110ms,border-color 110ms,color 110ms;white-space:nowrap;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px}
 :where(dialog button):not(:disabled):hover{background:var(--cwb-surface-hover)}
 :where(dialog button):not(:disabled):active{background:var(--cwb-raised)}
 :where(dialog button):disabled{opacity:.48;cursor:default}
 :host dialog[aria-busy="true"] :is(button,select):disabled{cursor:progress}
 :host dialog :is(button,input,select,summary,.cwb-titlebar):focus-visible{outline:2px solid var(--cwb-accent);outline-offset:2px}
 :where(dialog button)[data-cwb-variant="primary"]{background:var(--cwb-accent);color:var(--cwb-on-accent);border-color:transparent;font-weight:600}
 :where(dialog button)[data-cwb-variant="primary"]:not(:disabled):hover{background:var(--cwb-accent-hover,var(--cwb-accent))}
 :where(dialog button)[data-cwb-variant="danger"]{color:var(--cwb-danger);background:var(--cwb-surface);border-color:var(--cwb-hairline)}
 :where(dialog button)[data-cwb-variant="danger"]:not(:disabled):hover{background:var(--cwb-danger-bg);border-color:var(--cwb-danger)}
 .cwb-soft-btn{background:var(--cwb-seg-bg);border-color:transparent;color:var(--cwb-ink)}
 .cwb-soft-btn:not(:disabled):hover{background:var(--cwb-raised)}
 .cwb-icon-btn{width:30px;flex:0 0 30px;padding:0}
 :where(dialog select,dialog input:not([type=checkbox]):not([type=range]):not([type=file]):not([type=color])){min-height:30px;padding:4px 10px;border:1px solid var(--cwb-border);border-radius:7px;background:var(--cwb-field);color:var(--cwb-ink);font-size:12.5px;font-weight:500;line-height:1.4}
 :host option,:host optgroup{background:var(--cwb-field);color:var(--cwb-ink)}
 :where(dialog input[type=color]){min-height:28px;height:28px;width:44px;padding:2px;border:1px solid var(--cwb-border);border-radius:7px;background:var(--cwb-field);cursor:pointer}

 /* macOS Segmented Control */
 .cwb-seg{display:inline-flex;flex-wrap:wrap;padding:2px;border-radius:8px;background:var(--cwb-seg-bg);gap:2px;max-width:100%}
 .cwb-seg-btn{min-height:24px;height:24px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:var(--cwb-muted);font-size:12px;font-weight:500;white-space:nowrap}
 .cwb-seg-btn:hover:not(:disabled){background:transparent;color:var(--cwb-ink)}
 .cwb-seg-btn.active{background:var(--cwb-seg-active);color:var(--cwb-ink);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12)}

 /* macOS Toggle Switch */
 .cwb-window-body input[type=checkbox]:not(.cwb-card input):not(.cwb-rot-list input){-webkit-appearance:none;appearance:none;position:relative;width:38px;height:22px;border:0;border-radius:999px;background:var(--cwb-switch-off);cursor:pointer;flex:0 0 38px;margin:0;vertical-align:middle;transition:background-color 140ms}
 .cwb-window-body input[type=checkbox]:not(.cwb-card input):not(.cwb-rot-list input)::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.24);transition:transform 140ms}
 .cwb-window-body input[type=checkbox]:not(.cwb-card input):not(.cwb-rot-list input):checked{background:var(--cwb-accent)}
 .cwb-window-body input[type=checkbox]:not(.cwb-card input):not(.cwb-rot-list input):checked::after{transform:translateX(16px)}
 .cwb-window-body input[type=checkbox]:not(.cwb-card input):not(.cwb-rot-list input):disabled{opacity:.5;cursor:default}
 .cwb-card input[type=checkbox]{width:16px!important;height:16px;margin:0 6px 0 0!important;accent-color:var(--cwb-accent);vertical-align:middle;flex-shrink:0}

 /* macOS Fine-Track Range Slider (exact prototype compact inline width) */
 .cwb-slider-wrap{display:inline-flex;align-items:center;gap:10px;min-width:154px}
 .cwb-window-body input[type=range]{-webkit-appearance:none;appearance:none;width:120px;height:4px;margin:0;border-radius:999px;background:linear-gradient(to right,var(--cwb-accent) 0%,var(--cwb-accent) var(--cwb-range-pct,40%),var(--cwb-track) var(--cwb-range-pct,40%),var(--cwb-track) 100%);cursor:pointer;outline:none}
 .cwb-window-body input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:999px;background:#fff;border:.5px solid rgba(0,0,0,.16);box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}
 .cwb-window-body input[type=range]:disabled{opacity:.5;cursor:default}
 .cwb-slider-wrap output{font-size:12px;font-variant-numeric:tabular-nums;color:var(--cwb-muted);min-width:38px;text-align:right;flex:0 0 auto}

 /* Hero Preview Card (EXACT prototype) */
 .cwb-preview{margin:0 0 14px;border:1px solid var(--cwb-hairline);border-radius:12px;background:var(--cwb-surface);overflow:hidden}
 .cwb-hero{padding:0;background:#141824}
 .cwb-hero-visual{position:relative;width:100%;aspect-ratio:16/8.5;min-height:175px;max-height:210px;background:radial-gradient(circle at 25% 30%,rgba(90,145,255,.45),transparent 48%),radial-gradient(circle at 78% 70%,rgba(175,110,255,.38),transparent 50%),linear-gradient(135deg,#1d253f 0%,#352a5c 50%,#193148 100%);overflow:hidden;display:flex;align-items:center;justify-content:center}
 .cwb-hero-visual img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
 .cwb-hero-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,16,28,.04) 0%,rgba(12,16,28,.16) 50%,rgba(10,13,24,.84) 100%);pointer-events:none}
 .cwb-hero-badge{position:absolute;top:10px;left:10px;padding:3px 9px;border-radius:999px;background:rgba(15,18,28,.62);border:1px solid rgba(255,255,255,.16);color:#f4f7ff;font-size:11px;font-weight:500;line-height:1.35;z-index:2}
 .cwb-hero-badge[data-active="true"]::before{content:"";display:inline-block;width:6px;height:6px;border-radius:999px;background:var(--cwb-success);margin-right:6px;vertical-align:1px}
 .cwb-hero-footer{position:absolute;left:0;right:0;bottom:0;padding:12px 14px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;z-index:2}
 .cwb-hero-info{min-width:0;flex:1}
 #library-preview-name{font-size:15px;font-weight:650;color:#ffffff;margin:0;line-height:1.3;text-shadow:0 1px 4px rgba(0,0,0,.4)}
 #library-preview-mode{font-size:11.5px;color:rgba(255,255,255,.80);margin:2px 0 0;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .cwb-hero-actions{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto}
 .cwb-hero-actions #library-apply{height:30px;padding:0 12px;font-size:12.5px;border-radius:7px}
 .cwb-hero-actions #library-apply[data-applied="true"]{opacity:.88}
 .cwb-hero-actions #library-delete{width:30px;height:30px;padding:0;border-radius:7px;background:rgba(20,22,30,.55);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.88)}
 .cwb-hero-actions #library-delete:hover:not(:disabled){background:var(--cwb-danger);border-color:transparent;color:#fff}

 /* macOS Inset Grouped Cards & Rows (EXACT prototype) */
 .cwb-group-label{font-size:12px;font-weight:600;color:var(--cwb-muted);margin:16px 0 6px 4px;letter-spacing:.01em}
 .cwb-page>.cwb-group-label:first-child,.cwb-section-stack>.cwb-group-label:first-child,#cwb-saved-gallery-wrap>.cwb-group-label{margin-top:0}
 .cwb-inset-group{background:var(--cwb-surface);border:1px solid var(--cwb-hairline);border-radius:11px;overflow:hidden;margin:0 0 14px}
 .cwb-setting-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 14px;min-height:44px;margin:0;color:var(--cwb-ink)}
 .cwb-setting-row+.cwb-setting-row,.cwb-inline-note+.cwb-setting-row,.cwb-fx-children>.cwb-setting-row,.cwb-inset-group>.cwb-inline-note,.cwb-inset-group>.cwb-group-footer{border-top:1px solid var(--cwb-hairline)}
 .cwb-row-stack{flex-direction:column;align-items:stretch;gap:8px}
 .cwb-row-meta{min-width:120px;flex:1 1 0;display:flex;flex-direction:column}
 .cwb-row-stack>.cwb-row-meta{min-width:0;flex:0 0 auto}
 .cwb-row-title{font-size:13px;font-weight:500;line-height:1.35;color:var(--cwb-ink)}
 .cwb-row-desc{font-size:11.5px;color:var(--cwb-muted);margin-top:2px;line-height:1.4}
 .cwb-row-ctrl{flex:0 1 auto;min-width:0;max-width:62%;display:inline-flex;align-items:center;justify-content:flex-end;gap:8px}
 .cwb-row-ctrl>button{flex-shrink:0}
 .cwb-row-stack>.cwb-row-ctrl{flex:0 0 auto;width:100%;max-width:100%;justify-content:flex-start}
 .cwb-ctrl-wrap{flex-wrap:wrap}
 .cwb-row-ctrl select{min-width:110px;max-width:190px;flex:0 1 190px;text-overflow:ellipsis}
 .cwb-setting-row input[type=number],.cwb-setting-row input[type=text],#cwb-preset-name{width:110px;max-width:100%}
 .cwb-row-stack .cwb-row-ctrl select,.cwb-row-stack .cwb-row-ctrl input[type=text],.cwb-row-stack #cwb-preset-name{flex:1 1 160px;width:auto;min-width:120px;max-width:100%}
 .cwb-group-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:var(--cwb-canvas)}
 .cwb-inline-note{margin:0!important;padding:8px 14px;font-size:11.5px;color:var(--cwb-muted);background:var(--cwb-canvas)}
 .cwb-inline-note:empty{display:none}
 #cwb-visual{display:grid;grid-template-columns:minmax(0,1fr);gap:0}
 .cwb-rot-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
 .cwb-rot-actions{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px}
 #cwb-rotation-clear{min-height:26px;padding:0 10px;font-size:12px}
 .cwb-rot-list{display:flex;flex-direction:column;width:100%;max-height:176px;overflow-y:auto;border:1px solid var(--cwb-border);border-radius:8px;background:var(--cwb-field);scrollbar-width:thin;scrollbar-color:var(--cwb-border) transparent}
 .cwb-rot-item{display:flex;align-items:center;gap:8px;padding:7px 10px;margin:0;cursor:pointer;min-width:0;user-select:none;transition:background-color 90ms}
 .cwb-rot-item+.cwb-rot-item{border-top:1px solid var(--cwb-hairline)}
 .cwb-rot-item:hover{background:var(--cwb-surface-hover)}
 .cwb-rot-item:has(input:checked){background:var(--cwb-accent-soft)}
 .cwb-rot-list input[type=checkbox]{width:15px;height:15px;margin:0;accent-color:var(--cwb-accent);flex:0 0 15px;cursor:pointer}
 .cwb-rot-name{flex:1 1 0;min-width:0;font-size:12.5px;font-weight:500;color:var(--cwb-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .cwb-rot-mode{flex:0 0 auto;padding:1px 6px;border-radius:5px;background:var(--cwb-seg-bg);color:var(--cwb-muted);font-size:11px;line-height:1.45;white-space:nowrap}
 .cwb-rot-empty{margin:0!important;padding:12px 10px;text-align:center;font-size:12px;color:var(--cwb-muted)}

 /* Saved Wallpapers Visual Gallery (EXACT prototype) */
 #cwb-saved-gallery-wrap{margin:0 0 14px}
 .cwb-saved-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
 .cwb-saved-card{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:0;padding:0;min-height:0;border:1.5px solid var(--cwb-hairline);border-radius:10px;background:var(--cwb-surface);overflow:hidden;text-align:left;white-space:normal}
 .cwb-saved-card:hover:not(:disabled){border-color:var(--cwb-border);background:var(--cwb-surface)}
 .cwb-saved-card.is-selected{border-color:var(--cwb-accent);box-shadow:0 0 0 2px var(--cwb-accent-soft)}
 .cwb-saved-thumb{position:relative;width:100%;aspect-ratio:16/10;background:linear-gradient(135deg,#25304d,#3a305f);overflow:hidden}
 .cwb-saved-thumb img{width:100%;height:100%;object-fit:cover;display:block}
 .cwb-saved-active{position:absolute;top:6px;left:6px;padding:2px 6px;border-radius:999px;background:var(--cwb-accent);color:#fff;font-size:10px;font-weight:600;line-height:1.4}
 .cwb-saved-tag{position:absolute;bottom:6px;right:6px;padding:2px 6px;border-radius:5px;background:rgba(0,0,0,.58);color:#fff;font-size:10px;font-weight:500;line-height:1.4}
 .cwb-saved-info{padding:7px 9px 8px;display:flex;flex-direction:column;gap:2px}
 .cwb-saved-name{font-size:12px;font-weight:600;color:var(--cwb-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .cwb-saved-sub{font-size:10.5px;color:var(--cwb-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

 /* Display Tier Cards (EXACT prototype) */
 .cwb-tier-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;padding:12px 14px}
 .cwb-tier-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;min-height:50px;padding:8px 4px;border-radius:9px;border:1.5px solid var(--cwb-hairline);background:var(--cwb-canvas);text-align:center;overflow:hidden}
 .cwb-tier-card:hover:not(:disabled){background:var(--cwb-surface-hover)}
 .cwb-tier-card.active{border-color:var(--cwb-accent);background:var(--cwb-accent-soft)}
 .cwb-tier-name{font-size:12.5px;font-weight:600;color:var(--cwb-ink);max-width:100%;overflow:hidden;text-overflow:ellipsis}
 .cwb-tier-spec{font-size:10.5px;color:var(--cwb-muted);font-variant-numeric:tabular-nums;max-width:100%;overflow:hidden;text-overflow:ellipsis}

 /* Disclosure Cards (only for Author Properties & Custom Specs) */
 details.cwb-feature{margin:0 0 14px;padding:0;border:1px solid var(--cwb-hairline);border-radius:11px;background:var(--cwb-surface);overflow:hidden}
 details.cwb-feature>summary{padding:11px 14px;font-size:13px;line-height:1.45;font-weight:600;cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between}
 details.cwb-feature>summary::-webkit-details-marker{display:none}
 details.cwb-feature>summary::after{content:"›";font-size:16px;font-weight:500;color:var(--cwb-muted);transition:transform 120ms}
 details.cwb-feature[open]>summary{border-bottom:1px solid var(--cwb-hairline)}
 details.cwb-feature[open]>summary::after{transform:rotate(90deg)}
 details.cwb-feature>:not(summary){margin:12px 14px}
 details.cwb-feature .cwb-inset-group{margin:0;border:0;border-radius:0}
 #cwb-author-fields{display:flex;flex-direction:column;background:var(--cwb-canvas);border:1px solid var(--cwb-hairline);border-radius:9px;overflow:hidden}
 #cwb-author-fields:empty{display:none}
 #cwb-author-fields>label{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;font-size:12.5px;font-weight:500;margin:0}
 #cwb-author-fields>label+label,#cwb-author-fields>p+label,#cwb-author-fields>label+p{border-top:1px solid var(--cwb-hairline)}
 #cwb-author-fields>p{margin:0;padding:8px 12px}
 #cwb-author-fields>label :is(select,input:not([type=checkbox]):not([type=color])){min-width:110px;max-width:56%}

 /* Wallpaper Engine Library Browser */
 #engine-library{display:none}
 .cwb-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 .cwb-row>*{flex:1 1 130px;min-width:0}
 #engine-picker{margin:12px 0;padding:14px;border:1px solid var(--cwb-hairline);border-radius:12px;background:var(--cwb-surface);display:flex;flex-direction:column;gap:10px}
 .cwb-picker-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:8px;border-bottom:1px solid var(--cwb-hairline)}
 .cwb-picker-head strong{font-size:13.5px;font-weight:650}
 #engine-picker>label,#engine-picker #folder-options>label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:var(--cwb-muted);margin:0}
 #engine-picker :is(select,input:not([type=checkbox])){width:100%}
 #engine-scan,#choose-folder,#engine{width:100%;min-height:34px}
 #engine-roots{border:1px solid var(--cwb-hairline);border-radius:9px;background:var(--cwb-canvas);padding:8px 12px}
 #engine-locations,#engine-selection{font-size:11.5px;white-space:pre-line;overflow-wrap:anywhere}
 #cwb-import-preview{padding:12px;display:flex;flex-direction:column;gap:10px;margin:0;background:var(--cwb-canvas)}
 #cwb-import-preview>:is(p,label,div){margin:0}
 #cwb-import-preview .cwb-preview-head{display:flex;align-items:center;gap:12px}
 #cwb-import-preview .cwb-preview-head img{width:64px;height:44px;object-fit:cover;border-radius:7px;flex:0 0 64px;background:var(--cwb-raised)}
 #cwb-import-preview .cwb-preview-head strong{font-size:13.5px;font-weight:650;min-width:0;flex:1}
 #cwb-selected-import-state{color:var(--cwb-accent-text,var(--cwb-accent));font-size:12px;font-weight:550}
 #cwb-import-preview>label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600}
 #engine-import-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
 #cwb-import-preview>.cwb-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding-top:10px;border-top:1px solid var(--cwb-hairline)}
 #cwb-batch-status{grid-column:1/-1;font-size:12px;font-weight:500;color:var(--cwb-muted);line-height:1.5}
 #cwb-import-preview button{min-height:34px}
 .cwb-library-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:end;padding:10px;border:1px solid var(--cwb-hairline);border-radius:10px;background:var(--cwb-canvas)}
 .cwb-library-filters>label{display:flex;flex-direction:column;gap:5px;margin:0;font-size:11.5px;font-weight:600;color:var(--cwb-muted)}
 .cwb-library-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:4px 0}
 .cwb-card{display:flex;flex-direction:column;min-width:0;border:1px solid var(--cwb-hairline);border-radius:10px;background:var(--cwb-surface);overflow:hidden}
 .cwb-card:has(button[aria-pressed="true"]){border-color:var(--cwb-accent)}
 .cwb-card button{width:100%;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:0;padding:0;border:0;border-radius:0;background:transparent;min-height:0;text-align:left;line-height:1.45;white-space:normal}
 .cwb-card button:not(:disabled):hover{background:var(--cwb-surface-hover)}
 .cwb-card button[aria-pressed="true"]{outline:2px solid var(--cwb-accent);outline-offset:-2px}
 .cwb-card img{width:100%;aspect-ratio:16/10;object-fit:cover;background:var(--cwb-raised);display:block}
 .cwb-card span{display:block}
 .cwb-card button>span:not(.cwb-badge):not(.cwb-import-state){padding:7px 9px 3px;font-size:12px;font-weight:600;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
 .cwb-card .cwb-badge{padding:0 9px 3px;font-size:11px;color:var(--cwb-muted)}
 .cwb-card .cwb-import-state{padding:0 9px 8px;font-size:11px;font-weight:500;color:var(--cwb-accent-text,var(--cwb-accent))}
 .cwb-card label,#engine-picker .cwb-card label{display:flex;flex-direction:row;align-items:center;gap:4px;margin-top:auto;min-height:32px;padding:6px 9px;background:var(--cwb-canvas);border-top:1px solid var(--cwb-hairline);font-size:11.5px;font-weight:400;color:var(--cwb-muted)}
 .cwb-pagination{justify-content:space-between;margin:4px 0}
 .cwb-pagination>*{flex:0 1 auto}
 .cwb-pagination #cwb-page{min-width:60px;text-align:center;font-size:12px;color:var(--cwb-muted);font-variant-numeric:tabular-nums}

 /* Floating macOS Toast */
 .cwb-toast{position:absolute;bottom:14px;right:14px;max-width:min(320px,calc(100% - 28px));padding:8px 12px;border-radius:9px;background:var(--cwb-ink);color:var(--cwb-surface);font-size:12px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.28);opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity 150ms,transform 150ms;z-index:30}
 .cwb-toast.show{opacity:1;transform:translateY(0)}

 /* 8-edge resize grips */
 .cwb-resize{position:absolute;touch-action:none;z-index:8}
 dialog[data-maximized="true"] .cwb-resize{display:none}

 /* Responsive Breakpoints: <620px uses clean top 5-icon bar (exact prototype!) */
 @container cwb-dialog (max-width:619px){
  .cwb-shell{flex-direction:column}
  .cwb-sidebar{width:100%;flex:0 0 auto;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-right:0;border-bottom:1px solid var(--cwb-hairline);padding:6px 8px;gap:4px;overflow:hidden}
  .cwb-sidebar-footer{display:none}
  .cwb-nav-item{flex-direction:column;justify-content:center;gap:3px;min-height:46px;padding:6px 2px;font-size:11px;text-align:center}
  .cwb-nav-full{display:none}
  .cwb-nav-short{display:inline}
  .cwb-nav-icon{width:20px;height:20px;flex:0 0 20px;border-radius:5px}
  .cwb-window-body{padding:14px 14px 20px}
  .cwb-titlebar{padding:0 8px 0 12px}
 }
 @container cwb-panel (max-width:620px){
  .cwb-tier-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
 }
 @container cwb-panel (max-width:400px){
  .cwb-library-grid,.cwb-saved-gallery{grid-template-columns:repeat(2,minmax(0,1fr))}
  .cwb-setting-row,.cwb-group-footer{flex-direction:column;align-items:stretch;gap:8px}
  .cwb-row-meta{min-width:0;flex:0 0 auto}
  .cwb-row-ctrl,.cwb-slider-wrap{justify-content:flex-end;width:100%;max-width:100%}
  .cwb-row-stack>.cwb-row-ctrl{justify-content:flex-start}
  .cwb-row-ctrl select{max-width:100%;flex:1 1 auto}
  .cwb-window-body input[type=range]{flex:1;width:auto}
  .cwb-hero-footer{flex-direction:column;align-items:stretch;gap:8px}
  .cwb-hero-actions{justify-content:flex-end}
  .cwb-tier-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 }
 @container cwb-panel (max-width:360px){
  #engine-import-actions,#cwb-import-preview>.cwb-row,.cwb-library-filters{grid-template-columns:minmax(0,1fr)}
 }
 @media(prefers-reduced-motion:reduce){:host *{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
 @media(forced-colors:active){:host button{border:1px solid ButtonText}:host :is(button,input,select,summary):focus-visible{outline-color:Highlight}}
 `;shadow.append(style);

 for(const id of ['library-apply','engine-import','cwb-display-apply','cwb-renderer-apply','apply','cwb-quality-save','cwb-choice-confirm','realtime-accept'])if($(id))$(id).dataset.cwbVariant='primary';
 for(const id of ['library-delete','delete','cwb-preset-delete'])if($(id))$(id).dataset.cwbVariant='danger';

 let maximized=false,restoreRect=null,dragging=null,sizing=null,toastTimer=null;
 const titlebar=document.createElement('header');titlebar.className='cwb-titlebar';titlebar.tabIndex=0;titlebar.title='拖动移动；双击最大化；方向键移动，Shift+方向键缩放';
 const appBadge=document.createElement('span');appBadge.className='cwb-app-badge';appBadge.setAttribute('aria-hidden','true');appBadge.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5a2 2 0 0 0-2.8 0L6 18"/></svg>';
 const tbSep=document.createElement('span');tbSep.className='cwb-tb-sep';tbSep.setAttribute('aria-hidden','true');
 const maximize=document.createElement('button');maximize.id='panel-maximize';maximize.type='button';maximize.setAttribute('aria-label','最大化');maximize.title='最大化';maximize.innerHTML='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';

 const syncCompactTitle=w=>{
  const compact=w<520;
  dialog.dataset.compactTitle=String(compact);
  const scan=shadow.getElementById('cwb-quick-scan');
  if(scan)scan.dataset.compact=String(compact);
 };
 const save=()=>{if(maximized)return;const r=dialog.getBoundingClientRect();try{localStorage.setItem(positionKey,JSON.stringify({x:r.left,y:r.top}));localStorage.setItem(sizeKey,JSON.stringify({width:r.width,height:r.height}));}catch{}};
 const bounds=(x,y,width,height,persist=false)=>{const maxW=Math.max(1,innerWidth-16),maxH=Math.max(1,innerHeight-16),w=Math.min(maxW,Math.max(Math.min(360,maxW),width)),h=Math.min(maxH,Math.max(Math.min(280,maxH),height));dialog.style.width=w+'px';dialog.style.height=h+'px';dialog.style.inset='auto';dialog.style.position='fixed';dialog.style.margin='0';dialog.style.left=Math.max(8,Math.min(x,innerWidth-w-8))+'px';dialog.style.top=Math.max(8,Math.min(y,innerHeight-h-8))+'px';syncCompactTitle(w);if(persist&&dialog.open)save();};
 const place=(x,y,persist=false)=>{const r=dialog.getBoundingClientRect();bounds(x,y,r.width,r.height,persist);};
 const size=(width,height,persist=false)=>{if(!Number.isFinite(width)||!Number.isFinite(height))return;const r=dialog.getBoundingClientRect();bounds(r.left||24,r.top||24,width,height,persist);};
 const restore=()=>{if(maximized){bounds(8,8,innerWidth-16,innerHeight-16);return;}let savedSize={width:700,height:580},position={x:Math.max(8,(innerWidth-700)/2),y:Math.max(8,(innerHeight-580)/2)};try{savedSize=JSON.parse(localStorage.getItem(sizeKey))||savedSize;position=JSON.parse(localStorage.getItem(positionKey))||position;}catch{}bounds(position.x,position.y,savedSize.width,savedSize.height);};
 const toggle=()=>{if(!maximized){const r=dialog.getBoundingClientRect();restoreRect={x:r.left,y:r.top,width:r.width,height:r.height};maximized=true;bounds(8,8,innerWidth-16,innerHeight-16);}else{maximized=false;const r=restoreRect||{x:24,y:24,width:700,height:580};bounds(r.x,r.y,r.width,r.height,true);}dialog.dataset.maximized=String(maximized);maximize.setAttribute('aria-label',maximized?'还原':'最大化');maximize.title=maximized?'还原':'最大化';};maximize.onclick=toggle;
 titlebar.ondblclick=e=>{if(!e.target.closest('button'))toggle();};
 titlebar.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;if(maximized)toggle();const r=dialog.getBoundingClientRect();dragging={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};titlebar.setPointerCapture(e.pointerId);e.preventDefault();};
 titlebar.onpointermove=e=>{if(dragging?.id===e.pointerId)place(dragging.left+e.clientX-dragging.x,dragging.top+e.clientY-dragging.y);};
 const finishDrag=e=>{if(dragging?.id===e.pointerId){dragging=null;save();}};titlebar.onpointerup=finishDrag;titlebar.onpointercancel=finishDrag;
 titlebar.onkeydown=e=>{const delta={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[e.key];if(!delta||e.target.closest('button'))return;e.preventDefault();if(maximized)toggle();const r=dialog.getBoundingClientRect();if(e.shiftKey)size(r.width+delta[0],r.height+delta[1],true);else place(r.left+delta[0],r.top+delta[1],true);};

 // Build macOS 5-tab layout (EXACT prototype tab names & icons)
 const rawNodes=[...dialog.children];
 const shell=document.createElement('div');shell.className='cwb-shell';
 const sidebar=document.createElement('nav');sidebar.className='cwb-sidebar';sidebar.setAttribute('role','tablist');sidebar.setAttribute('aria-label','设置分类');
 const body=document.createElement('div');body.className='cwb-window-body';
 shell.append(sidebar,body);
 const toastEl=document.createElement('div');toastEl.className='cwb-toast';toastEl.setAttribute('aria-live','polite');
 const toast=msg=>{if(!dialog.open||!msg||msg==='就绪')return;toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),2600);};

 const tabSpecs=[
  ['wallpapers','我的壁纸','壁纸','linear-gradient(135deg,#3b82f6,#6366f1)','<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="m21 15-5-5L5 21"/></svg>'],
  ['appearance','外观与遮罩','外观','linear-gradient(135deg,#a855f7,#ec4899)','<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/></svg>'],
  ['playback','画质与播放','画质','linear-gradient(135deg,#10b981,#06b6d4)','<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="6 4 20 12 6 20 6 4"/></svg>'],
  ['effects','特效与联动','特效','linear-gradient(135deg,#f59e0b,#ef4444)','<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></svg>'],
  ['advanced','适配与管理','管理','linear-gradient(135deg,#64748b,#475569)','<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'],
 ];
 const pages=new Map(),navButtons=new Map();
 let activeTab='wallpapers';
 const activateTab=tabId=>{
  if(!pages.has(tabId))return;
  activeTab=tabId;
  for(const [id,btn]of navButtons){const on=id===tabId;btn.classList.toggle('active',on);btn.setAttribute('aria-selected',String(on));}
  for(const [id,page]of pages)page.hidden=id!==tabId;
  body.scrollTop=0;
  window.__cwbMediaActivity?.report();
 };
 for(const [id,full,short,bg,svg]of tabSpecs){
  const btn=document.createElement('button');btn.type='button';btn.className='cwb-nav-item';btn.id='cwb-tab-'+id;btn.dataset.cwbTab=id;btn.setAttribute('role','tab');btn.setAttribute('aria-selected','false');
  btn.innerHTML=`<span class="cwb-nav-icon" style="background:${bg}">${svg}</span><span class="cwb-nav-full">${full}</span><span class="cwb-nav-short">${short}</span>`;
  btn.onclick=()=>activateTab(id);
  sidebar.append(btn);navButtons.set(id,btn);
  const page=document.createElement('section');page.className='cwb-page';page.dataset.cwbPage=id;page.setAttribute('role','tabpanel');page.hidden=id!=='wallpapers';
  const hdr=document.createElement('div');hdr.className='cwb-page-header';
  const h=document.createElement('h3');h.className='cwb-page-title';h.textContent=full;hdr.append(h);
  page.append(hdr);body.append(page);pages.set(id,page);
 }

 const staging=document.createDocumentFragment();
 for(const child of rawNodes)staging.append(child);
 const titleEl=staging.querySelector('#title'),closeEl=staging.querySelector('#close');
 titlebar.append(appBadge,titleEl,tbSep,maximize,closeEl);
 dialog.append(titlebar,shell,toastEl);

 const homePage=pages.get('wallpapers'),appPage=pages.get('appearance'),playPage=pages.get('playback'),fxPage=pages.get('effects'),advPage=pages.get('advanced');
 const move=(target,node)=>{if(node&&target)target.append(node);};
 const addCap=(target,text)=>{const p=document.createElement('p');p.className='cwb-group-label';p.textContent=text;target.append(p);};

 // Tab 1: 我的壁纸 (EXACT prototype: Header + Import Buttons -> Hero -> Quick Group -> Visual Gallery -> Picker)
 const libWrap=staging.querySelector('#cwb-library-select-wrap');
 if(libWrap){libWrap.hidden=true;homePage.append(libWrap);}
 move(homePage.querySelector('.cwb-page-header'),staging.querySelector('#cwb-import-entry'));
 move(homePage,staging.querySelector('#cwb-saved-preview'));
 const quickGroup=document.createElement('div');quickGroup.className='cwb-inset-group';
 const shadeRow=staging.querySelector('#cwb-shade-row'),pauseRow=staging.querySelector('#cwb-pause-row');
 if(shadeRow)shadeRow.classList.add('cwb-setting-row');
 if(pauseRow)pauseRow.classList.add('cwb-setting-row');
 move(quickGroup,shadeRow);move(quickGroup,pauseRow);
 if(quickGroup.children.length)homePage.append(quickGroup);
 move(homePage,staging.querySelector('#cwb-saved-gallery-wrap'));
 move(homePage,staging.querySelector('#engine-picker'));

 // Tab 2: 外观与遮罩
 move(appPage,staging.querySelector('#cwb-visual-options'));

 // Tab 3: 画质与播放
 move(playPage,staging.querySelector('#cwb-playback-options'));

 // Tab 4: 特效与联动 (Music + Cursor FX + Rotation + Author Properties, EXACT prototype!)
 const mediaEl=staging.querySelector('#cwb-media-options');
 if(mediaEl){addCap(fxPage,'系统音乐与音频响应');move(fxPage,mediaEl);}
 move(fxPage,staging.querySelector('#cwb-fx-section'));
 const rotEl=staging.querySelector('#cwb-rotation-options');
 if(rotEl){addCap(fxPage,'壁纸轮播');move(fxPage,rotEl);}
 const authEl=staging.querySelector('#cwb-author-properties');
 if(authEl){addCap(fxPage,'当前壁纸作者属性');move(fxPage,authEl);}

 // Tab 5: 适配与管理 (Surfaces + Presets + Management/Reset + Updates, EXACT prototype!)
 const surfEl=staging.querySelector('#surface-options');
 if(surfEl){addCap(advPage,'页面适配与原生底色');move(advPage,surfEl);}
 const presetEl=staging.querySelector('#cwb-preset-options');
 if(presetEl){addCap(advPage,'外观预设');move(advPage,presetEl);}
 const mgmtEl=staging.querySelector('#cwb-management-group');
 const reset=document.createElement('button');reset.id='panel-reset-size';reset.type='button';reset.className='cwb-soft-btn';reset.textContent='重置窗口';reset.onclick=()=>{if(maximized)toggle();bounds(24,24,700,580,true);toast('已重置为默认尺寸 700 × 580');};
 const resetRow=document.createElement('div');resetRow.className='cwb-setting-row';resetRow.innerHTML='<span class="cwb-row-meta"><span class="cwb-row-title">重置面板窗口位置与尺寸</span></span><span class="cwb-row-ctrl"></span>';
 resetRow.querySelector('.cwb-row-ctrl').append(reset);
 if(mgmtEl){addCap(advPage,'维护与管理');mgmtEl.append(resetRow);move(advPage,mgmtEl);}
 else{const g=document.createElement('div');g.className='cwb-inset-group';g.append(resetRow);advPage.append(g);}

 // Sidebar footer status pill (EXACT prototype!)
 const sidebarFooter=document.createElement('div');sidebarFooter.className='cwb-sidebar-footer';
 const statusPill=document.createElement('div');statusPill.className='cwb-status-pill';
 const statusDot=document.createElement('span');statusDot.className='cwb-status-dot';statusDot.setAttribute('aria-hidden','true');
 const statusEl=staging.querySelector('#status'),cancelEl=staging.querySelector('#import-cancel'),footerEl=staging.querySelector('footer'),fileEl=staging.querySelector('#file');
 statusPill.append(statusDot);move(statusPill,statusEl);
 sidebarFooter.append(statusPill);move(sidebarFooter,cancelEl);
 sidebar.append(sidebarFooter);
 if(footerEl){footerEl.hidden=true;dialog.append(footerEl);}
 if(fileEl)dialog.append(fileEl);
 for(const leftover of [...staging.children])advPage.append(leftover);

 // Hide empty tabs gracefully in minimal entry fixture
 for(const [id,page]of pages){const contentCount=[...page.children].filter(el=>!el.classList.contains('cwb-page-header')&&!el.hidden).length;if(!contentCount&&id!=='wallpapers')navButtons.get(id).hidden=true;}
 activateTab('wallpapers');

 // Auto-switch tab when a nested details or section container has .open = true set programmatically
 const detailsOpenDesc=Object.getOwnPropertyDescriptor(HTMLDetailsElement.prototype,'open');
 const bindAutoTab=el=>{
  if(!el||el.__cwbTabBound)return;
  el.__cwbTabBound=true;
  if(el.tagName==='DETAILS'&&detailsOpenDesc){
   Object.defineProperty(el,'open',{configurable:true,get(){return detailsOpenDesc.get.call(this);},set(value){detailsOpenDesc.set.call(this,value);if(value){const owner=this.closest('.cwb-page');if(owner&&owner.dataset.cwbPage!==activeTab)activateTab(owner.dataset.cwbPage);}}});
  }else{
   Object.defineProperty(el,'open',{configurable:true,get(){const owner=this.closest('.cwb-page');return !!owner&&!owner.hidden;},set(value){if(value){const owner=this.closest('.cwb-page');if(owner&&owner.dataset.cwbPage!==activeTab)activateTab(owner.dataset.cwbPage);}}});
  }
 };
 for(const detailsEl of body.querySelectorAll('details'))bindAutoTab(detailsEl);
 for(const id of ['surface-options','cwb-playback-options','cwb-visual-options','cwb-media-options','cwb-rotation-options','cwb-preset-options'])bindAutoTab($(id));

 // 8-edge resize grips (100% preserved)
 for(const edge of ['n','ne','e','se','s','sw','w','nw']){
  const grip=document.createElement('div');grip.className='cwb-resize';grip.dataset.resizeEdge=edge;const corner=edge.length===2;
  grip.style.cursor=edge==='n'||edge==='s'?'ns-resize':edge==='e'||edge==='w'?'ew-resize':edge==='ne'||edge==='sw'?'nesw-resize':'nwse-resize';
  if(corner){grip.style.width=grip.style.height='14px';grip.style[edge.includes('n')?'top':'bottom']='0';grip.style[edge.includes('w')?'left':'right']='0';}
  else if(edge==='n'||edge==='s'){grip.style.height='6px';grip.style.left=grip.style.right='14px';grip.style[edge.includes('n')?'top':'bottom']='0';}
  else{grip.style.width='6px';grip.style.top=grip.style.bottom='14px';grip.style[edge.includes('w')?'left':'right']='0';}dialog.append(grip);
  grip.onpointerdown=e=>{if(e.button!==0||maximized)return;const r=dialog.getBoundingClientRect();sizing={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,width:r.width,height:r.height};grip.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();};
  grip.onpointermove=e=>{if(sizing?.id!==e.pointerId)return;const r=sizing,dx=e.clientX-r.x,dy=e.clientY-r.y,minW=Math.min(360,innerWidth-16),minH=Math.min(280,innerHeight-16);let x=r.left,y=r.top,w=r.width,h=r.height;if(edge.includes('e'))w+=dx;if(edge.includes('s'))h+=dy;if(edge.includes('w')){w=Math.max(minW,r.width-dx);x=r.left+r.width-w;}if(edge.includes('n')){h=Math.max(minH,r.height-dy);y=r.top+r.height-h;}bounds(x,y,w,h);};
  const finish=e=>{if(sizing?.id===e.pointerId){sizing=null;save();}};grip.onpointerup=finish;grip.onpointercancel=finish;
 }

 const placeUpdates=updatesEl=>{if(!updatesEl)return;addCap(advPage,'版本与更新');advPage.append(updatesEl);navButtons.get('advanced').hidden=false;};
 const onResize=()=>restore();restore();addEventListener('resize',onResize);const oldDispose=host.__cwbDispose;host.__cwbDispose=()=>{oldDispose?.();clearTimeout(toastTimer);removeEventListener('resize',onResize);};host.__cwbSetPanelSize=(w,h)=>size(w,h,true);
 return {place,size,restore,activateTab,placeUpdates,toast};
}
