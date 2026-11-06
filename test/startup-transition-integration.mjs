// Generated local pages and isolated Chrome only; never connects to Codex.
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer as createHttp} from 'node:http';
import {createServer as createNet} from 'node:net';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {installStartupAppearance} from '../src/startup-appearance.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch{}await sleep(20);}throw Error('Startup transition fixture timed out');}
let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME;
for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){if(chrome)break;const file=path.join(base,'Google/Chrome/Application/chrome.exe');try{await access(file);chrome=file;}catch{}}
if(!chrome)throw Error('Isolated Chrome fixture unavailable');
const root=await mkdtemp(path.join(os.tmpdir(),'cwb-transition-')),data=path.join(root,'data');await mkdir(path.join(data,'media'),{recursive:true});
await writeFile(path.join(data,'media/fixture.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#123456"/></svg>');
await writeFile(path.join(data,'settings.json'),JSON.stringify({library:[{id:'generated-image',name:'Generated image',file:'media/fixture.svg',mime:'image/svg+xml'}],selectedId:'generated-image',visual:{theme:'dark'},systemMedia:{enabled:false,audio:false}}));
let holdNext=false,releaseBody;
const head='<!doctype html><html><head><style>html,body{background:rgb(250,250,250);color:#111}@keyframes nativePulse{50%{opacity:.5}}[data-startup-logo]{animation:nativePulse 1s infinite}</style><script>window.__parserBackground=getComputedStyle(document.documentElement).backgroundColor</script>';
const body='</head><body><svg data-startup-logo width="40" height="40"><circle cx="20" cy="20" r="12" fill="currentColor"/></svg><aside class="app-shell-left-panel"></aside><main data-app-shell-main-surface>Generated transition fixture</main></body></html>';
const server=createHttp((req,res)=>{
 res.setHeader('Content-Type','text/html');res.setHeader('Cache-Control','no-store');
 if(req.url!=='/app'){res.end('<!doctype html><body style="background:rgb(250,250,250)">Unrelated generated page</body>');return;}
 res.flushHeaders();res.write(head);
 if(holdNext){holdNext=false;releaseBody=()=>{res.end(body);releaseBody=null;};}else res.end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/app';
const socket=createNet();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
let browser,host,browserCdp,first,next,foreign,errors='';
const clients=[];
try{
 browser=spawn(chrome,['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(root,'profile'),url],{windowsHide:true,stdio:'ignore'});
 const version=await until(async()=>(await fetch('http://127.0.0.1:'+port+'/json/version')).json());browserCdp=await connectCdp(version.webSocketDebuggerUrl);
 const target=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url));first=await connectCdp(target.webSocketDebuggerUrl);clients.push(first);
 host=spawn(process.execPath,[path.resolve('src/video-cdp-host.mjs'),'--cdp-port',String(port),'--test-url',url],{env:{...process.env,CODEX_WALLPAPER_DATA_DIR:data},windowsHide:true,stdio:['ignore','ignore','pipe']});host.stderr.on('data',b=>errors+=b);
 const status=async()=>JSON.parse(await readFile(path.join(data,'runtime-status.json'),'utf8'));
 await until(async()=>{const s=await status();return s.targets.some(t=>t.targetId===target.id&&t.ready);});
 assert.equal((await status()).targetDiscoveryError,undefined);
 // Let the healthy host enter its normal five-second idle interval.
 await sleep(100);
 holdNext=true;const started=performance.now();const created=await browserCdp.call('Target.createTarget',{url,background:true});
 const replacement=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.id===created.targetId));next=await connectCdp(replacement.webSocketDebuggerUrl);clients.push(next);
 await until(()=>next.evaluate('location.href==='+JSON.stringify(url)+'&&!!document.getElementById("codex-wallpaper-startup-style")&&!document.body'),2000);
 const paletteAfterMs=performance.now()-started;
 assert.equal(await next.evaluate('getComputedStyle(document.documentElement).backgroundColor'),'rgb(20, 22, 28)');
 assert.equal(await next.evaluate('!!window.__codexWallpaperBridge?.ready'),false);
 assert(releaseBody,'New document body was not held');releaseBody();
 await until(async()=>{const s=await status();return s.targets.some(t=>t.targetId===created.targetId&&t.ready);},2500);
 assert(await next.evaluate('!document.getElementById("codex-wallpaper-startup-style")&&!!document.getElementById("codex-wallpaper-bridge-style")&&window.__codexWallpaperBridge.ready'),'Palette did not hand off to real wallpaper');
 assert.equal(await next.evaluate('getComputedStyle(document.querySelector("[data-startup-logo]")).animationName'),'nativePulse');
 // A subsequent main-document load must receive its palette before parser JS.
 holdNext=true;await next.call('Page.reload',{ignoreCache:true});
 await until(()=>next.evaluate('!!document.getElementById("codex-wallpaper-startup-style")&&!document.body'));
 assert.equal(await next.evaluate('window.__parserBackground'),'rgb(20, 22, 28)');
 assert(releaseBody);releaseBody();
 await until(()=>next.evaluate('!!window.__codexWallpaperBridge?.ready&&!document.getElementById("codex-wallpaper-startup-style")'));
 const unrelated=await browserCdp.call('Target.createTarget',{url:url.replace('/app','/foreign'),background:true});
 const unrelatedTarget=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.id===unrelated.targetId));foreign=await connectCdp(unrelatedTarget.webSocketDebuggerUrl);clients.push(foreign);
 await until(()=>foreign.evaluate('!!document.body&&location.pathname==="/foreign"'));
 assert.equal(await foreign.evaluate('('+installStartupAppearance.toString()+')({r:0,g:0,b:0,dark:true},'+JSON.stringify(url)+')'),false);
 assert.equal(await foreign.evaluate('!!document.getElementById("codex-wallpaper-startup-style")'),false);
 const final=await status();assert.deepEqual(final.targetErrors,[]);
 const exited=new Promise(r=>host.once('exit',r)),stopAt=performance.now();await browserCdp.call('Browser.close').catch(()=>{});await Promise.race([exited,sleep(3000)]);
 assert.equal(host.exitCode,0,'Host leaked after browser exit');assert.equal(errors,'');
 const report={kind:'isolated-generated-transition-not-real-client-cold-start',passed:true,paletteAfterMs,newTargetWokeIdleHost:true,paletteBeforeBody:true,newDocumentPaletteBeforeParser:true,nativeAnimationPreserved:true,realWallpaperHandoff:true,unrelatedPageUnchanged:true,hostExitMs:performance.now()-stopAt};
 const output=process.argv.indexOf('--output');if(output>=0)await writeFile(process.argv[output+1],JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{
 releaseBody?.();for(const client of clients)client.close();browserCdp?.close();if(host?.exitCode===null)host.kill();if(browser?.exitCode===null)browser.kill();await new Promise(r=>server.close(r));server.closeAllConnections();
}
