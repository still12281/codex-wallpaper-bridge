import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createActions} from '../src/wallpaper-actions.mjs';
import {defaultSettings} from '../src/runtime-paths.mjs';
test('native media selection is cancelled with its owner and cannot grant a late file capability',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-picker-'));await mkdir(path.join(root,'media'));await writeFile(path.join(root,'test.mp4'),'fixture');const owner={},settings=defaultSettings();let complete,started;
 const entered=new Promise(resolve=>started=resolve),actions=createActions(root,settings,async()=>{},undefined,{pickMediaFile:({signal})=>new Promise(resolve=>{complete=resolve;started(signal);})});
 const operation=actions(owner,{action:'media-pick',operationId:'picker'}),rejected=assert.rejects(operation,/取消/),signal=await entered;
 await actions.disposeOwner(owner);assert(signal.aborted);complete({file:path.join(root,'test.mp4')});await rejected;assert.deepEqual(settings.library,[]);
});
test('picker grants only an owner token and keeps the operation cancellable before import',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-picker-owner-'));await mkdir(path.join(root,'media'));const file=path.join(root,'chosen.mp4');await writeFile(file,'fixture');const owner={},settings=defaultSettings(),actions=createActions(root,settings,async()=>{},undefined,{pickMediaFile:async()=>({file})});
 const picked=await actions(owner,{action:'media-pick',operationId:'picked'});assert(picked.projectToken&&!picked.file&&!picked.location);await assert.rejects(actions({},{action:'wallpaper-engine',projectToken:picked.projectToken,apply:false}),/过期/);
 const cancelled=await actions(owner,{action:'import-cancel',operationId:'picked'});assert(cancelled.cancelAccepted);await actions.disposeOwner(owner);await assert.rejects(actions(owner,{action:'wallpaper-engine',projectToken:picked.projectToken,apply:false,operationId:'another'}),/过期/);assert.deepEqual(settings.library,[]);
});
