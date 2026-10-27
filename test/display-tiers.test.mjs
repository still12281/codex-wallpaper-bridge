import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {DISPLAY_TIERS,effectiveEntry,effectiveMediaSettings,displaySettings} from '../src/display-tiers.mjs';
import {createActions} from '../src/wallpaper-actions.mjs';
import {defaultSettings} from '../src/runtime-paths.mjs';
import {describeProject} from '../src/realtime-source.mjs';
test('static and economy stop audio/decorations without changing saved preferences',()=>{
 const s=defaultSettings();s.library=[{id:'scene',mode:'webwallgl',displayTier:'static',staticFile:'media/still.png'}];s.selectedId='scene';s.systemMedia={enabled:true,audio:true,audioFps:60};s.visual.fxEnabled=true;s.visual.parallax=10;
 const view=displaySettings(s);assert.equal(view.systemMedia.audio,false);assert.equal(view.visual.fxEnabled,false);assert.equal(view.visual.parallax,0);assert.equal(s.systemMedia.audio,true);assert.equal(s.visual.fxEnabled,true);
 assert.equal(effectiveEntry(s.library[0]).mime,'image/png');assert.equal(effectiveEntry(s.library[0]).mode,undefined);
 s.library[0].displayTier='balanced';assert.equal(effectiveMediaSettings(s).audioFps,20);assert.equal(effectiveMediaSettings(s).audio,true);
 s.library[0].displayTier='full';assert.equal(effectiveMediaSettings(s).audioFps,60);assert.equal(DISPLAY_TIERS.full.videoTexScale,1);
});
test('tier application persists only after a usable still is ready and preserves source identity',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-tier-'));await mkdir(path.join(root,'media'));const s=defaultSettings();s.library=[{id:'scene',mode:'webwallgl',projectRoot:'unchanged',limits:{maxWidth:1280,fps:30}}];s.selectedId='scene';s.systemMedia.audio=true;let captures=0,applies=0,configured;
 const actions=createActions(root,s,async()=>applies++,undefined,{captureStatic:async()=>{captures++;await writeFile(path.join(root,'media/still.png'),'fixture');return 'media/still.png';},configureMedia:async x=>configured=x});
 await actions(null,{action:'display-tier',tier:'static'});assert.equal(captures,1);assert.equal(configured.audio,false);assert.equal(s.library[0].mode,'webwallgl');assert.equal(s.library[0].projectRoot,'unchanged');assert.equal(s.systemMedia.audio,true);
 await actions(null,{action:'display-tier',tier:'balanced'});assert.equal(configured.audio,true);assert.equal(s.library[0].limits.fps,24);assert.equal(applies,2);assert.equal(JSON.parse(await readFile(path.join(root,'settings.json'),'utf8')).library[0].displayTier,'balanced');
});
test('failed tier mount restores original configuration and requested audio',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-tier-fail-')),s=defaultSettings();s.library=[{id:'scene',mode:'webwallgl',limits:{maxWidth:1280,fps:30}}];s.selectedId='scene';s.systemMedia.audio=true;const before=structuredClone(s.library[0]);let n=0;
 const actions=createActions(root,s,async()=>{if(++n===1)throw Error('candidate failed');},undefined,{configureMedia:async()=>{}});
 await assert.rejects(actions(null,{action:'display-tier',tier:'full'}),/candidate failed/);assert.deepEqual(s.library[0],before);assert.equal(s.systemMedia.audio,true);
 await assert.rejects(actions(null,{action:'display-tier',tier:'static'}),/不支持生成静态/);assert.deepEqual(s.library[0],before);
});
test('native full-effects entry requires confirmation and does not replace the current scene',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-native-choice-')),project=path.join(root,'project');await mkdir(project);await writeFile(path.join(project,'project.json'),JSON.stringify({type:'scene',title:'Fixture'}));
 const s=defaultSettings();s.library=[{id:'scene',mode:'webwallgl',projectRoot:project,limits:{maxWidth:1280,fps:30}}];s.selectedId='scene';let applied=0;
 const action=createActions(root,s,async()=>applied++),r=await action({}, {action:'display-native'});assert.equal(r.confirmation.renderer,'native');assert.equal(r.confirmation.apply,true);assert.equal(applied,0);assert.equal(s.selectedId,'scene');assert.equal(s.library.length,1);
});
test('manual playback edits replace old custom restore values',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-tier-custom-')),s=defaultSettings();s.library=[{id:'scene',mode:'webwallgl',limits:{maxWidth:1280,fps:30}}];s.selectedId='scene';
 const action=createActions(root,s,async()=>{},undefined,{configureMedia:async()=>{}});await action(null,{action:'display-tier',tier:'economy'});assert(s.library[0].customDisplay);
 await action(null,{action:'playback',maxWidth:1920,fps:30});assert.equal(s.library[0].customDisplay,undefined);await action(null,{action:'display-tier',tier:'custom'});assert.equal(s.library[0].limits.maxWidth,1920);
});
test('GPU FPS updates keep exact dimensions and media defaults, and roll back hot-update errors',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-gpu-fps-')),s=defaultSettings();s.library=[{id:'scene',mode:'webwallgl',limits:{maxWidth:3840,maxHeight:2160,fps:60,exactResolution:true}}];s.selectedId='scene';const mediaDefaults=structuredClone(s.playback);let remounts=0,fail=false,last;
 const action=createActions(root,s,async()=>remounts++,undefined,{updateFrameRate:async fps=>{last=fps;if(fail){fail=false;throw Error('hot update failed');}return true;}});
 await action(null,{action:'playback',maxWidth:3840,fps:144});assert.equal(last,144);assert.equal(remounts,0);assert.equal(s.library[0].limits.maxHeight,2160);assert.equal(s.library[0].limits.exactResolution,true);assert.deepEqual(s.playback,mediaDefaults);
 fail=true;await assert.rejects(action(null,{action:'playback',maxWidth:3840,fps:120}),/hot update failed/);assert.equal(last,144);assert.equal(s.library[0].limits.fps,144);assert.equal(remounts,0);
 const brokenHot=createActions(root,s,async()=>remounts++,undefined,{updateFrameRate:async()=>{throw Error('setter unavailable');}});await assert.rejects(brokenHot(null,{action:'playback',maxWidth:3840,fps:120}),/setter unavailable/);assert.equal(s.library[0].limits.fps,144);assert.equal(remounts,1);
});
test('switching a high-refresh GPU project to native uses a separate confirmed native FPS',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-high-native-')),project=path.join(root,'project');await mkdir(project);await writeFile(path.join(project,'project.json'),JSON.stringify({type:'scene'}));const s=defaultSettings();s.library=[{id:'gpu',mode:'webwallgl',projectRoot:project,limits:{maxWidth:1280,fps:144}}];s.selectedId='gpu';s.playback.fps=30;
 const action=createActions(root,s,async()=>{}),r=await action({}, {action:'display-renderer',renderMode:'native'});assert.equal(r.confirmation.renderer,'native');assert.equal(r.confirmation.limits.fps,30);assert.equal(s.library[0].limits.fps,144);
});
test('native FPS and width edits preserve capture quality and the selected aspect ratio',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-native-profile-')),s=defaultSettings();s.library=[{id:'native',mode:'realtime',limits:{maxWidth:1920,maxHeight:1320,fps:30,jpegQuality:92}}];s.selectedId='native';const action=createActions(root,s,async()=>{});
 await action(null,{action:'playback',maxWidth:1920,fps:24});assert.deepEqual(s.library[0].limits,{maxWidth:1920,maxHeight:1320,fps:24,jpegQuality:92});await action(null,{action:'playback',maxWidth:1280,fps:30});assert.equal(s.library[0].limits.maxHeight,880);assert.equal(s.library[0].limits.jpegQuality,92);
});
test('native full-effects confirmation exits an existing static native entry',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-native-static-')),project=path.join(root,'project');await mkdir(project);await writeFile(path.join(project,'project.json'),JSON.stringify({type:'scene',title:'Fixture'}));
 const s=defaultSettings();s.library=[{id:'native',mode:'realtime',projectRoot:project,sourceKey:(await describeProject(project)).sourceKey,displayTier:'static',staticFile:'media/still.png',limits:{maxWidth:1280,fps:30}}];s.selectedId='native';
 const owner={},action=createActions(root,s,async()=>{assert.notEqual(s.library[0].displayTier,'static');});const pending=await action(owner,{action:'display-native'});await action(owner,{action:'wallpaper-engine-confirm',confirmationToken:pending.confirmation.token,confirmed:true});assert.equal(s.library[0].mode,'realtime');assert.equal(s.library[0].displayTier,'full');assert.equal(s.library[0].limits.jpegQuality,92);assert.equal(s.library.length,1);
});
