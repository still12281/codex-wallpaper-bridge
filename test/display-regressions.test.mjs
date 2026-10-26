import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {appearancePalette,sanitizeVisual,parsePreset} from '../src/appearance-model.mjs';
import {createActions} from '../src/wallpaper-actions.mjs';
import {defaultSettings} from '../src/runtime-paths.mjs';
test('manual transparent-interface theme overrides sampling without overwriting its palette',()=>{
 const s=defaultSettings();s.palette={r:245,g:245,b:245,dark:false};const saved={...s.palette};s.visual=sanitizeVisual({...s.visual,theme:'dark',glassBlur:0,glassOpacity:.8});assert.equal(appearancePalette(s).dark,true);assert.deepEqual(s.palette,saved);
 s.visual.theme='auto';assert.deepEqual(appearancePalette(s),saved);s.visual.theme='light';assert.equal(appearancePalette(s).dark,false);assert.throws(()=>sanitizeVisual({theme:'invalid'}));
 const parsed=parsePreset(JSON.stringify({format:'codex-wallpaper-appearance',version:1,name:'Theme',appearance:{visual:s.visual,darkOverlay:.4,lightOverlay:.4,pauseOnBlur:true}}));assert.equal(parsed.appearance.visual.theme,'light');assert.equal(parsed.appearance.visual.glassBlur,0);assert.equal(parsed.appearance.visual.glassOpacity,.8);
});
test('independent scene quality uses custom mode and rolls back failures without erasing preferences',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-scene-quality-')),s=defaultSettings();s.library=[{id:'scene',mode:'webwallgl',displayTier:'balanced',quality:{postProcessing:'medium'},customDisplay:{limits:{maxWidth:960,fps:12}}}];s.selectedId='scene';s.systemMedia.audio=true;let fail=false;
 const action=createActions(root,s,async()=>{if(fail){fail=false;throw Error('shader failed');}},undefined,{configureMedia:async()=>{}}),values={action:'scene-quality',postProcessing:'low',particles:'medium',antiAliasing:'fxaa',videoTexScale:.75};
 await action(null,values);assert.equal(s.library[0].displayTier,'custom');assert.equal(s.library[0].customDisplay,undefined);assert.equal(s.library[0].quality.particles,'medium');assert.equal(s.systemMedia.audio,true);
 const saved=structuredClone(s.library[0]);fail=true;await assert.rejects(action(null,{...values,postProcessing:'high'}),/shader failed/);assert.deepEqual(s.library[0],saved);
 await assert.rejects(action(null,{...values,postProcessing:'off'}),/参数无效/);s.library[0].displayTier='static';await assert.rejects(action(null,values),/先启用/);
});
