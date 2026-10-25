// Isolated headless browser only; never connects to the user's Codex or profile.
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'cwb-lifetime-')),data=path.join(root,'data');await mkdir(data);
const shell=path.join(root,'shell.html');await writeFile(shell,'<!doctype html><body><aside class="app-shell-left-panel"></aside><main data-app-shell-main-surface>Isolated lifecycle fixture</main></body>');
await writeFile(path.join(data,'settings.json'),JSON.stringify({library:[],selectedId:null,systemMedia:{enabled:false,audio:false}}));
const url=pathToFileURL(shell).href,pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){const result=await check().catch(()=>false);if(result)return result;await pause(100)}throw Error('Lifecycle fixture timed out')}
let browser,host,connection;let errors='';
try{
 let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME;for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){if(chrome)break;const file=path.join(base,'Google/Chrome/Application/chrome.exe');try{await access(file);chrome=file}catch{}}
 if(!chrome)throw Error('Isolated Chrome fixture unavailable');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 browser=spawn(chrome,['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(root,'profile'),url],{windowsHide:true,stdio:'ignore'});
 const version=await until(async()=>{const r=await fetch('http://127.0.0.1:'+port+'/json/version');return r.json()});connection=await connectCdp(version.webSocketDebuggerUrl);
 host=spawn(process.execPath,[path.resolve('src/video-cdp-host.mjs'),'--cdp-port',String(port),'--test-url',url],{env:{...process.env,CODEX_WALLPAPER_DATA_DIR:data},windowsHide:true,stdio:['ignore','ignore','pipe']});host.stderr.on('data',b=>errors+=b.toString());
 await until(async()=>JSON.parse(await readFile(path.join(data,'runtime-status.json'),'utf8')).phase==='background-disabled');
 const exited=new Promise(resolve=>host.once('exit',(code,signal)=>resolve({code,signal})));
 await connection.call('Browser.close').catch(()=>{});
 const result=await Promise.race([exited,pause(5000).then(()=>{throw Error('Wallpaper host stayed alive after browser disconnect')})]);
 assert.equal(result.code,0);assert.equal(result.signal,null);assert.equal(errors,'');
 assert.equal(JSON.parse(await readFile(path.join(data,'runtime-status.json'),'utf8')).phase,'stopped');
 console.log(JSON.stringify({kind:'isolated-headless-not-user-client',passed:true,hostExitedOnBrowserDisconnect:true,noSupervisorRequired:true}));
}finally{connection?.close();if(host&&host.exitCode===null)host.kill();if(browser&&browser.exitCode===null)browser.kill()}
