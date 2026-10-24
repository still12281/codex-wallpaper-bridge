import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {inspectEngineProject} from '../src/wallpaper-engine-source.mjs';
import {createActions} from '../src/wallpaper-actions.mjs';
import {defaultSettings} from '../src/runtime-paths.mjs';

test('selected scene inspection distinguishes a video layer from required realtime without extracting files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-inspect-'));await writeFile(path.join(root,'project.json'),JSON.stringify({type:'scene',title:'Fixture'}));
 const empty=Buffer.alloc(16);empty.writeUInt32LE(8);empty.write('PKGV0012',4);await writeFile(path.join(root,'scene.pkg'),empty);
 assert.equal((await inspectEngineProject(root)).needsRealtime,true);
 const name=Buffer.from('background.mp4'),pkg=Buffer.alloc(16+4+name.length+8+1);pkg.writeUInt32LE(8);pkg.write('PKGV0012',4);pkg.writeUInt32LE(1,12);pkg.writeUInt32LE(name.length,16);name.copy(pkg,20);pkg.writeUInt32LE(0,20+name.length);pkg.writeUInt32LE(1,24+name.length);await writeFile(path.join(root,'scene.pkg'),pkg);
 assert.equal((await inspectEngineProject(root)).needsRealtime,false);
 assert.equal((await inspectEngineProject(root,'realtime')).needsRealtime,true);
});

test('deleting an inactive item does not apply; deleting current never starts an adjacent realtime item',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-delete-'));await mkdir(path.join(root,'media'));const config=defaultSettings();config.library=[{id:'active',name:'Active'},{id:'inactive',name:'Inactive'},{id:'rt',name:'Realtime',mode:'realtime'}];config.selectedId='active';let calls=0;const actions=createActions(root,config,async()=>calls++);
 await actions({}, {action:'delete',selectedId:'inactive'});assert.equal(calls,0);assert.equal(config.selectedId,'active');
 await actions({}, {action:'delete',selectedId:'active'});assert.equal(calls,1);assert.equal(config.selectedId,null);assert.equal(config.library[0].id,'rt');
});
