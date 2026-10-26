import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {libraryGroups} from '../src/library-model.mjs';
import {createActions} from '../src/wallpaper-actions.mjs';
import {defaultSettings} from '../src/runtime-paths.mjs';

test('project grouping joins legacy video and renderer variants without merging unrelated titles',()=>{
 const entries=[{id:'video',name:'Scene · 视频层',workshopId:'12345'},{id:'gpu',name:'Scene · WebGL',mode:'webwallgl',sourceKey:'root'},{id:'native',name:'Scene · 实时',mode:'realtime',sourceKey:'root',workshopId:'12345'},{id:'other',name:'Scene',workshopId:'99999'}];
 const groups=libraryGroups(entries,'native');assert.equal(groups.length,2);const scene=groups.find(g=>g.entries.length===3);assert.equal(scene.id,'native');assert.equal(scene.name,'Scene');assert.equal(entries.length,4);assert.equal(libraryGroups(entries,'other').find(g=>g.entries.length===3).id,'gpu');
 assert.equal(libraryGroups([{id:'a',name:'Same'},{id:'b',name:'Same'}],null).length,2);
});

test('deleting a grouped wallpaper removes its versions and stale references while retaining source/shared assets',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-group-delete-'));await mkdir(path.join(root,'media'));const shared='media/shared.png',external=path.join(root,'original.png');await writeFile(path.join(root,shared),'shared');await writeFile(external,'original');
 const settings=defaultSettings();settings.library=[{id:'video',workshopId:'12345',file:shared,sourcePath:external},{id:'gpu',workshopId:'12345',mode:'webwallgl'},{id:'other',file:shared}];settings.selectedId='gpu';settings.realtimeFallbackId='video';settings.rotation.ids=['video','other'];let applies=0;
 await createActions(root,settings,async()=>applies++)({}, {action:'delete',selectedId:'gpu',allVersions:true});
 assert.equal(applies,1);assert.deepEqual(settings.library.map(e=>e.id),['other']);assert.equal(settings.selectedId,'other');assert.equal(settings.realtimeFallbackId,undefined);assert.deepEqual(settings.rotation.ids,['other']);await access(external);await access(path.join(root,shared));
});

test('a superseded choice restores selection metadata without remounting the old wallpaper',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-select-cancel-')),settings=defaultSettings();settings.library=[{id:'old'},{id:'new'}];settings.selectedId='old';let calls=0;
 const actions=createActions(root,settings,async()=>{calls++;throw Object.assign(Error('superseded'),{code:'CWB_SELECTION_SUPERSEDED'});});
 await assert.rejects(actions({}, {action:'select',selectedId:'new'}),{code:'CWB_SELECTION_SUPERSEDED'});assert.equal(settings.selectedId,'old');assert.equal(calls,1);
});
