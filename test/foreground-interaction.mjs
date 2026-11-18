import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {connectCdp} from '../src/cdp-client.mjs';
import {getDataRoot,getPowerShell} from '../src/runtime-paths.mjs';
import {playQuietAudio} from './fixtures/quiet-audio.mjs';

// Opt-in desktop test. Run against an already running Codex with the bridge.
const root=getDataRoot(), output=process.argv[2];
const readStatus=()=>readFile(path.join(root,'runtime-status.json'),'utf8').then(JSON.parse);
const runtime=await readStatus();
const port=runtime.cdpPort;
assert(Number.isInteger(port)&&port>=1024&&port<=65535);
const base='http://127.0.0.1:'+port;
const inspect=async endpoint=>(await fetch(base+endpoint,{redirect:'error',signal:AbortSignal.timeout(3000)})).json();
const browser=await inspect('/json/version');
assert.equal(browser.webSocketDebuggerUrl,'ws://127.0.0.1:'+port+'/devtools/browser/'+runtime.browserId);
async function activeTarget(){
 const status=await readStatus();
 assert.equal(status.browserId,runtime.browserId,'Codex browser changed');
 return (await inspect('/json/list')).find(t=>t.type==='page'&&t.url.startsWith('app://-/')&&
  status.targets.some(x=>x.targetId===t.id&&x.installed&&x.mode==='webwallgl'&&!x.hidden&&x.focused));
}
let target=await activeTarget();
if(!target){
 const activate=fileURLToPath(new URL('./fixtures/activate-codex.ps1',import.meta.url));
 await promisify(execFile)(getPowerShell(),['-NoProfile','-File',activate,'-DataDirectory',root,'-BrowserId',runtime.browserId,'-Port',String(port)],{windowsHide:true,timeout:8000});
 for(let attempt=0;attempt<12&&!target;attempt++){await delay(250);target=await activeTarget();}
}
assert(target,'A foreground Codex window with a WebGL wallpaper is required');
const c=await connectCdp(target.webSocketDebuggerUrl);
const call=(fn,...args)=>c.evaluate('('+fn.toString()+')('+args.map(value=>JSON.stringify(value)).join(',')+')');
const key='__cwbInteractionAudit';

