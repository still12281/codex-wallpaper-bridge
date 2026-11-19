import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaPower} from '../src/media-power.mjs';
function fixture(){
 let time=1000;const calls=[],starts=[],clients=[{mediaActivity:{renderer:'a',webgl:false,active:false,panel:false}}];
 const power=createMediaPower({now:()=>time,debounceMs:0,sessions:()=>clients,send:async(c,kind,payload)=>calls.push({c,kind,payload}),start:async options=>{const state={spectrumFrames:0},payload={hasMedia:true,title:'fixture',position:0,audioAvailable:false,bands:[],sources:[],capabilities:{}};const backend={state,payload:()=>payload,stop:async()=>backend.stopped=true,options};starts.push(backend);return backend;}});
 return {power,calls,starts,clients,advance(ms){time+=ms;},payload(){return starts.at(-1).payload();}};
}
test('video keeps metadata enabled but never starts audio, metadata and closed panel stay quiet',async()=>{
 const f=fixture();await f.power.configure({enabled:true,audio:true});await f.power.tick();assert.equal(f.starts[0].options.audio,false);assert.equal(f.calls.length,0);
 const a=f.clients[0].mediaActivity;a.panel=true;await f.power.tick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].kind,'panel');
 for(let i=0;i<20;i++){f.payload().position++;await f.power.tick();}assert.equal(f.calls.length,1);
 a.panel=false;await f.power.tick();f.payload().title='new';await f.power.tick();assert.equal(f.calls.length,1);
 a.panel=true;await f.power.tick();assert.equal(f.calls.at(-1).payload.title,'new');assert.equal(f.calls.length,2);await f.power.stop();
});
test('active audio is shared across windows, pause clears once, fresh restart and scene replacement receive first state',async()=>{
 const f=fixture();Object.assign(f.clients[0].mediaActivity,{webgl:true,active:true});await f.power.configure({enabled:true,audio:true});assert.equal(f.starts[0].options.audio,true);
 f.payload().audioAvailable=true;f.payload().bands=Array(64).fill(0);f.starts[0].state.spectrumFrames=1;
 await f.power.tick();assert.equal(f.calls.filter(c=>c.kind==='spectrum').length,1);await f.power.tick();assert.equal(f.calls.filter(c=>c.kind==='metadata').length,1);
 f.advance(5000);f.payload().position=5;await f.power.tick();assert.equal(f.calls.filter(c=>c.kind==='metadata').length,1);assert.equal(f.calls.filter(c=>c.kind==='position').length,2);
 f.clients.push({mediaActivity:{renderer:'b',webgl:true,active:true,panel:false}});f.clients[0].mediaActivity.active=false;await f.power.tick();assert.equal(f.starts.length,1);
 f.clients[1].mediaActivity.active=false;await f.power.tick();assert.equal(f.starts.length,2);assert(f.starts[0].stopped);assert.equal(f.starts[1].options.audio,false);
 const count=f.calls.filter(c=>c.kind==='spectrum').length;await f.power.tick();assert.equal(f.calls.filter(c=>c.kind==='spectrum').length,count);
 f.clients[0].mediaActivity.active=true;await f.power.tick();assert.equal(f.starts.at(-1).options.audio,true);assert.equal(f.payload().audioAvailable,false);
 f.clients[0].mediaActivity.renderer='replacement';await f.power.tick();assert.equal(f.calls.at(-1).kind,'position');await f.power.stop();
});
test('stale spectrum is cleared without waiting for a new frame',async()=>{
 const f=fixture();Object.assign(f.clients[0].mediaActivity,{webgl:true,active:true});await f.power.configure({enabled:true,audio:true});f.payload().audioAvailable=true;f.starts[0].state.spectrumFrames=1;await f.power.tick();
 f.payload().audioAvailable=false;await f.power.tick();const last=f.calls.at(-1);assert.equal(last.kind,'spectrum');assert.equal(last.payload.audioAvailable,false);const n=f.calls.length;await f.power.tick();assert.equal(f.calls.length,n);await f.power.stop();
});
test('scenes without audio processing still receive media metadata',async()=>{
 const f=fixture();Object.assign(f.clients[0].mediaActivity,{webgl:true,active:true,audio:false});await f.power.configure({enabled:true,audio:true});await f.power.tick();assert.equal(f.starts[0].options.audio,false);assert(f.calls.some(c=>c.kind==='metadata'));assert(!f.calls.some(c=>c.kind==='spectrum'));await f.power.stop();
});
test('disabling media clears all fields retained by an incremental scene media source',async()=>{
 const f=fixture();Object.assign(f.clients[0].mediaActivity,{webgl:true,active:true});await f.power.configure({enabled:true,audio:true});await f.power.tick();await f.power.configure({enabled:false,audio:true});await f.power.tick();const payload=f.calls.filter(c=>c.kind==='metadata').at(-1).payload;assert.equal(payload.hasMedia,false);assert.equal(payload.title,'');assert.equal(payload.artist,'');assert.equal(payload.album,'');assert.equal(payload.state,0);assert.equal(payload.duration,0);assert.equal(payload.sourceId,'');await f.power.stop();
});
test('consumer disappearing while old backend stops never starts audio capture',async()=>{
 let release,starts=0;const clients=[{mediaActivity:{webgl:false,active:false}}];const p=createMediaPower({sessions:()=>clients,send:async()=>{},debounceMs:0,start:async()=>({state:{},payload:()=>({}),stop:async()=>{if(starts++===0)await new Promise(r=>release=r);}})});
 await p.configure({enabled:true,audio:true});Object.assign(clients[0].mediaActivity,{webgl:true,active:true});const ticking=p.tick();await new Promise(r=>setImmediate(r));clients[0].mediaActivity.active=false;release();await ticking;assert.equal(p.snapshot().starts,1);assert.equal(p.backend,null);await p.stop();
});
test('focus debounce avoids restarting capture on brief foreground changes',async()=>{
 let time=0,starts=0;const clients=[{mediaActivity:{webgl:true,active:true}}];const p=createMediaPower({sessions:()=>clients,send:async()=>{},now:()=>time,start:async()=>{starts++;return {state:{},payload:()=>({}),stop:async()=>{}};}});
 await p.configure({enabled:true,audio:true});clients[0].mediaActivity.active=false;await p.tick();time=300;clients[0].mediaActivity.active=true;await p.tick();time=2000;await p.tick();assert.equal(starts,1);await p.stop();
});
test('async audio startup is discarded when last consumer leaves; stop awaits startup',async()=>{
 let release,stopped=0;const clients=[{mediaActivity:{active:true,webgl:true}}];const p=createMediaPower({sessions:()=>clients,send:async()=>{},debounceMs:0,start:()=>new Promise(r=>release=()=>r({state:{},stop:async()=>stopped++,payload:()=>({})}))});
 const configuring=p.configure({enabled:true,audio:true});await new Promise(r=>setImmediate(r));clients[0].mediaActivity.active=false;release();await configuring;assert.equal(p.backend,null);assert.equal(stopped,1);
 const second=p.tick();await new Promise(r=>setImmediate(r));const stopping=p.stop();release();await Promise.all([second,stopping]);assert.equal(p.backend,null);assert.equal(stopped,2);
});

