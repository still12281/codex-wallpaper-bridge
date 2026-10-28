import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createActions,normalizeLibrary} from '../src/wallpaper-actions.mjs';
import {defaultSettings} from '../src/runtime-paths.mjs';
import {describeProject} from '../src/realtime-source.mjs';
import {duplicateEntry} from '../src/library-preview.mjs';

test('browser and original Web versions save separately and configuration retains engine',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-web-actions-')),projectRoot=path.join(root,'project');await mkdir(projectRoot);await writeFile(path.join(projectRoot,'project.json'),JSON.stringify({type:'web',title:'Fixture',file:'index.html'}));
 const sourceKey=(await describeProject(projectRoot)).sourceKey,settings=defaultSettings();settings.library=[{id:'original',name:'Fixture',mode:'realtime',projectRoot,sourceKey,limits:{maxWidth:1280,fps:24}}];normalizeLibrary(settings);settings.selectedId='original';let applies=0;
 const actions=createActions(root,settings,async()=>{applies++;}),owner={};
 const catalog=await actions(owner,{action:'engine-list',scope:'folder',folder:projectRoot});
 const pending=await actions(owner,{action:'wallpaper-engine',projectToken:catalog.wallpapers[0].token,renderMode:'chromium-web',apply:false});assert.equal(pending.confirmation.renderer,'chromium-web');
 const confirmation=pending.confirmation;
 await actions(owner,{action:'wallpaper-engine-confirm',confirmationToken:confirmation.token,confirmed:true});
 assert.equal(settings.library.length,2);const browser=settings.library.find(e=>e.engine==='chromium-web');assert(browser.scripts);assert.equal(browser.projectType,'web');assert.equal(applies,0);assert.equal(settings.selectedId,'original');
 assert.equal(duplicateEntry(settings,{mode:'realtime',engine:'wallpaper-engine',sourceKey}).id,'original');assert.equal(duplicateEntry(settings,{mode:'realtime',engine:'chromium-web',sourceKey}).id,browser.id);
 const restored=JSON.parse(await readFile(path.join(root,'settings.json'),'utf8'));normalizeLibrary(restored);assert.equal(restored.library.find(e=>e.id===browser.id).engine,'chromium-web');
 await actions(owner,{action:'duplicate-use',existingId:browser.id,apply:true});assert.equal(applies,1);
 let nativeProfileCalls=0;const tierActions=createActions(root,settings,async()=>{},async()=>{},{captureStatic:async()=>{return 'media/fixture.jpg';},nativeProfile:()=>{nativeProfileCalls++;throw Error('must not invoke WE');}});
 await tierActions(owner,{action:'display-tier',tier:'static'});assert.equal(browser.engine,'chromium-web');assert.equal(browser.displayTier,'static');await tierActions(owner,{action:'display-tier',tier:'custom'});assert.equal(browser.engine,'chromium-web');
 await tierActions(owner,{action:'display-tier',tier:'full'});assert.equal(settings.library.find(e=>e.id===browser.id).engine,'chromium-web');assert.equal(browser.limits.maxHeight,2160);assert.equal(nativeProfileCalls,0);
});

test('browser selection failure rolls back the active configuration and library',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-web-rollback-')),projectRoot=path.join(root,'project');await mkdir(projectRoot);await writeFile(path.join(projectRoot,'project.json'),JSON.stringify({type:'web',file:'index.html'}));
 const settings=defaultSettings();settings.library=[{id:'old',projectRoot,sourceKey:(await describeProject(projectRoot)).sourceKey,mode:'realtime'}];settings.selectedId='old';normalizeLibrary(settings);let attempts=0;
 const actions=createActions(root,settings,async()=>{attempts++;if(settings.selectedId!=='old')throw Error('first frame failed');}),owner={};const pending=await actions(owner,{action:'display-renderer',renderMode:'chromium-web'});
 await assert.rejects(actions(owner,{action:'wallpaper-engine-confirm',confirmationToken:pending.confirmation.token,confirmed:true}),/first frame failed/);assert.equal(settings.selectedId,'old');assert.equal(settings.library.length,1);assert.equal(attempts,2);
});
