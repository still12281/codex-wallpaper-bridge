import test from 'node:test';
import assert from 'node:assert/strict';
import {wallpaperMedia,controlSystemMedia} from '../src/system-media.mjs';
test('system media uses real source state, converts milliseconds and never treats a zero frame as capture success',()=>{
 const state={status:{sources:[{name:'audio',state:'unavailable'}]},bands:Array(64).fill(100),now:{hasMedia:true,track:{title:'Fixture',artist:'Generated'},playback:{state:'playing',positionMs:2500,durationMs:10000},capabilities:{toggle:true}}};let payload=wallpaperMedia(state);assert.equal(payload.position,2.5);assert.equal(payload.duration,10);assert.equal(payload.state,1);assert.equal(payload.audioAvailable,false);assert(payload.bands.every(n=>n===0));state.status.sources[0].state='running';state.spectrumReceivedAt=Date.now();payload=wallpaperMedia(state);assert.equal(payload.audioAvailable,true);assert.equal(payload.bands[0],100);assert.equal(wallpaperMedia({}).hasMedia,false);
 state.spectrumReceivedAt=Date.now()-1500;assert.equal(wallpaperMedia(state).audioAvailable,false);state.error='provider exited';payload=wallpaperMedia(state);assert.equal(payload.audioAvailable,false);assert.equal(payload.hasMedia,false);assert.deepEqual(payload.capabilities,{});
});
test('media controls reject a changed player before sending a control command',async()=>{
 const snapshot={track:{source:{appId:'new-player'}},capabilities:{toggle:true},playback:{state:'playing'}},state={now:snapshot};let commands=0;
 await assert.rejects(controlSystemMedia(state,async method=>{if(method==='control')commands++;return snapshot;},async()=>{},'playPause',{sourceId:'original-player'}),/已切换/);assert.equal(commands,0);
});
test('media controls prefer explicit play and require observed playback state',async()=>{
 const snapshot={track:{title:'Generated',source:{appId:'fixture'}},capabilities:{play:true,toggle:true},playback:{state:'paused'}},state={now:snapshot};let action;
 const result=await controlSystemMedia(state,async(method,params)=>{if(method!=='control')return snapshot;action=params.action;return {outcome:{applied:true}};},async()=>{state.now={...snapshot,playback:{state:'playing'}};},'playPause');assert.equal(action,'play');assert.equal(result.outcome.applied,true);
});
test('accepted control without a track change is reported as unconfirmed',async()=>{
 const snapshot={track:{title:'Generated',source:{appId:'fixture'}},capabilities:{next:true},playback:{state:'playing'}},state={now:snapshot};
 await assert.rejects(controlSystemMedia(state,async method=>method==='control'?{outcome:{applied:true}}:snapshot,async()=>{},'next',{timeoutMs:1}),/未确认曲目变化/);
});
