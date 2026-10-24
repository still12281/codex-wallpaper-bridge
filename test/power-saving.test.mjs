import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createActions,normalizeLibrary} from '../src/wallpaper-actions.mjs';
test('power preset works for an empty library and persists defaults',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-power-')),settings={pauseOnBlur:false};normalizeLibrary(settings);const action=createActions(root,settings,async()=>{},async()=>{});await action(null,{action:'power-saving'});const saved=JSON.parse(await readFile(path.join(root,'settings.json'),'utf8'));assert.equal(saved.pauseOnBlur,true);assert.deepEqual(saved.playback,{maxWidth:960,fps:12});
});
test('failed power preset restores existing pause and playback preferences',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-power-')),settings={pauseOnBlur:false,playback:{maxWidth:1280,fps:24},selectedId:'missing',library:[{id:'missing',mime:'video/mp4',file:'does-not-exist.mp4'}]};normalizeLibrary(settings);let applied;const action=createActions(root,settings,async()=>{},async()=>{applied=settings.pauseOnBlur;});await assert.rejects(action(null,{action:'power-saving'}),/原素材不可用/);assert.equal(settings.pauseOnBlur,false);assert.equal(applied,false);assert.deepEqual(settings.playback,{maxWidth:1280,fps:24});
});
