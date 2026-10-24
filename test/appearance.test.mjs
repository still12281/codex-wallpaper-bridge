import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {defaultSettings} from '../src/runtime-paths.mjs';
import {createActions} from '../src/wallpaper-actions.mjs';
import {parsePreset,nextRotation} from '../src/appearance-model.mjs';
test('portable presets exclude local libraries and reject unsupported appearance fields',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-presets-')),settings=defaultSettings();settings.library=[{id:'private',projectRoot:'private-project-reference'}];let fail=false;const actions=createActions(root,settings,async()=>{},async()=>{if(fail){fail=false;throw Error('failed apply');}});
 await actions({}, {action:'visual',values:{glassBlur:12,fxEnabled:true}});const exported=await actions({}, {action:'preset-export',name:'Portable'});assert(!exported.preset.includes('private'));const decoded=JSON.parse(exported.preset);assert.equal(parsePreset(exported.preset).appearance.visual.glassBlur,12);
 decoded.appearance.visual.script='untrusted';assert.throws(()=>parsePreset(JSON.stringify(decoded)),/不支持的外观字段/);
 await actions({}, {action:'preset-import',json:exported.preset});await actions({}, {action:'visual',values:{glassBlur:0}});fail=true;await assert.rejects(actions({}, {action:'preset-apply',presetId:settings.presets[0].id}),/failed apply/);assert.equal(settings.visual.glassBlur,0);await actions({}, {action:'preset-apply',presetId:settings.presets[0].id});assert.equal(settings.visual.glassBlur,12);assert.equal(settings.library[0].id,'private');
});
test('rotation excludes hidden/current/realtime sources and reverts failed selections',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-rotation-')),settings=defaultSettings();settings.library=[{id:'a',file:'media/a.mp4'},{id:'b',file:'media/b.mp4',workshopId:'1234'},{id:'rt',mode:'realtime'},{id:'gl',mode:'webwallgl'}];settings.selectedId='a';assert.equal(nextRotation(settings).id,'b');settings.hiddenWallpaperIds=['1234'];assert.equal(nextRotation(settings),null);settings.hiddenWallpaperIds=[];settings.rotation.order='shuffle';assert.equal(nextRotation(settings,()=>0).id,'b');
 let fail=true;const actions=createActions(root,settings,async()=>{if(fail){fail=false;throw Error('decode failed');}});await assert.rejects(actions({}, {action:'rotation-next'}),/decode failed/);assert.equal(settings.selectedId,'a');await actions({}, {action:'rotation-next'});assert.equal(settings.selectedId,'b');assert.equal(settings.library.length,4);
});