test('audio-only mode works without exposing song metadata and rate changes restart only capture',async()=>{
 const f=fixture();Object.assign(f.clients[0].mediaActivity,{webgl:true,active:true});
 await f.power.configure({enabled:false,audio:true,audioFps:10});assert.equal(f.starts[0].options.audioFps,10);
 f.payload().audioAvailable=true;f.payload().bands=[150];f.starts[0].state.spectrumFrames=1;await f.power.tick();
 assert.equal(f.calls.find(c=>c.kind==='metadata').payload.title,'');assert.equal(f.calls.find(c=>c.kind==='spectrum').payload.bands[0],150);
 await f.power.configure({enabled:false,audio:true,audioFps:60});assert(f.starts[0].stopped);assert.equal(f.starts.at(-1).options.audioFps,60);
 assert.equal(f.power.snapshot().audioFps,60);await f.power.configure({enabled:false,audio:false,audioFps:60});await f.power.tick();assert.equal(f.power.backend,null);assert.equal(f.power.snapshot().audioRunning,false);await f.power.stop();
});

test('high spectrum reports the component target and fresh-frame rate to an open panel',async()=>{
 const f=fixture();Object.assign(f.clients[0].mediaActivity,{webgl:true,active:true,panel:true});
 await f.power.configure({enabled:false,audio:true,audioFps:120});
 const fallback=f.starts.at(-1);fallback.state.audioFps=60;
 await f.power.tick();assert.equal(f.power.snapshot().audioFps,60);
 assert.equal(f.calls.find(c=>c.kind==='panel').payload.targetRate,60);
 await f.power.configure({enabled:false,audio:true,audioFps:90});
 const high=f.starts.at(-1);high.state.audioFps=90;
 await f.power.tick();f.advance(1000);high.state.spectrumFrames=78;await f.power.tick();
 assert.equal(f.power.snapshot().receivedHz,78);
 const panel=f.calls.filter(c=>c.kind==='panel').at(-1).payload;
 assert.equal(panel.receivedHz,78);assert.equal(panel.targetRate,90);
 assert.equal(f.calls.filter(c=>c.kind==='metadata').length,1);
 await f.power.stop();
});

