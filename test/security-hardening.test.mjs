import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {createActions,normalizeLibrary} from '../src/wallpaper-actions.mjs';
import {defaultSettings} from '../src/runtime-paths.mjs';
import {nextRotation,rotationCandidates} from '../src/appearance-model.mjs';
import {wallpaperRenderKey} from '../src/library-model.mjs';
import {summarizeFrameNavigationFailure} from '../src/webwallgl-player.mjs';
import {MAX_WEB_HTML_BYTES,createBoundedHtmlHandler} from '../src/browser-web-source.mjs';
import {createServeKit} from '../vendor/dsh-wallpaper/serve.js';

const execFileAsync=promisify(execFile);

test('P0-1: save-only realtime entries require one confirmation on first manual apply and are skipped by rotation until approved',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-first-run-')),project=path.join(root,'scene');
 await mkdir(project);
 await writeFile(path.join(project,'project.json'),JSON.stringify({type:'scene',title:'Neon City',file:'scene.json'}));
 const settings=defaultSettings();
 settings.library=[{id:'img',name:'Still',file:'media/still.png',mime:'image/png'}];
 settings.selectedId='img';
 normalizeLibrary(settings);
 let applies=0,failApply=false;
 const actions=createActions(root,settings,async()=>{applies++;if(failApply)throw Error('renderer failed');}),owner={};
 const catalog=await actions(owner,{action:'engine-list',scope:'folder',folder:project});
 const token=catalog.wallpapers[0].token;

 // 1. Save-only does not prompt, marks needsRunConfirmation, and leaves current wallpaper unchanged.
 const saved=await actions(owner,{action:'wallpaper-engine',projectToken:token,renderMode:'webwallgl',apply:false});
 assert.equal(saved.confirmation,undefined);
 assert.equal(applies,0);
 assert.equal(settings.selectedId,'img');
 const webgl=settings.library.find(e=>e.mode==='webwallgl');
 assert(webgl);
 assert.equal(webgl.needsRunConfirmation,true);

 // 2. Rotation skips unconfirmed realtime entries; direct unconfirmed background select is refused.
 assert.deepEqual(rotationCandidates(settings).map(g=>g.id),['img']);
 assert.equal(nextRotation(settings),null);
 const rotResult=await actions(null,{action:'rotation-next'});
 assert.equal(settings.selectedId,'img');
 assert.equal(applies,0);
 assert.match(rotResult.message,/至少需要两个/);

 // 3. First manual apply returns one confirmation; failed apply rolls back and keeps needsRunConfirmation.
 const firstSelect=await actions(owner,{action:'select',selectedId:webgl.id});
 assert.equal(firstSelect.confirmation.firstRun,true);
 assert.equal(firstSelect.confirmation.entryId,webgl.id);
 assert.equal(firstSelect.confirmation.renderer,'webwallgl');
 assert.equal(actions.isRendererConfirmation(owner,{action:'wallpaper-engine-confirm',confirmationToken:firstSelect.confirmation.token,confirmed:true}),true);
 assert.equal(applies,0);

 failApply=true;
 await assert.rejects(actions(owner,{action:'wallpaper-engine-confirm',confirmationToken:firstSelect.confirmation.token,confirmed:true}),/renderer failed/);
 assert.equal(settings.selectedId,'img');
 assert.equal(webgl.needsRunConfirmation,true);
 failApply=false;

 // 4. Confirming once succeeds, clears and persists authorization; subsequent selects and rotation do not prompt.
 const retrySelect=await actions(owner,{action:'select',selectedId:webgl.id});
 const confirmed=await actions(owner,{action:'wallpaper-engine-confirm',confirmationToken:retrySelect.confirmation.token,confirmed:true});
 assert.equal(confirmed.confirmation,undefined);
 assert.equal(webgl.needsRunConfirmation,undefined);
 assert.equal(settings.selectedId,webgl.id);
 const persisted=JSON.parse(await readFile(path.join(root,'settings.json'),'utf8'));
 assert.equal(persisted.library.find(e=>e.id===webgl.id).needsRunConfirmation,undefined);

 await actions(owner,{action:'select',selectedId:'img'});
 const secondSelect=await actions(owner,{action:'select',selectedId:webgl.id});
 assert.equal(secondSelect.confirmation,undefined);
 assert.equal(settings.selectedId,webgl.id);
 assert.deepEqual(rotationCandidates(settings).map(g=>g.id),['img',webgl.id]);

 // 5. Separate renderer for the same project tracks authorization independently.
 const savedNative=await actions(owner,{action:'wallpaper-engine',projectToken:token,renderMode:'realtime',apply:false});
 assert.equal(savedNative.confirmation,undefined);
 const nativeEntry=settings.library.find(e=>e.mode==='realtime');
 assert(nativeEntry);
 assert.equal(nativeEntry.needsRunConfirmation,true);
 assert.equal(nextRotation(settings).id,'img');
 const nativeConfirm=await actions(owner,{action:'select',selectedId:nativeEntry.id});
 assert.equal(nativeConfirm.confirmation.renderer,'native');
 assert.equal(nativeConfirm.confirmation.firstRun,true);
});

