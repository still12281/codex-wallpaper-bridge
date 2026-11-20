// Optional isolated browser test. It never attaches to a real Codex session.
import {mkdtemp,mkdir,writeFile,access,copyFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {installMediaActivity} from '../src/media-power.mjs';
import {mountWebWallGL} from '../src/webwallgl-player.mjs';
import {installWallpaperPointer} from '../src/wallpaper-pointer.mjs';
import {getDataRoot,findCommand} from '../src/runtime-paths.mjs';
const temp=await mkdtemp(path.join(os.tmpdir(),'cwb-webgl-')),project=path.join(temp,'project');await mkdir(project);
await writeFile(path.join(project,'project.json'),JSON.stringify({type:'scene',title:'Synthetic scene',file:'scene.json',general:{properties:{gain:{type:'slider',value:.35,min:0,max:1},internal:{type:'bool',value:true,editable:false}}}}));
await writeFile(path.join(project,'scene.json'),JSON.stringify({camera:{center:'0 0 -1',eye:'0 0 0',up:'0 1 0'},general:{clearcolor:'0.2 0.4 0.6',orthogonalprojection:{width:640,height:360}},objects:[]}));
const html=path.join(temp,'shell.html');await writeFile(html,'<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; frame-src blob:; script-src &apos;self&apos; &apos;unsafe-eval&apos; blob:; style-src &apos;unsafe-inline&apos;; img-src blob: data:; worker-src blob:"><title>Synthetic sandbox test</title><main>Generated fixture</main>');
let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME||findCommand('chrome');if(!chrome)for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){const candidate=path.join(base,'Google/Chrome/Application/chrome.exe');try{await access(candidate);chrome=candidate;break;}catch{}}
if(!chrome)throw Error('Set CODEX_WALLPAPER_TEST_CHROME');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));
const url=pathToFileURL(html).href,browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--enable-unsafe-swiftshader','--remote-debugging-port='+port,'--user-data-dir='+path.join(temp,'profile'),url],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let c,player,targetSocket;const result={kind:'isolated-synthetic-webwallgl-not-native-codex'};
try{
 for(let i=0;i<100;i++){try{const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url);if(target){targetSocket=target.webSocketDebuggerUrl;c=await connectCdp(targetSocket);break;}}catch{}await sleep(100);}
 assert(c);for(let i=0;i<50&&await c.evaluate('document.readyState')!=='complete';i++)await sleep(100);player=await mountWebWallGL(c,{id:'synthetic',projectRoot:project,userProperties:{gain:.7},limits:{maxWidth:640,fps:24}},{dataRoot:getDataRoot(),config:{},probe:true});
 const first=await player.sample();result.firstFrame=first;assert(first.ready);assert(first.width<=640);assert(first.height>0);
 const signature=await player.signature();assert(signature?.startsWith('data:image/png'));result.pixelReadback=true;
 assert.deepEqual(await player.getProperties(),{gain:.7,internal:true});const updated=await player.setProperties({gain:.9,internal:true});assert.equal(updated.gain,.9);result.initialAndLiveAuthorProperties=true;
 await c.call('Emulation.setDeviceMetricsOverride',{width:2200,height:1400,deviceScaleFactor:1,mobile:false});await sleep(400);assert((await player.sample()).width<=640);result.resizeBounded=true;
 await player.pointer(.25,.75);result.pointerCall=true;await player.pause(true);const held=await player.sample();assert(held.paused&&held.frozen&&held.frameReadyHook);result.pause=true;
 await player.pause(false);for(let i=0;i<20&&(await player.sample()).frozen;i++)await sleep(50);const resumed=await player.sample();assert(!resumed.paused&&!resumed.frozen);result.resume=true;
 await player.dispose();assert.equal(await c.evaluate('document.querySelectorAll("[data-cwb-renderer-id]").length'),0);result.dispose=true;
 const broken=path.join(temp,'broken');await mkdir(broken);await writeFile(path.join(broken,'project.json'),JSON.stringify({type:'scene'}));await assert.rejects(mountWebWallGL(c,{id:'missing',projectRoot:broken},{dataRoot:getDataRoot(),config:{},probe:true}),/没有可读取的场景包/);assert.equal(await c.evaluate('document.querySelectorAll("[data-cwb-renderer-id]").length'),0);result.failedMountCleaned=true;
 const countListeners=async expression=>{const object=(await c.call('Runtime.evaluate',{expression,returnByValue:false})).result.objectId;const listeners=(await c.call('DOMDebugger.getEventListeners',{objectId:object})).listeners;await c.call('Runtime.releaseObject',{objectId:object});return listeners.length;};const before=[await countListeners('window'),await countListeners('document')];
 const activeEntry={id:'active',projectRoot:project,limits:{maxWidth:640,fps:24}},activeConfig={pauseOnBlur:false,systemMedia:{audio:true},palette:{r:20,g:22,b:28,dark:true}};
 player=await mountWebWallGL(c,activeEntry,{dataRoot:getDataRoot(),config:activeConfig});const activeId=await c.evaluate('window.__codexWallpaperBridge.rendererId');
 const disconnected=new Promise(resolve=>c.ws.addEventListener('close',resolve,{once:true}));c.close();await disconnected;c=await connectCdp(targetSocket);
 player=await mountWebWallGL(c,activeEntry,{dataRoot:getDataRoot(),config:activeConfig,reconnect:true});
 assert.equal(player.id,activeId);assert(player.startup.reusedScene);assert(await player.signature());result.sameSceneAfterSocketClose=true;
 await c.evaluate('window.__codexWallpaperBridge.setSystemSpectrum({audioAvailable:true,bands:Array(64).fill(128)});true');await sleep(100);assert.equal((await player.sample()).systemAudioActive,true);await c.evaluate('window.__codexWallpaperBridge.setSystemSpectrum({audioAvailable:false,bands:Array(64).fill(0)});true');await sleep(100);assert.equal((await player.sample()).systemAudioActive,false);result.systemSpectrumAttachDetach=true;
 await c.evaluate('window.__testMediaActivity=[];window.__cwbMediaActivitySend=p=>window.__testMediaActivity.push(JSON.parse(p));('+installMediaActivity.toString()+')(' + JSON.stringify('test-token')+');true');
 assert.equal(await c.evaluate('window.__testMediaActivity.at(-1).active'),true);
 await c.evaluate('window.__codexWallpaperBridge.setPauseOnBlur(true);true');await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await sleep(200);
 assert.equal(await c.evaluate('window.__testMediaActivity.at(-1).active'),false);assert.equal((await player.sample()).systemAudioActive,false);
 await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await c.evaluate('window.__codexWallpaperBridge.setPauseOnBlur(false);true');await sleep(200);assert.equal(await c.evaluate('window.__testMediaActivity.at(-1).active'),true);
 await c.evaluate('window.__codexWallpaperBridge.supportsAudio=false;window.__cwbMediaActivity.report();true');assert.equal(await c.evaluate('window.__testMediaActivity.at(-1).audio'),false);assert.equal(await c.evaluate('window.__testMediaActivity.at(-1).active'),true);
 await c.evaluate('window.__cwbMediaActivity.dispose();delete window.__cwbMediaActivity;true');result.mediaActivityPauseResume=true;
 await assert.rejects(mountWebWallGL(c,{id:'broken',projectRoot:broken},{dataRoot:getDataRoot(),config:{}}),/没有可读取的场景包/);assert.equal(await c.evaluate('window.__codexWallpaperBridge.rendererId'),activeId);assert(await c.evaluate('window.__codexWallpaperBridge.ready'));result.failedSwapRetainsActive=true;
 const engineBefore=process.env.CODEX_WALLPAPER_WEBWALLGL,mockEngine=path.join(temp,'failed-effect-engine.js');await writeFile(mockEngine,'globalThis.WebWallGL={createScene(host,o){const canvas=document.createElement("canvas");canvas.width=canvas.height=32;host.append(canvas);o.onReady();o.onDiagnostic("跳过效果（pass 编译失败）：fixture-critical-effect","warn");return {stats:{running:true},on(){},load:async()=>{},destroy(){},pause(){},resume(){}}}}');process.env.CODEX_WALLPAPER_WEBWALLGL=mockEngine;
 try{await assert.rejects(mountWebWallGL(c,{id:'failed-effect',projectRoot:project},{dataRoot:getDataRoot(),config:{}}),/场景关键效果失败/);assert.equal(await c.evaluate('window.__codexWallpaperBridge.rendererId'),activeId);assert.equal(await c.evaluate('document.querySelectorAll("[data-cwb-renderer-id]").length'),1);result.failedEffectCannotReplaceActive=true;}finally{if(engineBefore===undefined)delete process.env.CODEX_WALLPAPER_WEBWALLGL;else process.env.CODEX_WALLPAPER_WEBWALLGL=engineBefore;}
 await player.dispose();assert.deepEqual([await countListeners('window'),await countListeners('document')],before);result.listenersRestored=true;
 const fontFile=process.env.CODEX_WALLPAPER_TEST_FONT||(process.platform==='win32'?path.join(process.env.WINDIR||'C:/Windows','Fonts/arial.ttf'):null);
 if(fontFile){const fontProject=path.join(temp,'font-project');await mkdir(path.join(fontProject,'fonts'),{recursive:true});await copyFile(fontFile,path.join(fontProject,'fonts/test.ttf'));await writeFile(path.join(fontProject,'project.json'),JSON.stringify({type:'scene',file:'scene.json'}));await writeFile(path.join(fontProject,'scene.json'),JSON.stringify({general:{clearcolor:'0.1 0.2 0.3',orthogonalprojection:{width:640,height:360}},objects:[{id:1,text:'Font fixture',font:'fonts/test.ttf',pointsize:48,origin:'320 180 0',size:'600 160',color:'1 1 1'}]}));player=await mountWebWallGL(c,{id:'font-fixture',projectRoot:fontProject,limits:{maxWidth:640,fps:24}},{dataRoot:getDataRoot(),config:{},probe:true});const fontSample=await player.sample();assert(fontSample.fontBufferAdapter&&fontSample.fontsLoaded===1);await player.dispose();result.fontBufferWithUrlFontCspDisabled=true;}
 await c.evaluate('window.__pointerMessages=[];window.__disposePointer=('+installWallpaperPointer.toString()+')(message=>window.__pointerMessages.push(message),{fps:24,type:"scene"});window.__pointerDefaultAllowed=document.body.dispatchEvent(new PointerEvent("pointerdown",{clientX:100,clientY:100,buttons:1,ctrlKey:true,bubbles:true,cancelable:true}));document.body.dispatchEvent(new PointerEvent("pointerup",{clientX:100,clientY:100,buttons:0,ctrlKey:true,bubbles:true}));true');
 assert.equal(await c.evaluate('window.__pointerMessages.at(-1).pointer[2]'),1);await sleep(70);assert.equal(await c.evaluate('window.__pointerMessages.at(-1).pointer[2]'),0);assert.equal(await c.evaluate('window.__pointerMessages.find(m=>m.pointer?.[2]===1).pointer[3]'),1);assert(await c.evaluate('window.__pointerDefaultAllowed'));
 await c.evaluate('const input=document.createElement("div");input.contentEditable="true";document.body.append(input);input.dispatchEvent(new PointerEvent("pointerdown",{clientX:50,clientY:50,buttons:1,bubbles:true}));input.remove();true');assert.equal(await c.evaluate('window.__pointerMessages.at(-1).pointer[2]'),0);await c.evaluate('document.body.dispatchEvent(new PointerEvent("pointermove",{clientX:200,clientY:150,buttons:1,bubbles:true}));true');await sleep(40);assert.equal(await c.evaluate('window.__pointerMessages.at(-1).pointer[2]'),0);await c.evaluate('document.body.dispatchEvent(new PointerEvent("pointerup",{buttons:0,bubbles:true}));dispatchEvent(new Event("blur"));true');assert(await c.evaluate('window.__pointerMessages.at(-1).pointerLeave'));await c.evaluate('window.__disposePointer();delete window.__disposePointer;true');assert.deepEqual([await countListeners('window'),await countListeners('document')],before);result.pointerEdgesModifiersAndChatExclusion=true;await c.evaluate('(()=>{const box=document.createElement("div");box.id="pointer-box";box.style.cssText="position:fixed;left:-100px;top:-50px;width:1000px;height:500px";document.body.append(box);window.__pointerCrop=[];window.__cropDispose=('+installWallpaperPointer.toString()+')(m=>__pointerCrop.push(m),{bounds:()=>box.getBoundingClientRect()});document.body.dispatchEvent(new PointerEvent("pointerdown",{clientX:100,clientY:100,buttons:1,bubbles:true}));return true})()');assert.deepEqual(await c.evaluate('window.__pointerCrop.at(-1).pointer.slice(0,2)'),[.2,.3]);await c.evaluate('__cropDispose();document.getElementById("pointer-box").remove();true');result.pointerMapsCroppedFrameBounds=true;
 const pointerBatch=await c.call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const tab=document.createElement('button'),messages=[];
  tab.setAttribute('role','tab');document.body.append(tab);
  let reads=0;
  const dispose=(${installWallpaperPointer.toString()})(message=>messages.push(message),{
   bounds:()=>{reads++;return {left:-100,top:-50,width:1000,height:500};}
  });
  try{
   for(let i=0;i<12;i++)tab.dispatchEvent(new PointerEvent('pointermove',{clientX:i,clientY:20,bubbles:true}));
   tab.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,buttons:1,bubbles:true}));
   tab.dispatchEvent(new PointerEvent('pointerup',{clientX:100,clientY:100,pointerId:1,buttons:0,shiftKey:true,bubbles:true}));
   const during=reads;
   await new Promise(resolve=>requestAnimationFrame(resolve));
   return {during,reads,pointer:messages.map(m=>m.pointer)};
  }finally{dispose();tab.remove();}
 })()`});
 assert.deepEqual(pointerBatch.result.value,{during:0,reads:1,pointer:[[.2,.3,0,2]]});
 result.nativePointerInputDoesNotFlushGeometry=true;result.passed=true;
}catch(error){result.error=error.stack;process.exitCode=1;}finally{await player?.dispose();if(c){await c.call('Browser.close').catch(()=>{});c.close();}browser.kill();console.log(JSON.stringify(result,null,2));}
