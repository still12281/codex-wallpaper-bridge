import test from 'node:test';
import assert from 'node:assert/strict';
import {wallpaperMedia,controlSystemMedia} from '../src/system-media.mjs';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createActions} from '../src/wallpaper-actions.mjs';
import {defaultSettings} from '../src/runtime-paths.mjs';

test('audio controls validate rates, persist independent choices and preserve focus preference',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-audio-options-')),settings=defaultSettings();let applies=0;const configured=[];
 const action=createActions(root,settings,async()=>applies++,undefined,{configureMedia:async o=>configured.push(o)});
 await assert.rejects(action(null,{action:'system-media-config',enabled:false,audio:true,audioFps:240}),/档位无效/);assert.equal(configured.length,0);
 await action(null,{action:'system-media-config',enabled:false,audio:true,audioFps:60});assert.equal(applies,1);assert.equal(settings.pauseOnBlur,true);
 await action(null,{action:'system-media-config',enabled:false,audio:true,audioFps:10});assert.equal(applies,1);
 await action(null,{action:'system-media-config',enabled:true,audio:false,audioFps:10});assert.equal(applies,2);
 assert.deepEqual(JSON.parse(await readFile(path.join(root,'settings.json'),'utf8')).systemMedia,{enabled:true,audio:false,audioFps:10});
});

test('failed audio-mode application restores capture configuration and saved choice',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-audio-rollback-')),settings=defaultSettings(),previous={...settings.systemMedia};let applies=0,last;
 const action=createActions(root,settings,async()=>{if(++applies===1)throw Error('renderer failed');},undefined,{configureMedia:async o=>last=o});
 await assert.rejects(action(null,{action:'system-media-config',enabled:false,audio:true,audioFps:60}),/renderer failed/);assert.deepEqual(settings.systemMedia,previous);assert.deepEqual(last,previous);assert.equal(applies,2);
});
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
