import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';

const browser='11111111-2222-4333-8444-555555555555';
const preload=`import vm from 'node:vm';import {writeFileSync} from 'node:fs';
let versions=0,calls=0;const mode=process.env.CWB_ACTIVATION_CASE,marker=process.env.CWB_ACTIVATION_MARKER;
const save=()=>writeFileSync(marker,JSON.stringify({calls}));save();
globalThis.fetch=async url=>new Response(JSON.stringify(String(url).endsWith('/json/version')?{webSocketDebuggerUrl:'ws://127.0.0.1:12345/devtools/browser/'+((mode==='foreign'||mode==='changed'&&versions++>0)?'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee':'${browser}')}:[{id:'ABCDEF',type:'page',url:'app://-/index.html',webSocketDebuggerUrl:'ws://127.0.0.1:12345/devtools/page/ABCDEF'}]));
const document={hidden:true,hasFocus:()=>!document.hidden,addEventListener(){},removeEventListener(){}};
const bridge=mode==='missing'?{}:{sendMessageFromView:async request=>{if(JSON.stringify(request)!==JSON.stringify({type:'open-current-main-window',stealFocus:true}))throw Error('Unexpected navigation or focus payload');calls++;save();if(mode!=='hidden')document.hidden=false;}};
const context=vm.createContext({window:{electronBridge:bridge},document,location:{href:'app://-/index.html'},screenX:10,screenY:20,outerWidth:1000,outerHeight:800,devicePixelRatio:1,setTimeout,clearTimeout});
globalThis.WebSocket=class extends EventTarget{constructor(){super();this.readyState=0;queueMicrotask(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));});}send(raw){const request=JSON.parse(raw);Promise.resolve().then(async()=>{let result;try{result={result:{value:await vm.runInContext(request.params.expression,context)}};}catch(error){result={exceptionDetails:{text:error.message}};}this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:request.id,result})}));});}close(){this.readyState=3;this.dispatchEvent(new Event('close'));}};
`;

for(const mode of ['show','geometry','missing','hidden','foreign','changed'])test('existing client activation: '+mode,async()=>{
 const root=await mkdtemp(path.join(process.env.CODEX_WALLPAPER_TEST_TMP||os.tmpdir(),'cwb-activate-')),loader=path.join(root,'loader.mjs'),marker=path.join(root,'calls.json');await writeFile(loader,preload);
 const args=['--import',pathToFileURL(loader).href,path.resolve('src/activate-client.mjs'),'--cdp-port','12345','--browser-id',browser,'--no-wait'];if(mode!=='geometry')args.push('--show-current');
 const child=spawn(process.execPath,args,{env:{...process.env,CWB_ACTIVATION_CASE:mode,CWB_ACTIVATION_MARKER:marker},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const code=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Generated activation fixture timed out'));},7000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);resolve(code);});});
 const {calls}=JSON.parse(await readFile(marker,'utf8'));
 if(mode==='show'){assert.equal(code,0,stderr);const result=JSON.parse(stdout);assert.equal(calls,1);assert.equal(result.nativeRestore.bridgeUsed,true);assert.equal(result.nativeRestore.hidden,false);assert.equal(result.mainTarget,'ABCDEF');}
 else if(mode==='geometry'){assert.equal(code,0,stderr);assert.equal(calls,0);assert.equal(JSON.parse(stdout).nativeRestore,undefined);}
 else{assert.notEqual(code,0);assert.equal(calls,['hidden','changed'].includes(mode)?1:0);assert.equal(stdout,'');}
});