test('default 30 Hz delivers every stereo frame from a packet once and reports the rate',async()=>{
 const f=fixture();Object.assign(f.clients[0].mediaActivity,{webgl:true,active:true});
 f.clients[0].mediaActivity.panel=true;
 await f.power.configure({enabled:false,audio:true});
 const source=f.starts.at(-1);
 assert.equal(source.options.audioFps,30);
 const frames=[1600,3200].map(sampleEnd=>({left:Array(64).fill(1),right:Array(64).fill(0),sampleEnd}));
 const queue=[...frames];source.drainSpectrum=()=>queue.splice(0);
 Object.assign(source.state,{audioFps:30,spectrumFrames:2,spectrumDetails:{sampleEnd:3200},maxQueued:2});
 f.payload().audioAvailable=true;
 await f.power.tick();await f.power.tick();
 const delivered=f.calls.filter(item=>item.kind==='spectrum');
 assert.equal(delivered.length,1);assert.deepEqual(delivered[0].payload,{frames});
 assert.equal(f.power.snapshot().spectrumSent,2);
 f.advance(1000);source.state.spectrumFrames=32;await f.power.tick();
 assert.equal(f.power.snapshot().receivedHz,30);
 assert.equal(f.power.snapshot().maxQueued,2);
 await f.power.stop();
});

test('only expected capture with persistently missing frames restarts, and silent packets count as progress',async()=>{
 let time=1000;
 const clients=[{mediaActivity:{renderer:'a',webgl:true,active:true,audio:true}}],starts=[];
 const power=createMediaPower({sessions:()=>clients,now:()=>time,send:async()=>{},debounceMs:0,start:async()=>{
  const state={audioEnabled:true,now:{playback:{state:'paused'}},spectrumFrames:0};
  const source={state,payload:()=>({audioAvailable:Number.isFinite(state.spectrumReceivedAt)&&time-state.spectrumReceivedAt<1000,bands:Array(64).fill(0)}),stop:async()=>{source.stopped=true;}};
  starts.push(source);return source;
 }});
 await power.configure({enabled:true,audio:true});
 time+=60000;await power.tick();assert.equal(starts.length,1);assert.equal(power.snapshot().audioRunning,false);
 const first=starts[0];
 first.state.now.playback.state='playing';
 await power.tick();
 for(let i=0;i<6;i++){
  time+=800;first.state.spectrumReceivedAt=time;first.state.spectrumFrames++;
  await power.tick();assert.equal(power.snapshot().audioRunning,true);
 }
 assert.equal(starts.length,1,'All-zero FFT packets must still count as fresh capture');
 time+=3400;await power.tick();assert.equal(starts.length,1);
 time+=150;await power.tick();assert.equal(starts.length,2);assert(first.stopped);
 starts[1].state.now.playback.state='playing';
 await power.tick();time+=4000;await power.tick();assert.equal(starts.length,2,'Stalled capture must honor bounded recovery');
 assert.equal(power.snapshot().captureRestarts,1);
 clients[0].mediaActivity.active=false;time+=60000;await power.tick();
 assert.equal(power.snapshot().captureRestarts,1,'Inactive targets must never trigger capture recovery');
 await power.stop();
});