test('P0-1: legacy saved realtime entries remain authorized and wallpaperRenderKey ignores needsRunConfirmation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-legacy-auth-')),settings=defaultSettings();
 const legacy={id:'legacy-gpu',name:'Old GPU',mode:'webwallgl',projectRoot:root,limits:{maxWidth:1280,fps:24}};
 settings.library=[{id:'a',file:'media/a.png'},legacy];
 settings.selectedId='a';
 normalizeLibrary(settings);
 assert.equal(legacy.needsRunConfirmation,undefined);
 assert.equal(nextRotation(settings).id,'legacy-gpu');
 assert.equal(wallpaperRenderKey(legacy,false),wallpaperRenderKey({...legacy,needsRunConfirmation:true},false));
 let applies=0;
 const actions=createActions(root,settings,async()=>{applies++;});
 const res=await actions({},{action:'select',selectedId:'legacy-gpu'});
 assert.equal(res.confirmation,undefined);
 assert.equal(applies,1);
 assert.equal(settings.selectedId,'legacy-gpu');
});

test('P0-3: Install.cmd ignores fake pwsh.exe and winget.exe in the current working directory',async()=>{
 if(process.platform!=='win32')return;
 const temp=await mkdtemp(path.join(os.tmpdir(),'cwb-install-cmd-'));
 const fakeProg=path.join(temp,'prog'),fakeLocal=path.join(temp,'local'),emptyPathDir=path.join(temp,'empty');
 await mkdir(fakeProg);await mkdir(fakeLocal);await mkdir(emptyPathDir);
 await copyFile(path.resolve('Install.cmd'),path.join(temp,'Install.cmd'));
 // Place decoy executables in cwd; they must never run even if cwd is also on PATH.
 await writeFile(path.join(temp,'pwsh.exe'),'decoy');
 await writeFile(path.join(temp,'winget.exe'),'decoy');
 const baseEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>!['path','codex_wallpaper_pwsh','programfiles','localappdata'].includes(k.toLowerCase())));
 const env={
  ...baseEnv,
  ProgramFiles:fakeProg,
  LOCALAPPDATA:fakeLocal,
  PATH:emptyPathDir+';'+temp
 };
 const cmdExe=process.env.ComSpec||path.join(process.env.SystemRoot||'C:\\Windows','System32','cmd.exe');
 await assert.rejects(
  execFileAsync(cmdExe,['/d','/c','Install.cmd','-CheckOnly','-NoPause'],{cwd:temp,env,windowsHide:true}),
  error=>{
   assert.equal(error.code,1);
   assert.match(error.stdout,/PowerShell 7 is required/);
   return true;
  }
 );
});

test('P0-4: WebWallGL frame navigation diagnostic omits unrelated iframe URLs, query parameters, and titles',()=>{
 const candidateUrl='blob:app://-/11111111-2222-3333-4444-555555555555';
 const summary=summarizeFrameNavigationFailure({
  dom:{ready:'complete',layer:true,framePresent:true,frameMatchesCandidate:true},
  frameTree:{
   frame:{url:'app://-/index.html?session=secret-top'},
   childFrames:[
    {frame:{url:'https://private.example/embed?token=super-secret-123'}},
    {frame:{url:'about:blank'},childFrames:[{frame:{url:'https://other.example/?auth=leak'}}]}
   ]
  },
  targetInfos:[
   {type:'iframe',title:'Private OAuth Window',url:'https://auth.example/callback?code=xyz987'},
   {type:'page',title:'Main',url:'app://-/index.html'}
  ],
  candidateUrl
 });
 const serialized=JSON.stringify(summary);
 assert.equal(summary.reason,'wallpaper-frame-not-navigated');
 assert.equal(summary.layerFound,true);
 assert.equal(summary.framePresent,true);
 assert.equal(summary.frameMatchesCandidate,true);
 assert.equal(summary.frameTreeChildCount,3);
 assert.equal(summary.frameTreeMatches,0);
 assert.equal(summary.iframeTargetCount,1);
 assert.equal(summary.iframeTargetMatches,0);
 assert(!serialized.includes('secret'));
 assert(!serialized.includes('auth.example'));
 assert(!serialized.includes('Private OAuth'));
 assert(!serialized.includes('xyz987'));
 assert(!serialized.includes(candidateUrl));
});

