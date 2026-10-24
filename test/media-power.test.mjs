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