function openAudit(key){
 const state=window.__codexWallpaperBridge;
 if(document.hidden||!document.hasFocus()||!state?.ready||state.mode!=='webwallgl'||state.paused||window[key])return false;
 const editors=[...document.querySelectorAll('[data-composer-surface-variant] [contenteditable="true"][role="textbox"]')];
 const scrolls=[...document.querySelectorAll('[data-app-action-timeline-scroll]')];
 const eligible=e=>e.getBoundingClientRect().width>200&&e.getBoundingClientRect().height>15;
 const empty=e=>!e.textContent.trim()&&!e.querySelector('img,[contenteditable=false]');
 const editor=editors.find(e=>eligible(e)&&empty(e));
 if(!editor)return false;
 const rect=editor.getBoundingClientRect();
 const scroll=scrolls.find(e=>{
  const r=e.getBoundingClientRect();
  return r.left<=rect.left&&r.right>=rect.right&&r.width>200&&e.scrollHeight-e.clientHeight>=200;
 });
 if(!scroll)return false;
 const original={scroll:scroll.scrollTop,focus:document.activeElement,supportsAudio:state.supportsAudio};
 const audit={editor,scroll,state,original};
 audit.ready=()=>!document.hidden&&document.hasFocus()&&state===window.__codexWallpaperBridge&&editor.isConnected&&scroll.isConnected;
 audit.configure=mode=>{
  if(!audit.ready())throw Error('Codex foreground changed');
  state.supportsAudio=mode==='full'?original.supportsAudio:false;
  if(mode!=='full')state.setSystemSpectrum({audioAvailable:false,bands:[]});
  state.pause(mode==='paused'?true:null);
  window.__cwbMediaActivity.report();
 };
 audit.points=()=>{
  const r=scroll.getBoundingClientRect(),e=editor.getBoundingClientRect();
  const x=Math.round(r.left+r.width/2),y=Math.round(r.top+Math.min(170,r.height*.25));
  const xp=Math.round(e.left+Math.min(e.width*.4,100)),yp=Math.round(e.top+e.height/2);
  if(!audit.ready()||!scroll.contains(document.elementFromPoint(x,y))||!editor.contains(document.elementFromPoint(xp,yp)))throw Error('Transcript or editor is obscured');
  return {x,y,xp,yp,direction:scroll.scrollTop>=180?-1:1};
 };
 audit.measure=()=>{
  const counts={scroll:0,wheel:0,click:0,input:0}, gaps=[], long=[], slowEvents=[];
  const scrollHandler=event=>{if(event.target===scroll)counts.scroll++;};
  const editorHandler=event=>{if(editor.contains(event.target))counts[event.type]++;};
  const wheelHandler=event=>{if(scroll.contains(event.target))counts.wheel++;};
  document.addEventListener('scroll',scrollHandler,true);
  document.addEventListener('wheel',wheelHandler,true);
  document.addEventListener('click',editorHandler,true);
  document.addEventListener('input',editorHandler,true);
  const taskObserver=new PerformanceObserver(list=>{for(const entry of list.getEntries())long.push(entry.duration);});
  taskObserver.observe({type:'longtask'});
  const eventObserver=new PerformanceObserver(list=>{for(const entry of list.getEntries())if(editor.contains(entry.target))slowEvents.push({name:entry.name,delay:entry.processingStart-entry.startTime,duration:entry.duration});});
  if(PerformanceObserver.supportedEntryTypes.includes('event'))eventObserver.observe({type:'event',durationThreshold:16});
  let prior=0,first=0,last=0,request;
  const tick=now=>{if(prior)gaps.push(now-prior);else first=now;last=now;prior=now;request=requestAnimationFrame(tick);};
  request=requestAnimationFrame(tick);
  audit.finish=()=>{
   cancelAnimationFrame(request);taskObserver.disconnect();eventObserver.disconnect();
   document.removeEventListener('scroll',scrollHandler,true);
   document.removeEventListener('wheel',wheelHandler,true);
   document.removeEventListener('click',editorHandler,true);
   document.removeEventListener('input',editorHandler,true);
   gaps.sort((a,b)=>a-b);
   audit.finish=null;
   return {counts,seconds:(last-first)/1000,frames:gaps.length,p50:gaps[Math.floor(gaps.length*.5)],p95:gaps[Math.floor(gaps.length*.95)],max:gaps.at(-1),gapsOver50:gaps.filter(ms=>ms>=50).length,longTasks:long.length,longestTask:Math.max(0,...long),slowEvents};
  };
 };
 audit.restore=()=>{
  audit.finish?.();
  if(window.__codexWallpaperBridge===state){
   state.supportsAudio=original.supportsAudio;
   state.pause(null);
   window.__cwbMediaActivity.report();
  }
  if(scroll.isConnected)scroll.scrollTop=original.scroll;
  if(document.hasFocus()&&document.activeElement===editor&&original.focus?.isConnected)original.focus.focus({preventScroll:true});
  delete window[key];
 };
 window[key]=audit;
 return true;
}

