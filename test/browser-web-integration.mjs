// Bounded integration of our own headless source only. No desktop/Codex input.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {startBrowserWeb} from '../src/browser-web-source.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'cwb-web-source-')),project=path.join(root,'project'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),result={kind:'isolated-headless-pipe-not-native-Codex-playback'};
await mkdir(project);await writeFile(path.join(project,'project.json'),JSON.stringify({type:'web',file:'index.html',general:{properties:{speed:{type:'slider',value:3,min:1,max:5}}}}));
await writeFile(path.join(project,'style.css'),'html,body{margin:0;background:#246}canvas{width:100vw;height:100vh}');
await writeFile(path.join(project,'main.js'),`const c=document.querySelector('canvas'),x=c.getContext('2d');c.width=960;c.height=540;let n=0;function draw(){x.fillStyle='hsl('+(n++%360)+' 70% 40%)';x.fillRect(0,0,960,540);if(!location.search)requestAnimationFrame(draw);}draw();`);
const html='<!doctype html><link rel="stylesheet" href="style.css"><canvas></canvas><script src="main.js"></script>';
await writeFile(path.join(project,'index.html'),html);
const entry={id:'fixture',engine:'chromium-web',projectRoot:project,limits:{maxWidth:960,maxHeight:540,fps:24}};let source;
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const waitFor=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await sleep(100);}throw Error('lifecycle timeout');};
try{
 const began=Date.now();source=await startBrowserWeb(entry,root);result.firstMs=Date.now()-began;const first=source.sequence;await waitFor(()=>source.sequence>first+2);result.animation=true;
 await waitFor(()=>source.framesReceived===source.framesAcked);assert.equal(source.error,null);result.pipeACKs=source.framesAcked;
 const oldPid=source.browserPid,pausedSequence=source.sequence;source.setPaused(true);await waitFor(()=>!alive(oldPid));assert(source.paused);assert.equal(source.sequence,pausedSequence);source.setPaused(false);await waitFor(()=>source.sequence>pausedSequence||source.error);assert.equal(source.error,null);assert.notEqual(source.browserPid,oldPid);result.pauseClosesResumeReloads=true;
 // Repeated desired-state changes and stop during a reload must release children.
 source.setPaused(true);source.setPaused(false);source.setPaused(true);source.setPaused(false);await source.stop();assert(!alive(source.browserPid));result.stopDuringResume=true;source=null;
 // A static document may have no screencast events for >10s and remains healthy.
 await writeFile(path.join(project,'index.html'),'<body style="background:#248">static fixture</body>');source=await startBrowserWeb(entry,root);await sleep(10500);assert.equal(source.error,null);result.staticHealthyAfter10s=true;await source.stop();source=null;
 await writeFile(path.join(project,'index.html'),'<body><script>window.wallpaperPropertyListener={applyUserProperties:p=>{document.body.style.background=p.speed.value>3?"#ff0000":"#0000ff"}}</script>');source=await startBrowserWeb(entry,root);const oldFrame=createHash('sha256').update(source.frame).digest('hex'),oldSequence=source.sequence;entry.userProperties={speed:5};const propertyPid=source.browserPid;source.setPaused(true);await waitFor(()=>!alive(propertyPid));source.setPaused(false);await waitFor(()=>source.sequence>oldSequence||source.error);assert.equal(source.error,null);assert.notEqual(createHash('sha256').update(source.frame).digest('hex'),oldFrame);result.propertiesReseeded=true;await source.stop();source=null;
 // Cancellation during readiness stops a candidate instead of replacing the old source.
 let current=true;const cancel=setTimeout(()=>{current=false;},200);await assert.rejects(startBrowserWeb(entry,root,{isCurrent:()=>current}),error=>error.code==='CWB_SELECTION_SUPERSEDED');clearTimeout(cancel);result.cancelledCandidate=true;
 // An author CSP is retained. It blocks injected inline script, so the candidate fails.
 await writeFile(path.join(project,'index.html'),'<meta http-equiv="Content-Security-Policy" content="script-src \'none\'"><body>CSP fixture</body>');
 await assert.rejects(startBrowserWeb(entry,root),/作者 CSP/);result.authorCspRetained=true;
 // Requests cannot reach another local server (or the Internet).
 let requests=0;const outside=createServer((req,res)=>{requests++;res.end('outside');});await new Promise(r=>outside.listen(0,'127.0.0.1',r));
 try{for(const attack of [`<script src="http://127.0.0.1:${outside.address().port}/outside.js"></script>`,`<script>new Worker(URL.createObjectURL(new Blob(['fetch("http://127.0.0.1:${outside.address().port}/worker")'],{type:'application/javascript'})))</script>`,`<script>location.href="http://127.0.0.1:${outside.address().port}/navigate"</script>`]){await writeFile(path.join(project,'index.html'),html+attack);try{source=await startBrowserWeb(entry,root);await sleep(500);}catch(error){assert.match(error.message,/外部资源|未就绪/);}finally{await source?.stop();source=null;}assert.equal(requests,0);}result.httpFenceDocumentScriptWorker=true;}finally{await new Promise(r=>outside.close(r));}
 await writeFile(path.join(project,'index.html'),html);
 const childCode=`import {startBrowserWeb} from ${JSON.stringify(new URL('../src/browser-web-source.mjs',import.meta.url).href)};const s=await startBrowserWeb(${JSON.stringify(entry)},${JSON.stringify(path.join(root,'abrupt'))});console.log(JSON.stringify({pid:s.browserPid}));process.exit(0);`;
 const abrupt=JSON.parse((await promisify(execFile)(process.execPath,['--input-type=module','-e',childCode],{windowsHide:true,timeout:15000})).stdout);await waitFor(()=>!alive(abrupt.pid));result.parentExitClosesBrowser=true;
 result.passed=true;
}finally{await source?.stop();console.log(JSON.stringify(result,null,2));}
