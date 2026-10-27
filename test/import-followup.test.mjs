import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createActions,normalizeLibrary} from '../src/wallpaper-actions.mjs';
import {defaultSettings} from '../src/runtime-paths.mjs';
import {describeProject} from '../src/realtime-source.mjs';
import {duplicateEntry,libraryPreview,hashMedia} from '../src/library-preview.mjs';
test('duplicate matching recognizes a project across renderer versions and hashes renamed content',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'cwb-duplicate-'));await writeFile(path.join(folder,'a.png'),'generated fixture');await writeFile(path.join(folder,'renamed.png'),'generated fixture');const contentHash=await hashMedia(path.join(folder,'a.png'));assert.equal(contentHash,await hashMedia(path.join(folder,'renamed.png')));
 const settings={library:[{id:'media',sourceKey:'source',contentHash},{id:'webgl',mode:'webwallgl',sourceKey:'source'}]};assert.equal(duplicateEntry(settings,{contentHash}).id,'media');assert.equal(duplicateEntry(settings,{mode:'webwallgl',sourceKey:'source'}).id,'webgl');assert.equal(duplicateEntry(settings,{mode:'realtime',sourceKey:'source'}).id,'media');assert.equal(duplicateEntry(settings,{sourceKey:'source',contentHash:'different bytes'}),undefined);
});
test('applying an existing realtime entry does not reimport or repeat confirmation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-existing-'));const project=path.join(root,'project');await mkdir(project);await writeFile(path.join(project,'project.json'),JSON.stringify({type:'scene',title:'Generated',file:'scene.json'}));const settings=defaultSettings();settings.library=[{id:'existing',name:'Generated',mode:'webwallgl',projectRoot:project,sourceKey:(await describeProject(project)).sourceKey,limits:{maxWidth:1280,fps:24}}];normalizeLibrary(settings);let applies=0;const actions=createActions(root,settings,async()=>{applies++});const client={};const result=await actions(client,{action:'duplicate-use',existingId:'existing',apply:true});assert.equal(result.confirmation,undefined);assert.equal(result.duplicate,undefined);assert.equal(settings.library.length,1);assert.equal(settings.selectedId,'existing');assert.equal(applies,1);
});
test('saved preview rejects a project preview escaping its root without applying a renderer',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-preview-')),project=path.join(root,'project');await mkdir(project);await writeFile(path.join(root,'private.png'),'private');await writeFile(path.join(project,'project.json'),JSON.stringify({preview:'../private.png'}));let result=await libraryPreview(root,{name:'Generated',mode:'webwallgl',projectRoot:project});assert.equal(result.preview,null);assert.equal(result.label,'GPU 直绘（WebGL）');await writeFile(path.join(project,'project.json'),JSON.stringify({preview:'playlist.m3u8'}));await writeFile(path.join(project,'playlist.m3u8'),'#EXTM3U\nhttps://example.invalid/stream');result=await libraryPreview(root,{name:'Generated',mode:'webwallgl',projectRoot:project});assert.equal(result.preview,null);
});
