import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {defaultSettings,getDataRoot,loadSettings} from '../src/runtime-paths.mjs';
import {createEngineCatalog} from '../src/engine-library.mjs';
import {currentEngineSource} from '../src/wallpaper-engine-source.mjs';
import {removeManagedFile} from '../src/media-store.mjs';
import {createActions,normalizeLibrary} from '../src/wallpaper-actions.mjs';
const temp=()=>mkdtemp(path.join(os.tmpdir(),'cwb-unit-'));

test('fresh settings contain no personal wallpaper and keep an empty library',async()=>{
 const root=await temp(),settings=await loadSettings(root);assert.deepEqual(settings.library,[]);normalizeLibrary(settings);assert.deepEqual(settings.library,[]);assert.equal(settings.selectedId,null);assert.deepEqual(settings.engineSearch,{scope:'global',kind:'engine',folder:''});assert.deepEqual(JSON.parse(await readFile(path.join(root,'settings.json'),'utf8')),settings);
});
test('custom data root is normalized and relative roots are rejected',()=>{
 const previous=process.env.CODEX_WALLPAPER_DATA_DIR;try{process.env.CODEX_WALLPAPER_DATA_DIR=path.join(os.tmpdir(),'cwb-data')+path.sep;assert.equal(getDataRoot(),path.join(os.tmpdir(),'cwb-data'));process.env.CODEX_WALLPAPER_DATA_DIR='relative-folder';assert.throws(getDataRoot,/absolute/)}finally{if(previous===undefined)delete process.env.CODEX_WALLPAPER_DATA_DIR;else process.env.CODEX_WALLPAPER_DATA_DIR=previous}
});
test('folder project and ordinary media searches stay separate',async()=>{
 const root=await temp();await mkdir(path.join(root,'project'));await writeFile(path.join(root,'project','project.json'),JSON.stringify({title:'Synthetic project',type:'image',file:'sample.png'}));await writeFile(path.join(root,'project','sample.png'),'synthetic parser fixture');
 const catalog=createEngineCatalog(),projects=await catalog.search({scope:'folder',folder:root});assert.equal(projects.wallpapers.length,1);const selected=await catalog.resolve(projects.wallpapers[0].token);assert.equal(selected.workshopId,undefined);assert.equal(selected.kind,'engine');const source=await currentEngineSource(root,'fixture',undefined,selected.root);assert.equal(source.workshopId,undefined);assert(source.sourceKey);
 const media=await catalog.search({scope:'folder',kind:'media',folder:root});assert.equal(media.wallpapers.length,1);assert.equal((await catalog.resolve(media.wallpapers[0].token)).kind,'media');await assert.rejects(catalog.search({scope:'global',kind:'media'}),/指定文件夹/);await assert.rejects(catalog.resolve('unissued-token'),/过期/);
});
test('project paths cannot escape through traversal or a junction',async()=>{
 const root=await temp();await mkdir(path.join(root,'project'));await mkdir(path.join(root,'outside'));await writeFile(path.join(root,'outside','sample.png'),'fixture');await writeFile(path.join(root,'project','project.json'),JSON.stringify({title:'Traversal fixture',type:'image',file:'../outside/sample.png'}));await assert.rejects(currentEngineSource(root,'fixture',undefined,path.join(root,'project')),/路径不受支持/);
 await symlink(path.join(root,'outside'),path.join(root,'project','linked'),process.platform==='win32'?'junction':'dir');await writeFile(path.join(root,'project','project.json'),JSON.stringify({title:'Link fixture',type:'image',file:'linked/sample.png'}));await assert.rejects(currentEngineSource(root,'fixture',undefined,path.join(root,'project')),/路径不受支持/);
 const items=await createEngineCatalog().search({scope:'folder',folder:path.join(root,'project'),kind:'media'});assert.equal(items.wallpapers.length,0);
});
test('managed deletion preserves referenced and external files',async()=>{
 const root=await temp();await mkdir(path.join(root,'media'));const file='media/shared.mp4';await writeFile(path.join(root,file),'fixture');const settings=defaultSettings();settings.library=[{id:'one',file}];assert.equal(await removeManagedFile(root,settings,file),false);settings.library=[];const outside=path.join(await temp(),'original.mp4');await writeFile(outside,'outside');assert.equal(await removeManagedFile(root,settings,outside),false);await stat(outside);assert.equal(await removeManagedFile(root,settings,file),true);await assert.rejects(stat(path.join(root,file)),{code:'ENOENT'});
});
test('deleting the last entry keeps an empty library and only unlinks its own copies',async()=>{
 const root=await temp();await mkdir(path.join(root,'media'));await writeFile(path.join(root,'media','one.mp4'),'fixture');const outside=path.join(await temp(),'source.mp4');await writeFile(outside,'outside');const settings=defaultSettings();settings.library=[{id:'one',name:'Synthetic video',file:'media/one.mp4',sourcePath:outside,mime:'video/mp4'}];settings.selectedId='one';let applied=0;const actions=createActions(root,settings,async()=>{applied++});await actions({}, {action:'delete',selectedId:'one'});assert.equal(applied,1);assert.deepEqual(settings.library,[]);assert.equal(settings.selectedId,null);await stat(outside);assert.deepEqual(JSON.parse(await readFile(path.join(root,'settings.json'),'utf8')).library,[]);
});