test('P1-5: searchEngine and pickEngineFolder run independently from config commit',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-search-split-')),project=path.join(root,'scene');
 await mkdir(project);
 await writeFile(path.join(project,'project.json'),JSON.stringify({type:'scene',title:'Split Test'}));
 const settings=defaultSettings();
 normalizeLibrary(settings);
 let pickedInitial=null;
 const actions=createActions(root,settings,async()=>{},async()=>{},{
  pickFolder:async initial=>{pickedInitial=initial;return {folder:project,cancelled:false};}
 });
 // Scan does not mutate settings until commitEngineSearch runs.
 const {search,result}=await actions.searchEngine({scope:'folder',folder:project,kind:'engine'});
 assert.equal(result.wallpapers.length,1);
 assert.equal(settings.engineSearch.folder,'');
 await actions.commitEngineSearch(search);
 assert.equal(settings.engineSearch.folder,project);
 const picked=await actions.pickEngineFolder();
 assert.equal(pickedInitial,project);
 assert.equal(picked.folder,project);
});

test('P1-6: browser-web-source enforces 8 MiB async bounded read for all HTML files without modifying vendor/serve.js',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-serve-html-'));
 const projectJson=path.join(root,'project.json');
 await writeFile(projectJson,JSON.stringify({type:'web',file:'index.html'}));
 await writeFile(path.join(root,'index.html'),'<!doctype html><html><head></head><body>ok</body></html>');
 await writeFile(path.join(root,'sub.html'),'<!doctype html><html><head></head><body>sub</body></html>');
 await writeFile(path.join(root,'asset.txt'),'plain-asset');
 // Create auxiliary HTML files exceeding 8 MiB (8 MiB + 1 byte).
 const oversized=Buffer.alloc(MAX_WEB_HTML_BYTES+1,'a');
 await writeFile(path.join(root,'huge.html'),oversized);
 await writeFile(path.join(root,'huge.HTM'),oversized);
 const token='tok1',BASE='/wallpaper-engine',assetPrefix=BASE+'/scene-files/'+token+'/',activeStreams=new Set(),notes=[];
 const readWebShim=()=>'window.__shim=1;',buildSeedScript=()=>'window.__seed=1;';
 const kit=createServeKit({
  BASE,
  activeStreams,
  mediaMap:new Map([[token,projectJson]]),
  log:{warn:msg=>notes.push(['warn',msg])},
  appendDiagLine:()=>{},
  traceRequests:()=>{},
  traceMediaRequests:()=>{},
  readWebShim,
  buildSeedScript
 });
 const serveBoundedHtml=createBoundedHtmlHandler({
  root,
  assetPrefix,
  BASE,
  token,
  activeStreams,
  maxHtmlBytes:MAX_WEB_HTML_BYTES,
  readWebShim,
  buildSeedScript,
  note:(kind,detail)=>notes.push([kind,detail])
 });
 const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://local').pathname;
  if(serveBoundedHtml(req,res,pathname))return;
  kit.handleSceneFiles(req,res,'media');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  const okRes=await fetch(origin+assetPrefix+'sub.html');
  assert.equal(okRes.status,200);
  const okBody=await okRes.text();
  assert(okBody.includes('window.__shim=1;'));
  assert(okBody.includes('window.__seed=1;'));
  assert(okBody.includes('sub'));

  const hugeHtml=await fetch(origin+assetPrefix+'huge.html');
  assert.equal(hugeHtml.status,413);
  assert.equal(hugeHtml.headers.get('cache-control'),'no-store');

  const hugeHtm=await fetch(origin+assetPrefix+'huge.HTM');
  assert.equal(hugeHtm.status,413);

  const missing=await fetch(origin+assetPrefix+'missing.html');
  assert.equal(missing.status,404);

  const escaped=await fetch(origin+assetPrefix+'..%2Foutside.html');
  assert.equal(escaped.status,403);

  const asset=await fetch(origin+assetPrefix+'asset.txt');
  assert.equal(asset.status,200);
  assert.equal(await asset.text(),'plain-asset');

  assert(notes.some(([kind])=>kind==='html-limit'));
  assert.equal(activeStreams.size,0);
 }finally{
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
 }
});
