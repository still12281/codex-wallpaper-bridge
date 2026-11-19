// Isolated headless browser only; never connects to the user's Codex or profile.
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {connect,createServer} from 'node:net';
import {createServer as createHttpServer} from 'node:http';
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
let browser,host,connection,proxy;const tunnels=new Set();let errors='';
try{
 let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME;for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){if(chrome)break;const file=path.join(base,'Google/Chrome/Application/chrome.exe');try{await access(file);chrome=file}catch{}}
 if(!chrome)throw Error('Isolated Chrome fixture unavailable');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 browser=spawn(chrome,['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(root,'profile'),url],{windowsHide:true,stdio:'ignore'});
 const version=await until(async()=>{const r=await fetch('http://127.0.0.1:'+port+'/json/version');return r.json()});connection=await connectCdp(version.webSocketDebuggerUrl);
 // Drop only one Bridge socket while the same browser and its other page
 // connections continue running. The proxy also lets the test observe retries.
 proxy=createHttpServer(async(req,res)=>{
  try{
   const reply=await fetch('http://127.0.0.1:'+port+req.url);
   res.writeHead(reply.status,{'Content-Type':'application/json'});
   res.end((await reply.text()).replaceAll('127.0.0.1:'+port,'127.0.0.1:'+proxy.address().port));
  }catch{res.writeHead(503);res.end();}
 });
 proxy.on('upgrade',(req,client,head)=>{
  const upstream=connect(port,'127.0.0.1');
  const tunnel={path:req.url,client,upstream};tunnels.add(tunnel);
  const close=()=>{tunnels.delete(tunnel);client.destroy();upstream.destroy();};
  for(const socket of [client,upstream]){socket.on('error',close);socket.on('close',close);}
  upstream.once('connect',()=>{
   const headers={...req.headers,host:'127.0.0.1:'+port};
   upstream.write(req.method+' '+req.url+' HTTP/'+req.httpVersion+'\r\n'+Object.entries(headers).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');
   if(head.length)upstream.write(head);
   client.pipe(upstream);upstream.pipe(client);
  });
 });
 await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
 host=spawn(process.execPath,[path.resolve('src/video-cdp-host.mjs'),'--cdp-port',String(proxy.address().port),'--test-url',url],{env:{...process.env,CODEX_WALLPAPER_DATA_DIR:data},windowsHide:true,stdio:['ignore','ignore','pipe']});host.stderr.on('data',b=>errors+=b.toString());
 await until(async()=>JSON.parse(await readFile(path.join(data,'runtime-status.json'),'utf8')).phase==='background-disabled');
 const second=await connection.call('Target.createTarget',{url,background:true});
 const observed=await until(async()=>{const s=JSON.parse(await readFile(path.join(data,'runtime-status.json'),'utf8'));return s.targets.length===2&&s.targets.every(t=>t.installed)&&s;});
 assert.ok(observed.targets.some(t=>t.targetId===second.targetId));assert.equal(new Set(observed.targets.map(t=>t.targetId)).size,2);
 const lifetimePath=new URL(version.webSocketDebuggerUrl).pathname;
 const [lifetime]=await until(async()=>{const sockets=[...tunnels].filter(t=>t.path===lifetimePath);return sockets.length===2&&sockets;});
 lifetime.client.destroy();
 const recovered=await until(async()=>{const s=JSON.parse(await readFile(path.join(data,'runtime-status.json'),'utf8'));return s.browserRecovery?.state==='reconnected'&&s;});
 assert.equal(recovered.pid,observed.pid);assert.equal(recovered.browserId,observed.browserId);
 assert.deepEqual(recovered.targets.map(t=>t.targetId).sort(),observed.targets.map(t=>t.targetId).sort());
 const exited=new Promise(resolve=>host.once('exit',(code,signal)=>resolve({code,signal})));
 await connection.call('Browser.close').catch(()=>{});
 let timeout;
 const result=await Promise.race([exited,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Wallpaper host stayed alive after browser disconnect')),8000);})]).finally(()=>clearTimeout(timeout));
 assert.equal(result.code,0);assert.equal(result.signal,null);assert.equal(errors,'');
 assert.equal(JSON.parse(await readFile(path.join(data,'runtime-status.json'),'utf8')).phase,'stopped');
 console.log(JSON.stringify({kind:'isolated-headless-not-user-client',passed:true,sameHostAfterSocketDrop:true,hostExitedOnBrowserClose:true,noSupervisorRequired:true}));
}finally{for(const tunnel of tunnels)tunnel.client.destroy();proxy?.close();connection?.close();if(host&&host.exitCode===null)host.kill();if(browser&&browser.exitCode===null)browser.kill()}
