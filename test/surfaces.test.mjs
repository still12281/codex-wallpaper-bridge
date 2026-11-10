import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {defaultSettings} from '../src/runtime-paths.mjs';
import {normalizeLibrary,createActions} from '../src/wallpaper-actions.mjs';

test('retired layout switches become automatic while relevant native opt-outs survive',()=>{
 const config=defaultSettings();config.surfaceSync={composer:false,navigation:false,panels:false,menus:true,embedded:false};
 normalizeLibrary(config);assert.deepEqual(config.surfaceSync,{code:true,embedded:false});
 config.surfaceSync.code=false;normalizeLibrary(config);assert.deepEqual(config.surfaceSync,{code:false,embedded:false});
});

test('native surface preferences persist and roll back on appearance failures',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-surface-')),config=defaultSettings();let fail=false;
 const actions=createActions(root,config,async()=>{},async()=>{if(fail){fail=false;throw Error('appearance failed')}});
 await actions({}, {action:'surface-sync',region:'code',enabled:false});
 assert.equal(JSON.parse(await readFile(path.join(root,'settings.json'),'utf8')).surfaceSync.code,false);
 fail=true;await assert.rejects(actions({}, {action:'surface-sync',region:'embedded',enabled:false}),/appearance failed/);
 assert.deepEqual(config.surfaceSync,{code:false,embedded:true});
 await assert.rejects(actions({}, {action:'surface-sync',region:'navigation',enabled:false}),/分区设置无效/);
});

test('manual surface scan reports partial results without saving settings or restarting wallpaper',async()=>{
 const config=defaultSettings();config.library=[{id:'current',file:'media/current.png'}];config.selectedId='current';const saved=structuredClone(config);let calls=0;
 const action=createActions('missing-scan-directory',config,async()=>{throw Error('must not restart wallpaper')},undefined,{scanSurfaces:async()=>{calls++;return {scanned:3,added:2,skipped:1,failed:1,limited:1};}});
 const result=await action({}, {action:'surface-rescan'});assert.equal(calls,1);assert.equal(result.scan.added,2);assert.match(result.message,/3 个页面/);assert.match(result.message,/未完成/);assert.deepEqual(config,saved);
 config.selectedId=null;await assert.rejects(action({}, {action:'surface-rescan'}),/先选择并启用/);assert.equal(calls,1);
});