function inspectScene(key){
 const audit=window[key], sample=audit.state.sample();
 return {foreground:audit.ready(),paused:sample.paused,rendering:!!sample.stats?.running,
  audio:sample.systemAudioActive===true,fps:sample.stats?.fps||0,frames:sample.spectrumUpdates||0,rate:sample.spectrumAudit?.targetRate};
}
const expectedScene=(scene,mode)=>scene.paused===(mode==='paused')&&scene.rendering===(mode!=='paused')&&scene.audio===(mode==='full');
const prepared=await call(openAudit,key);
if(!prepared){c.close();throw Error('The foreground Codex view needs a scrollable transcript and one empty composer');}
const source='window['+JSON.stringify(key)+']';
const ensure=async()=>assert(await c.evaluate(source+'.ready()'),'Codex foreground changed');
const reply={target:target.id,run:new Date().toISOString(),results:[]};
let inserted='';
let stopTone;
const requireText=async text=>await call((key,text)=>{const a=window[key];return a.ready()&&document.activeElement===a.editor&&a.editor.textContent===text;},key,text);
const clearText=async()=>{
 if(!inserted||!await requireText(inserted))return;
 await call(key=>{const a=window[key],range=document.createRange();range.selectNodeContents(a.editor);getSelection().removeAllRanges();getSelection().addRange(range);return true;},key);
 await c.call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
 await c.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
 assert(await requireText(''),'Synthetic input was not cleared');
 inserted='';
};
const timing=async fn=>{const start=performance.now();await fn();return performance.now()-start;};
const metrics=async()=>Object.fromEntries((await c.call('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
const delta=(a,b)=>Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map(name=>[name,b[name]-a[name]]));
const mouse=(type,x,y,more={})=>c.call('Input.dispatchMouseEvent',{type,x,y,...more});
try{
 await c.call('Performance.enable');
 const deck=process.env.CWB_INTERACTION_MODES?.split(',')||['full','paused','webgl','webgl','paused','full'];
 assert(deck.every(mode=>['full','paused','webgl'].includes(mode)));
 if(deck.includes('full'))stopTone=playQuietAudio(50);
 for(const mode of deck){
  await call((key,mode)=>{window[key].configure(mode);return true;},key,mode);
  const deadline=Date.now()+4500;
  let scene;
  do{
   await delay(280);
   scene=await call(inspectScene,key);
   assert(scene.foreground,'Codex foreground changed during preparation');
  }while(Date.now()<deadline&&!expectedScene(scene,mode));
  assert(expectedScene(scene,mode),'The selected Codex view did not reach mode '+mode);
  const points=await c.evaluate(source+'.points()');
  const baseline=await metrics();
  await c.evaluate(source+'.measure();true');
  const wheels=[],typing=[];
  await mouse('mouseMoved',points.x,points.y);
  for(let i=0;i<14;i++){
   await ensure();
   wheels.push(await timing(()=>mouse('mouseWheel',points.x,points.y,{deltaX:0,deltaY:points.direction*36*(i<7?1:-1)})));
   await delay(40);
  }
  const click=await timing(async()=>{
   await mouse('mousePressed',points.xp,points.yp,{button:'left',buttons:1,clickCount:1});
   await mouse('mouseReleased',points.xp,points.yp,{button:'left',buttons:0,clickCount:1});
  });
  assert(await requireText(''),'The selected empty composer no longer has focus');
  for(const char of 'cwbtest'){
   assert(await requireText(inserted),'The composer changed during the input test');
   const next=inserted+char;
   typing.push(await timing(async()=>{
    await c.call('Input.insertText',{text:char});
    assert(await requireText(next),'The composer did not receive the synthetic input');
   }));
   inserted=next;
   await delay(50);
  }
  await clearText();
  await delay(200);
  const interaction=await c.evaluate(source+'.finish()'),last=await call(inspectScene,key),after=await metrics();
  assert(interaction.counts.scroll>0&&interaction.counts.click>=1&&interaction.counts.input>=7,'Native scroll/click/input events were missing');
  const stable=last.foreground&&expectedScene(last,mode)&&
   (mode==='full'?last.frames>scene.frames:last.frames===scene.frames);
  const result={mode,stable,scene,last,interaction,requestMs:{wheels,click,typing},delta:delta(baseline,after)};
  reply.results.push(result);
  console.log(JSON.stringify({mode,stable,counts:interaction.counts,p95:interaction.p95,max:interaction.max,longTasks:interaction.longTasks,typingMax:Math.max(...typing),fps:last.fps,delta:result.delta}));
  await call(key=>{const a=window[key];a.scroll.scrollTop=a.original.scroll;return true;},key);
 }
 assert(reply.results.every(row=>row.stable),'At least one comparison mode did not reach its expected renderer and audio state');
}catch(error){reply.error=error.message;process.exitCode=1;console.error(error.message);}
finally{
 try{await clearText();}
 finally{
  await c.evaluate(source+'?.restore();true').catch(()=>{});
  await c.call('Performance.disable').catch(()=>{});
  c.close();
  await stopTone?.().catch(()=>{});
  if(output)await writeFile(path.resolve(output),JSON.stringify(reply,null,2)+'\n');
 }
}
