// Generated shell only. Never connects to the installed Codex client.
import {mkdtemp,writeFile,access,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {installPanel} from '../src/wallpaper-panel.mjs';
import {installPanelWindow} from '../src/panel-window.mjs';
import {libraryGroups} from '../src/library-model.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const end=Date.now()+5000;while(Date.now()<end){const value=await fn().catch(()=>false);if(value)return value;await sleep(30);}throw Error('Panel entry fixture timed out');}
let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME;
for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){
 if(chrome)break;
 for(const relative of ['Google/Chrome/Application/chrome.exe','Microsoft/Edge/Application/msedge.exe']){const candidate=path.join(base,relative);try{await access(candidate);chrome=candidate;break;}catch{}}
}
if(!chrome)throw Error('Isolated Chrome/Edge is required');
const scratch=process.env.CODEX_WALLPAPER_TEST_SCRATCH||os.tmpdir();await mkdir(scratch,{recursive:true});
const root=await mkdtemp(path.join(scratch,'cwb-panel-entry-'));
const html=path.join(root,'fixture.html');
await writeFile(html,'<!doctype html><style>body{margin:0}#native-bar{display:flex;height:36px;align-items:center}#native-bar>[role=menubar]{display:flex;height:24px;align-items:center}#background{position:fixed;inset:36px 0 0;z-index:-1;background:#345}</style><div id="native-bar" class="_ApplicationMenuTopBar_old"><div role="menubar"><button role="menuitem">Generated File</button></div></div><div id="background"></div><input id="native-input" value="generated draft">');
const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
let browser,c;
try{
 browser=spawn(chrome,['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking','--window-size=1000,800','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(root,'profile'),pathToFileURL(html).href],{windowsHide:true,stdio:'ignore'});
 const target=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===pathToFileURL(html).href));
 c=await connectCdp(target.webSocketDebuggerUrl);
 await until(()=>c.evaluate('document.readyState==="complete"&&!!document.getElementById("native-input")&&!!document.querySelector("[role=menubar]")'));
 await c.evaluate('window.__cwbLibraryGroups='+libraryGroups.toString()+';window.__cwbInstallPanelWindow='+installPanelWindow.toString()+';window.__fixtureConfig={library:[],selectedId:null,darkOverlay:.55,pauseOnBlur:true,visual:{theme:"dark"}};window.__codexWallpaperSend=raw=>{const message=JSON.parse(raw);window.__fixtureAction=message.action;if(message.action==="appearance")Object.assign(window.__fixtureConfig,{darkOverlay:message.darkOverlay,pauseOnBlur:message.pauseOnBlur});queueMicrotask(()=>window.__cwbReply(message.id,{ok:true,config:window.__fixtureConfig}));};('+installPanel.toString()+')(window.__fixtureConfig,"fixture-token");true');
 const state=()=>c.evaluate('(()=>{const h=window.__cwbPanelHost,r=h.shadowRoot.getElementById("toggle").getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {...h.__cwbEntryState(),parent:h.parentElement.id,count:document.querySelectorAll("#codex-wallpaper-controls").length,x:r.x+r.width/2,y:r.y+r.height/2,hit:hit===h,hitTag:hit?.tagName,hitId:hit?.id,rect:{x:r.x,y:r.y,width:r.width,height:r.height},menuCount:document.querySelectorAll("[role=menubar]").length,readyState:document.readyState,viewport:{width:innerWidth,height:innerHeight}}})()');
 const assertVisible=async placement=>{let last;try{const value=await until(async()=>{last=await state();return last.visible&&last.hit&&last.placement===placement&&last;});assert.equal(value.count,1);return value;}catch(error){throw Error(error.message+'; expected='+placement+'; observed='+JSON.stringify(last));}};
 await assertVisible('menu');
 await c.evaluate('document.getElementById("native-bar").className="ApplicationMenuTopBar-current";true');
 await assertVisible('menu');
 await c.evaluate('document.querySelector("[role=menuitem]").id="application-menu-trigger-file-menu";document.getElementById("native-bar").className="NewNativeToolbar";window.__cwbPanelHost.__cwbPlace();true');
 await assertVisible('menu'); // Semantic native trigger survives a full class rename.
 await c.evaluate('document.getElementById("native-bar").remove();true');
 const fallback=await assertVisible('fallback');
 for(const type of ['mousePressed','mouseReleased'])await c.call('Input.dispatchMouseEvent',{type,x:fallback.x,y:fallback.y,button:'left',clickCount:1});
 assert.equal(await c.evaluate('window.__cwbPanelHost.shadowRoot.querySelector("dialog").open'),true);
 await c.evaluate('(()=>{const s=window.__cwbPanelHost.shadowRoot;s.getElementById("shade").value="65";s.getElementById("shade").dispatchEvent(new Event("change"));return true})()');
 await until(()=>c.evaluate('window.__fixtureAction==="appearance"&&window.__fixtureConfig.darkOverlay===.65&&!window.__cwbPanelHost.shadowRoot.querySelector("dialog").getAttribute("aria-busy").includes("true")'));
 await c.evaluate('window.__cwbPanelHost.shadowRoot.getElementById("done").click();true');
 assert.equal(await c.evaluate('window.__cwbPanelHost.shadowRoot.querySelector("dialog").open'),false);
 await c.evaluate('document.body.insertAdjacentHTML("afterbegin",\'<div id="native-bar" class="ApplicationMenuTopBar-new" style="display:flex;height:36px;align-items:center"><div role="menubar"><button id="application-menu-trigger-file-menu">Generated File</button></div></div>\');true');
 await assertVisible('menu');
 await c.evaluate('document.querySelector("[role=menubar]").outerHTML=\'<div role="menubar"><button id="application-menu-trigger-file-menu">Replacement File</button></div>\';true');
 await assertVisible('menu');
 assert.equal(await c.evaluate('document.getElementById("native-input").value'),'generated draft');
 assert.equal(await c.evaluate('getComputedStyle(document.getElementById("background")).backgroundColor'),'rgb(51, 68, 85)');
 assert.equal(await c.evaluate('document.querySelectorAll("#codex-wallpaper-controls").length'),1);
 console.log(JSON.stringify({passed:true,kind:'generated-shell-controls-regression',oldAndCurrentClass:true,semanticClassRename:true,missingMenuFallback:true,nativePointerOpenedDialog:true,appearanceActionRoundtrip:true,lateAndReplacementMenu:true,backgroundAndDraftPreserved:true}));
}finally{c?.close();if(browser?.exitCode===null)browser.kill();}
