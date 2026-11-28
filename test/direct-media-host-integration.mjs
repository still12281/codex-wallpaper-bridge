// Isolated host/Chromium: validates direct external image/MP4 playback, strict video muting,
// missing-source rollback, rotation skipping, and startup panel recovery without touching Codex.
import {mkdtemp,mkdir,writeFile,readFile,readdir,realpath,rename,access} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:net';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {findFFmpeg,findCommand,defaultSettings} from '../src/runtime-paths.mjs';

const run=promisify(execFile);
const temp=await mkdtemp(path.join(os.tmpdir(),'cwb-direct-host-'));
const data=path.join(temp,'data'),ext=path.join(temp,'external');
await mkdir(path.join(data,'media'),{recursive:true});await mkdir(ext);

const ffmpeg=await findFFmpeg();
const mp4Audio=path.join(ext,'direct-audio.mp4'),pngA=path.join(ext,'direct-a.png'),pngB=path.join(ext,'direct-b.png');
await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-f','lavfi','-i','sine=frequency=440','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',mp4Audio],{windowsHide:true});
await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','color=c=0x225588:s=160x90:d=1','-frames:v','1',pngA],{windowsHide:true});
await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','color=c=0x448833:s=160x90:d=1','-frames:v','1',pngB],{windowsHide:true});

const cMp4=await realpath(mp4Audio),cPngA=await realpath(pngA),cPngB=await realpath(pngB);
const config=defaultSettings();
config.pauseOnBlur=false;
config.visual.volume=0.8;
config.library=[
 {id:'ext-png-a',name:'Direct PNG A',file:cPngA,sourcePath:cPngA,sourceMime:'image/png',mime:'image/png',limits:{maxWidth:1280,maxHeight:900,fps:null,maxBytes:32*1024*1024,muted:true},importInfo:{route:'direct',direct:true}},
 {id:'ext-mp4',name:'Direct Audio MP4',file:cMp4,sourcePath:cMp4,sourceMime:'video/mp4',mime:'video/mp4',limits:{maxWidth:1280,maxHeight:900,fps:24,muted:true,fileBacked:true},importInfo:{route:'direct',direct:true}},
 {id:'ext-png-b',name:'Direct PNG B',file:cPngB,sourcePath:cPngB,sourceMime:'image/png',mime:'image/png',limits:{maxWidth:1280,maxHeight:900,fps:null,maxBytes:32*1024*1024,muted:true},importInfo:{route:'direct',direct:true}}
];
config.selectedId='ext-mp4';
await writeFile(path.join(data,'settings.json'),JSON.stringify(config,null,2));

const html=path.join(temp,'shell.html');
await writeFile(html,'<!doctype html><html><body><div class="_ApplicationMenuTopBar_"><nav role="menubar"></nav></div><aside class="app-shell-left-panel"></aside><main data-app-shell-main-surface></main></body></html>');
const url=pathToFileURL(html).href;

let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME||findCommand('chrome');
if(!chrome){for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){const candidate=path.join(base,'Google','Chrome','Application','chrome.exe');try{await access(candidate);chrome=candidate;break;}catch{}}}
if(!chrome)throw Error('Chrome/Chromium not found. Set CODEX_WALLPAPER_TEST_CHROME.');

