import test from 'node:test';
import assert from 'node:assert/strict';
import {wallpaperMedia} from '../src/system-media.mjs';
test('system media uses real source state, converts milliseconds and never treats a zero frame as capture success',()=>{
 const state={status:{sources:[{name:'audio',state:'unavailable'}]},bands:Array(64).fill(100),now:{hasMedia:true,track:{title:'Fixture',artist:'Generated'},playback:{state:'playing',positionMs:2500,durationMs:10000},capabilities:{toggle:true}}};let payload=wallpaperMedia(state);assert.equal(payload.position,2.5);assert.equal(payload.duration,10);assert.equal(payload.state,1);assert.equal(payload.audioAvailable,false);assert(payload.bands.every(n=>n===0));state.status.sources[0].state='running';state.spectrumReceivedAt=Date.now();payload=wallpaperMedia(state);assert.equal(payload.audioAvailable,true);assert.equal(payload.bands[0],100);assert.equal(wallpaperMedia({}).hasMedia,false);
 state.spectrumReceivedAt=Date.now()-1500;assert.equal(wallpaperMedia(state).audioAvailable,false);state.error='provider exited';payload=wallpaperMedia(state);assert.equal(payload.audioAvailable,false);assert.equal(payload.hasMedia,false);assert.deepEqual(payload.capabilities,{});
});