test('slow or disconnected pages cannot block healthy delivery or accumulate more than a small recent batch',async()=>{
 let time=1000,release,nextSequence=0;
 const delivered=[],pending=[];let inflight=0,maxInflight=0;
 const slow={mediaActivity:{renderer:'slow',active:true,webgl:true}},fast={mediaActivity:{renderer:'fast',active:true,webgl:true}};
 const state={spectrumFrames:0,audioFps:30,spectrumDetails:{sampleEnd:0}};
 const power=createMediaPower({sessions:()=>[slow,fast],now:()=>time,debounceMs:0,
  start:async()=>({state,payload:()=>({audioAvailable:true}),drainSpectrum:()=>pending.splice(0),stop:async()=>{}}),
  send:async(client,kind,payload)=>{
   if(kind!=='spectrum')return;
   if(client===slow&&payload.frames[0].sampleEnd===1){
    inflight++;maxInflight=Math.max(maxInflight,inflight);
    try{await new Promise((resolve,reject)=>release=reject);}finally{inflight--;}
   }
   delivered.push({client,frames:payload.frames.map(f=>f.sampleEnd)});
  }
 });
 await power.configure({audio:true,audioFps:30});
 for(let n=0;n<14;n++){
  time+=33;state.spectrumFrames=state.spectrumDetails.sampleEnd=++nextSequence;
  pending.push({sampleEnd:nextSequence});
  await power.tick();
 }
 assert.equal(maxInflight,1);
 assert.deepEqual(delivered.filter(x=>x.client===fast).flatMap(x=>x.frames),Array.from({length:14},(_,i)=>i+1));
 assert.equal(delivered.filter(x=>x.client===slow).length,0);
 release(Error('CDP disconnected'));await new Promise(r=>setImmediate(r));
 time+=275;pending.push({sampleEnd:15});await power.tick();await new Promise(r=>setImmediate(r));
 assert.deepEqual(delivered.filter(x=>x.client===slow).flatMap(x=>x.frames),[15],'Recovery must not replay stale queued frames');
 assert.equal(power.snapshot().deliveryErrors,1);
 assert(power.snapshot().deliveryDrops>0);
 await power.stop();
});

test('audio events wake delivery, short blur retains capture, and idle never keeps a frequency timer',async()=>{
 const turn=()=>new Promise(resolve=>setImmediate(resolve));
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const activity={renderer:'test',active:false,webgl:true,audio:true,panel:true},client={mediaActivity:activity};
 const state={audioEnabled:true,audioFps:30,spectrumFrames:0};let starts=0,stops=0,frames=[],reads=0;
 const panels=[];
 const power=createMediaPower({sessions:()=>[client],debounceMs:0,idleMs:45,
  send:async(c,kind,payload)=>{if(kind==='panel')panels.push(payload.audioStage);},
  start:async()=>{starts++;return {state,payload:()=>{reads++;return {audioAvailable:state.spectrumFrames>0};},drainSpectrum:()=>frames.splice(0),stop:async()=>{stops++;}};}
 });
 try{
  await power.configure({audio:true});power.wake();await turn();
  assert.equal(panels.at(-1),'scene-paused');assert.equal(starts,0);
  activity.active=true;power.wake();await turn();
  assert.equal(starts,1);
  state.spectrumFrames=1;frames.push({sampleEnd:1});power.spectrum();await turn();
  assert.equal(power.snapshot().spectrumSent,1);assert.equal(panels.at(-1),'awaiting-renderer');
  activity.spectrumAt=Date.now();power.wake();await turn();assert.equal(panels.at(-1),'receiving');
  activity.active=false;power.wake();await turn();
  activity.active=true;power.wake();await turn();assert.equal(stops,0);
  activity.active=false;power.wake();await wait(100);assert.equal(stops,1);
  const idleReads=reads;
  for(let n=0;n<5;n++)power.spectrum();
  await wait(80);assert.equal(reads,idleReads);assert.equal(starts,1);
 }finally{await power.stop();}
});
