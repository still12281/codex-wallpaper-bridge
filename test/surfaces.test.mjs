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