const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const browser=spawn(chrome,['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(temp,'profile'),url],{windowsHide:true,stdio:'ignore'});
let c,host,errors='';
const result={kind:'isolated-host-direct-external-media-not-native-codex'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,timeout=30000)=>{const end=Date.now()+timeout;while(Date.now()<end){try{const v=await fn();if(v)return v;}catch{}await sleep(50);}throw Error('Direct external media host test timed out');};

try{
 const target=await wait(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url));
 c=await connectCdp(target.webSocketDebuggerUrl);
 host=spawn(process.execPath,[fileURLToPath(new URL('../src/video-cdp-host.mjs',import.meta.url)),'--cdp-port',String(port),'--test-url',url],{env:{...process.env,CODEX_WALLPAPER_DATA_DIR:data},windowsHide:true,stdio:['ignore','ignore','pipe']});
 host.stderr.on('data',b=>errors=(errors+b).slice(-4000));

 // 1. Direct external MP4 (with audio track) loads from external path with empty media/ and stays muted.
 await wait(()=>c.evaluate('!!window.__cwbPanelHost&&!!window.__codexWallpaperBridge?.ready'));
 const videoState=await c.evaluate('(()=>{const v=document.getElementById("codex-wallpaper-bridge-layer")?.shadowRoot?.querySelector("video");return {transport:window.__codexWallpaperBridge?.transport,muted:v?.muted,volume:v?.volume,width:v?.videoWidth,height:v?.videoHeight};})()');
 assert.equal(videoState.transport,'native-media-file');
 assert.equal(videoState.muted,true,'direct MP4 with audio must stay muted even when visual.volume > 0');
 assert.equal(videoState.volume,0);
 assert.equal(videoState.width,320);
 assert.deepEqual(await readdir(path.join(data,'media')),[]);
 result.directExternalAudioMp4Muted=true;

 // Set up host RPC helper.
 await c.evaluate(`window.__rpcSeq=1000;window.__rpcMap=new Map();window.__origReply=window.__cwbReply;window.__cwbReply=(id,val)=>{const fn=window.__rpcMap.get(id);if(fn){window.__rpcMap.delete(id);fn(val);}else window.__origReply(id,val);};window.__rpc=req=>new Promise(resolve=>{const id=++window.__rpcSeq;window.__rpcMap.set(id,resolve);window.__codexWallpaperSend(JSON.stringify({...req,id,token:window.__cwbPanelHost.__cwbToken}));});true`);
 const rpc=async req=>(await c.call('Runtime.evaluate',{expression:'window.__rpc('+JSON.stringify(req)+')',awaitPromise:true,returnByValue:true})).result.value;

 // 2. Switch to direct external PNG A -> ready with empty media/.
 const swA=await rpc({action:'select',selectedId:'ext-png-a'});
 assert.equal(swA.ok,true);
 const imgState=await c.evaluate('(()=>{const img=document.getElementById("codex-wallpaper-bridge-layer")?.shadowRoot?.querySelector("img");return {ready:window.__codexWallpaperBridge?.ready,width:img?.naturalWidth,height:img?.naturalHeight};})()');
 assert.equal(imgState.ready,true);
 assert.equal(imgState.width,160);
 assert.deepEqual(await readdir(path.join(data,'media')),[]);
 result.directExternalPng=true;

 // 3. Rename external MP4 away -> selecting it fails clearly and preserves active PNG A layer!
 await c.evaluate('window.__retainedBridge=window.__codexWallpaperBridge;true');
 await rename(cMp4,path.join(ext,'moved-away.mp4'));
 const badSelect=await rpc({action:'select',selectedId:'ext-mp4'});
 assert.equal(badSelect.ok,false);
 assert.match(badSelect.error,/移动、改名或被删除/);
 assert.equal(await c.evaluate('window.__retainedBridge===window.__codexWallpaperBridge&&window.__codexWallpaperBridge.ready'),true);
 assert.equal(JSON.parse(await readFile(path.join(data,'settings.json'),'utf8')).selectedId,'ext-png-a');
 result.missingExternalSelectPreservesCurrent=true;

 // 4. Rotation skips missing MP4 and lands on direct PNG B.
 const rot=await rpc({action:'rotation-next'});
 assert.equal(rot.ok,true);
 assert.equal(rot.config.selectedId,'ext-png-b');
 assert.equal(rot.rotation.skipped.length,1);
 assert.equal(rot.rotation.skipped[0].id,'ext-mp4');
 assert.equal(await c.evaluate('window.__codexWallpaperBridge.ready'),true);
 result.rotationSkipsMissingExternal=true;

 // 5. Restart host with selectedId pointing to missing external MP4 -> controls panel still mounts and shows error.
 host.kill();
 await wait(()=>host.exitCode!==null||host.signalCode!==null,10000);
 const missingSettings=JSON.parse(await readFile(path.join(data,'settings.json'),'utf8'));
 missingSettings.selectedId='ext-mp4';
 await writeFile(path.join(data,'settings.json'),JSON.stringify(missingSettings,null,2));
 await c.call('Page.reload');
 await wait(()=>c.evaluate('document.readyState==="complete"&&!document.getElementById("codex-wallpaper-controls")'));
 host=spawn(process.execPath,[fileURLToPath(new URL('../src/video-cdp-host.mjs',import.meta.url)),'--cdp-port',String(port),'--test-url',url],{env:{...process.env,CODEX_WALLPAPER_DATA_DIR:data},windowsHide:true,stdio:['ignore','ignore','pipe']});
 host.stderr.on('data',b=>errors=(errors+b).slice(-4000));
 await wait(()=>c.evaluate('!!document.getElementById("codex-wallpaper-controls")?.shadowRoot?.getElementById("toggle")'));
 const errBanner=await wait(()=>c.evaluate('document.getElementById("codex-wallpaper-controls")?.shadowRoot?.getElementById("status")?.textContent||""').then(t=>/移动、改名或被删除/.test(t)?t:null));
 assert.match(errBanner,/移动、改名或被删除/);
 result.startupMissingExternalKeepsPanelReachable=true;

 assert.equal(errors,'');
 result.passed=true;
}catch(error){
 result.error=error.stack;
 result.hostErrors=errors;
 process.exitCode=1;
}finally{
 host?.kill();
 if(c){await c.call('Browser.close').catch(()=>{});c.close();}
 browser.kill();
 console.log(JSON.stringify(result,null,2));
}
