// Isolated headless DOM test for batch import selection, local multi-pick, saved management/pagination, and rotation batch approval.
import {libraryGroups} from '../src/library-model.mjs';
import {installPanelWindow} from '../src/panel-window.mjs';
import {installPanel} from '../src/wallpaper-panel.mjs';
import {installFeaturePanel} from '../src/feature-panel.mjs';
import {defaultSettings} from '../src/runtime-paths.mjs';
import {upstreamRuntime} from '../src/upstream-adapters.mjs';
import {connectCdp} from '../src/cdp-client.mjs';
import {mkdtemp,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const temp=await mkdtemp(path.join(os.tmpdir(),'cwb-batch-panel-'));
const html=path.join(temp,'shell.html');
await writeFile(html,'<!doctype html><header class="_ApplicationMenuTopBar_"><nav role="menubar">Fixture</nav></header>');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const url=pathToFileURL(html).href;
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+path.join(temp,'profile'),url],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let c;
const result={kind:'isolated-batch-panel-integration'};

try{
 for(let i=0;i<80;i++){try{const t=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url);if(t){c=await connectCdp(t.webSocketDebuggerUrl);break;}}catch{}await sleep(100);}
 assert(c,'Chromium did not open fixture');
 let ready=false;
 for(let i=0;i<80&&!ready;i++){ready=await c.evaluate('location.href==='+JSON.stringify(url)+'&&document.readyState==="complete"&&!!document.querySelector("header [role=menubar]")');if(!ready)await sleep(50);}
 assert(ready,'Fixture did not load');

 const adapters=await upstreamRuntime();
 const config=defaultSettings();
 config.library=Array.from({length:15},(_,i)=>({
  id:'saved-'+i,
  name:i<2?'Pending Scene '+i:'Wallpaper '+String(i).padStart(2,'0'),
  ...(i<2?{mode:'webwallgl',projectRoot:'fixture-scene-'+i,needsRunConfirmation:true}:{file:'media/w'+i+'.png',mime:'image/png'}),
  ...(i===14?{workshopId:'ws-0'}:{})
 }));
 config.selectedId='saved-2';
 config.palette={r:240,g:241,b:243,dark:false};

 const engineFixture=Array.from({length:110},(_,i)=>({
  id:i===0?'ws-0':'ws-'+i,
  token:'tok-'+i,
  type:i%3===0?'scene':'image',
  title:(i%3===0?'Scene ':'Image ')+String(i).padStart(3,'0')
 }));

 await c.evaluate(`
  window.__cwbLibraryGroups=${libraryGroups.toString()};
  window.__cwbInstallPanelWindow=${installPanelWindow.toString()};
  window.__cwbInstallFeatures=${installFeaturePanel.toString()};
  window.__cwbPickerModel=${adapters.picker};
  window.__testConfig=${JSON.stringify(config)};
  window.__engineFixture=${JSON.stringify(engineFixture)};
  window.__pickReply={items:[{projectToken:'local-1',name:'photo1.png'},{projectToken:'local-2',name:'clip2.mp4'}]};
  window.__requests=[];
  window.__codexWallpaperSend=raw=>{
   const q=JSON.parse(raw);
   window.__requests.push(q);
   let reply={ok:true,config:window.__testConfig,preview:null};
   if(q.action==='engine-list')reply={ok:true,wallpapers:window.__engineFixture,roots:[],warnings:[]};
   else if(q.action==='engine-inspect')reply={ok:true,inspection:{supported:true,label:'可导入'}};
   else if(q.action==='media-pick')reply={ok:true,...window.__pickReply};
   else if(q.action==='wallpaper-engine'){
    const isScene=q.projectToken==='tok-3'||q.projectToken==='tok-6';
    const entry={id:'imp-'+window.__requests.length,name:'Imported '+q.projectToken,...(isScene?{mode:'webwallgl',projectRoot:'p-'+q.projectToken,...(q.authorizeRealtime?{}:{needsRunConfirmation:true})}:{file:'media/i.png',mime:'image/png'})};
    window.__testConfig.library.push(entry);
    reply={ok:true,config:window.__testConfig};
   }else if(q.action==='realtime-authorize-batch'){
    for(const e of window.__testConfig.library)if(q.ids.includes(e.id))delete e.needsRunConfirmation;
    reply={ok:true,config:window.__testConfig,authorized:q.ids,skipped:[]};
   }else if(q.action==='delete-batch'){
    window.__testConfig.library=window.__testConfig.library.filter(e=>!q.ids.includes(e.id));
    if(!window.__testConfig.library.some(e=>e.id===window.__testConfig.selectedId))window.__testConfig.selectedId=window.__testConfig.library[0]?.id||null;
    reply={ok:true,config:window.__testConfig,removedCount:q.ids.length};
   }else if(q.action==='delete-all'){
    const count=window.__testConfig.library.length;
    window.__testConfig.library=[];
    window.__testConfig.selectedId=null;
    reply={ok:true,config:window.__testConfig,removedCount:count};
   }
   queueMicrotask(()=>window.__cwbReply(q.id,reply));
  };
  (${installPanel.toString()})(window.__testConfig,'test-token');
  true;
 `);

 const ui=code=>c.evaluate('(()=>{const s=document.getElementById("codex-wallpaper-controls").shadowRoot;'+code+'})()');
 const waitFor=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await sleep(30);}throw Error('Condition timed out');};

 await c.call('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
 await ui('s.getElementById("toggle").click();return true');

 // 1. Saved gallery pagination & search (15 items -> page 1 has 12, page 2 has 3)
 assert.deepEqual(await ui('return {cards:s.querySelectorAll(".cwb-saved-card").length,searchHidden:s.getElementById("cwb-saved-search-bar").hidden,pagerHidden:s.getElementById("cwb-saved-pager").hidden,page:s.getElementById("cwb-saved-page").textContent}'),{cards:12,searchHidden:false,pagerHidden:false,page:'1 / 2'});
 await ui('s.getElementById("cwb-saved-next").click();return true');
 assert.equal(await ui('return s.querySelectorAll(".cwb-saved-card").length'),3);
 await ui('const input=s.getElementById("cwb-saved-search");input.value="Pending";input.dispatchEvent(new Event("input"));return true');
 assert.equal(await ui('return s.querySelectorAll(".cwb-saved-card").length'),2);
 await ui('const input=s.getElementById("cwb-saved-search");input.value="";input.dispatchEvent(new Event("input"));return true');
 result.savedSearchAndPagination=true;

 // 2. Browse library range select (page & filtered capped at 100, excluding already-imported ws-0)
 await ui('s.getElementById("browse").click();return true');
 await waitFor(()=>ui('return s.querySelectorAll(".cwb-card").length===24'));
 await ui('s.getElementById("cwb-batch-select-page").click();return true');
 // Page 1 has 24 items, ws-0 is already imported -> 23 checked
 assert.equal(await ui('return s.getElementById("cwb-batch-status").textContent'),'已勾选 23 项');
 assert.equal(await ui('return s.getElementById("cwb-batch-select-page").textContent'),'取消本页');
 await ui('s.getElementById("cwb-batch-select-page").click();return true');
 assert.equal(await ui('return s.getElementById("cwb-batch-status").textContent'),'已勾选 0 项');
 await ui('s.getElementById("cwb-batch-select-filtered").click();return true');
 assert.match(await ui('return s.getElementById("cwb-batch-status").textContent'),/^已勾选 100 项/);
 await ui('s.getElementById("cwb-batch-clear").click();return true');
 result.browseRangeSelectAndCap=true;

 // 3. Batch import dialog shows type breakdown + optional per-batch realtime authorization checkbox
 await ui('for(const tok of ["tok-1","tok-3","tok-6"]){const cb=s.getElementById("cwb-check-"+tok);cb.checked=true;cb.dispatchEvent(new Event("change"));}return true');
 await ui('s.getElementById("cwb-batch-import").click();return true');
 assert.equal(await ui('return s.getElementById("cwb-choice-dialog").open'),true);
 const modalState=await ui('return {msg:s.getElementById("cwb-choice-message").textContent,checkHidden:s.getElementById("cwb-choice-check-wrap").hidden,checked:s.getElementById("cwb-choice-check").checked,label:s.getElementById("cwb-choice-check-label").textContent}');
 assert.match(modalState.msg,/图片\/视频 1 项/);
 assert.match(modalState.msg,/实时壁纸 2 项/);
 assert.equal(modalState.checkHidden,false);
 assert.equal(modalState.checked,false);
 assert.match(modalState.label,/同时授权这 2 个实时壁纸/);
 await ui('s.getElementById("cwb-choice-check").checked=true;s.getElementById("cwb-choice-confirm").click();return true');
 await waitFor(()=>ui('return s.getElementById("cwb-choice-title").textContent==="批量导入结果"'));
 await ui('s.getElementById("cwb-choice-confirm").click();return true');
 await waitFor(()=>ui('return !s.getElementById("import").disabled'));
 const batchReqs=await c.evaluate('window.__requests.filter(q=>q.action==="wallpaper-engine")');
 assert.equal(batchReqs.length,3);
 assert.equal(batchReqs.find(q=>q.projectToken==='tok-1').authorizeRealtime,undefined);
 assert.equal(batchReqs.find(q=>q.projectToken==='tok-3').authorizeRealtime,true);
 assert.equal(batchReqs.find(q=>q.projectToken==='tok-6').authorizeRealtime,true);
 result.batchImportOptionalRealtimeAuth=true;

 // 4. Local multi-pick imports multiple files via batch confirmation flow
 await ui('s.getElementById("import").click();return true');
 await waitFor(()=>ui('return s.getElementById("cwb-choice-dialog").open&&s.getElementById("cwb-choice-title").textContent==="批量导入 2 个本机文件"'));
 assert.equal(await ui('return s.getElementById("cwb-choice-check-wrap").hidden'),true);
 await ui('s.getElementById("cwb-choice-confirm").click();return true');
 await waitFor(()=>ui('return s.getElementById("cwb-choice-title").textContent==="批量导入结果"'));
 await ui('s.getElementById("cwb-choice-confirm").click();return true');
 await waitFor(()=>ui('return !s.getElementById("import").disabled'));
 const localReqs=await c.evaluate('window.__requests.filter(q=>q.action==="wallpaper-engine"&&q.projectToken?.startsWith("local-"))');
 assert.equal(localReqs.length,2);
 assert(localReqs.every(q=>q.apply===false&&q.duplicatePolicy==='skip'));
 result.localMultiPickFlow=true;

 // 5. Rotation section batch approval clears pending realtime entries
 await ui('s.getElementById("cwb-tab-effects").click();return true');
 assert.equal(await ui('return s.getElementById("cwb-rotation-approve-all").hidden'),false);
 assert.equal(await ui('return s.getElementById("cwb-rotation-approve-all").textContent'),'批量确认（2 项）');
 await ui('s.getElementById("cwb-rotation-approve-all").click();return true');
 assert.equal(await ui('return s.getElementById("cwb-choice-dialog").open'),true);
 await ui('s.getElementById("cwb-choice-confirm").click();return true');
 await waitFor(()=>ui('return !s.getElementById("import").disabled'));
 const approveReq=await c.evaluate('window.__requests.findLast(q=>q.action==="realtime-authorize-batch")');
 assert.equal(approveReq.confirmed,true);
 assert.deepEqual(approveReq.ids,['saved-0','saved-1']);
 assert.equal(await ui('return s.getElementById("cwb-rotation-approve-all").hidden'),true);
 result.rotationBatchApprove=true;

 // 6. Saved gallery batch management -> select page & batch delete, plus layout check at 360px
 await ui('s.getElementById("cwb-tab-wallpapers").click();s.getElementById("cwb-picker-close").click();s.getElementById("cwb-saved-manage-toggle").click();return true');
 assert.equal(await ui('return s.getElementById("cwb-saved-manage-bar").hidden'),false);
 await ui('document.getElementById("codex-wallpaper-controls").__cwbSetPanelSize(360,520);return true');
 await sleep(40);
 assert.equal(await ui('const b=s.querySelector(".cwb-window-body");return b.scrollWidth<=b.clientWidth+1'),true);
 await ui('s.getElementById("cwb-saved-select-page").click();return true');
 assert.equal(await ui('return s.getElementById("cwb-saved-manage-status").textContent'),'已选 12 项');
 await ui('s.getElementById("cwb-saved-delete-selected").click();return true');
 assert.equal(await ui('return s.getElementById("cwb-choice-dialog").open'),true);
 await ui('s.getElementById("cwb-choice-confirm").click();return true');
 await waitFor(()=>ui('return !s.getElementById("import").disabled'));
 const delBatchReq=await c.evaluate('window.__requests.findLast(q=>q.action==="delete-batch")');
 assert.equal(delBatchReq.ids.length,12);
 result.savedBatchManageAndDelete=true;

 // 7. Delete all in Advanced tab
 await ui('s.getElementById("cwb-tab-advanced").click();return true');
 assert.equal(await ui('return s.getElementById("delete-all").disabled'),false);
 await ui('s.getElementById("delete-all").click();return true');
 assert.equal(await ui('return s.getElementById("cwb-choice-dialog").open'),true);
 await ui('s.getElementById("cwb-choice-confirm").click();return true');
 await waitFor(()=>ui('return !s.getElementById("import").disabled'));
 const delAllReq=await c.evaluate('window.__requests.findLast(q=>q.action==="delete-all")');
 assert.equal(delAllReq.confirmed,true);
 assert.equal(await ui('return s.getElementById("delete-all").disabled'),true);
 result.deleteAllFlow=true;
 result.passed=true;
}catch(e){
 result.error=e.stack;
 process.exitCode=1;
}finally{
 if(c){await c.call('Browser.close').catch(()=>{});c.close();}
 browser.kill();
 console.log(JSON.stringify(result,null,2));
}
