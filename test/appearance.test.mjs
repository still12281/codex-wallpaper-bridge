import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {defaultSettings} from '../src/runtime-paths.mjs';
import {createActions} from '../src/wallpaper-actions.mjs';
import {parsePreset,nextRotation,rotationCandidates} from '../src/appearance-model.mjs';
test('portable presets exclude local libraries and reject unsupported appearance fields',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-presets-')),settings=defaultSettings();settings.library=[{id:'private',projectRoot:'private-project-reference'}];let fail=false;const actions=createActions(root,settings,async()=>{},async()=>{if(fail){fail=false;throw Error('failed apply');}});
 await actions({}, {action:'visual',values:{glassBlur:12,fxEnabled:true}});const exported=await actions({}, {action:'preset-export',name:'Portable'});assert(!exported.preset.includes('private'));const decoded=JSON.parse(exported.preset);assert.equal(parsePreset(exported.preset).appearance.visual.glassBlur,12);
 decoded.appearance.visual.script='untrusted';assert.throws(()=>parsePreset(JSON.stringify(decoded)),/不支持的外观字段/);
 await actions({}, {action:'preset-import',json:exported.preset});await actions({}, {action:'visual',values:{glassBlur:0}});fail=true;await assert.rejects(actions({}, {action:'preset-apply',presetId:settings.presets[0].id}),/failed apply/);assert.equal(settings.visual.glassBlur,0);await actions({}, {action:'preset-apply',presetId:settings.presets[0].id});assert.equal(settings.visual.glassBlur,12);assert.equal(settings.library[0].id,'private');
});
test('rotation excludes hidden/current/unusable sources and retains the old selection when all fail',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-rotation-')),settings=defaultSettings();settings.library=[{id:'a',file:'media/a.mp4'},{id:'b',file:'media/b.mp4',workshopId:'1234'},{id:'rt',mode:'realtime'},{id:'gl',mode:'webwallgl'}];settings.selectedId='a';assert.equal(nextRotation(settings).id,'b');settings.hiddenWallpaperIds=['1234'];assert.equal(nextRotation(settings),null);settings.hiddenWallpaperIds=[];settings.rotation.order='shuffle';assert.equal(nextRotation(settings,()=>0).id,'b');
 let fail=true;const actions=createActions(root,settings,async()=>{if(fail){fail=false;throw Error('decode failed');}});const first=await actions({}, {action:'rotation-next'});assert(first.rotation.allFailed);assert.equal(first.rotation.skipped.length,1);assert.equal(settings.selectedId,'a');await actions({}, {action:'rotation-next'});assert.equal(settings.selectedId,'b');assert.equal(settings.library.length,4);
});
test('logical rotation supports saved GPU/native versions, skips a bad group once and yields to superseding selections',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-rotate-scene-')),s=defaultSettings();s.library=[{id:'a',file:'media/a.mp4',workshopId:'1'},{id:'a-gpu',mode:'webwallgl',projectRoot:'a-project',workshopId:'1'},{id:'bad-gpu',mode:'webwallgl',projectRoot:'bad-project',workshopId:'2'},{id:'bad-native',mode:'realtime',projectRoot:'bad-project',workshopId:'2'},{id:'good-native',mode:'realtime',projectRoot:'good-project',workshopId:'3'}];s.selectedId='a';assert.equal(rotationCandidates(s).length,3);assert.equal(nextRotation(s).id,'bad-gpu');
 const attempted=[],action=createActions(root,s,async()=>{attempted.push(s.selectedId);if(s.selectedId.startsWith('bad-'))throw Error('broken project');});await action(null,{action:'rotation-config',enabled:false,intervalSeconds:60,order:'sequential',ids:['a','bad-native','good-native']});assert.equal(nextRotation(s).id,'bad-native');
 const result=await action(null,{action:'rotation-next'});assert.equal(s.selectedId,'good-native');assert.equal(result.rotation.skipped.length,1);assert.deepEqual(attempted,['bad-native','a','good-native']);
 s.selectedId='a';let attempts=0;const superseded=createActions(root,s,async()=>{attempts++;throw Object.assign(Error('new manual choice'),{code:'CWB_SELECTION_SUPERSEDED'});});await assert.rejects(superseded(null,{action:'rotation-next'}),{code:'CWB_SELECTION_SUPERSEDED'});assert.equal(attempts,1);assert.equal(s.selectedId,'a');
 s.hiddenWallpaperIds=['2'];assert.equal(nextRotation(s).id,'good-native');
});
test('rotation stops on persistence or restoration failure instead of treating every project as broken',async()=>{
 const root=path.join(await mkdtemp(path.join(os.tmpdir(),'cwb-rotation-save-')),'missing-parent'),s=defaultSettings();s.library=[{id:'a',file:'media/a.png'},{id:'b',file:'media/b.png'},{id:'c',file:'media/c.png'}];s.selectedId='a';const attempted=[];
 const saveFailure=createActions(root,s,async()=>attempted.push(s.selectedId));await assert.rejects(saveFailure(null,{action:'rotation-next'}),{code:'CWB_SELECTION_SAVE_FAILED'});assert.deepEqual(attempted,['b','a']);assert.equal(s.selectedId,'a');
 attempted.length=0;const restoreFailure=createActions(root,s,async()=>{attempted.push(s.selectedId);if(s.selectedId==='a')throw Error('old source unavailable');});await assert.rejects(restoreFailure(null,{action:'rotation-next'}),{code:'CWB_SELECTION_RESTORE_FAILED'});assert.deepEqual(attempted,['b','a']);
});
