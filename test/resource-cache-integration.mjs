// Generated isolated fixture: no real client, account profile or wallpaper assets.
import {mkdtemp,writeFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {installSceneResourceCache} from '../src/scene-resource-cache.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'cwb-resource-cache-')),html=path.join(root,'fixture.html');await writeFile(html,'<!doctype html><body>Generated cache fixture</body>');
let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME;for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){if(chrome)break;const file=path.join(base,'Google/Chrome/Application/chrome.exe');try{await access(file);chrome=file}catch{}}
if(!chrome)throw Error('Set CODEX_WALLPAPER_TEST_CHROME');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const url=pathToFileURL(html).href,browser=spawn(chrome,['--headless=new','--no-first-run','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+path.join(root,'profile'),url],{windowsHide:true,stdio:'ignore'});
let c;const result={kind:'isolated-cache-delivery-order-and-byte-integrity'},sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{for(let n=0;n<100;n++){try{if(await fn())return}catch{}await sleep(25)}throw Error('Cache fixture timeout')};
try{
 await until(async()=>{const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url===url);if(target){c=await connectCdp(target.webSocketDebuggerUrl);return true}});
 await c.evaluate(`(()=>{
  const layer=document.createElement('div');layer.dataset.cwbRendererId='fixture';const frame=document.createElement('iframe');layer.attachShadow({mode:'open'}).append(frame);document.body.append(layer);
  window.__cacheRows=new Map();window.__cacheGate=new Promise(r=>window.__releaseCache=r);window.__cacheWritten=false;
  Object.defineProperty(window,'caches',{value:{open:async()=>({keys:async()=>[],match:async key=>__cacheRows.get(key)?.clone(),delete:async()=>true,put:async(key,response)=>{await __cacheGate;__cacheRows.set(key,response.clone());__cacheWritten=true;}})},configurable:true});
  window.__delivery=[];addEventListener('message',e=>{if(e.source===frame.contentWindow&&e.data?.received)window.__delivery.push(e.data.received)});
  frame.srcdoc='<script>addEventListener("message",e=>{if(e.data.resource)parent.postMessage({received:Array.from(e.data.resource.bytes.slice(0,4))},"*")})<\/script>';
  window.__file=new File([new Uint8Array([4,3,2,1])],'fixture.pkg',{lastModified:1234});
  return true;
 })()`);
 await sleep(100);await c.evaluate('('+installSceneResourceCache.toString()+')();true');
 const call=async expr=>{const r=await c.call('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value};
 const key='a'.repeat(64),info={rendererId:'fixture',id:1,token:'fixture'};
 await call('__cwbSceneResources.readFile("first",'+JSON.stringify(key)+',__file,4,1234)');
 await call('__cwbSceneResources.complete("first",'+JSON.stringify(info)+')');
 await until(()=>c.evaluate('__delivery.length===1'));assert.equal(await c.evaluate('__cacheWritten'),false);result.deliveredBeforeCacheWrite=true;
 await c.evaluate('window.__cacheHitDone=false;__cwbSceneResources.cached('+JSON.stringify(key)+',4,'+JSON.stringify(info)+').then(v=>window.__cacheHitDone=v);true');
 assert.equal(await c.evaluate('__cacheHitDone'),false);await c.evaluate('__releaseCache();true');
 await until(()=>c.evaluate('__cacheHitDone'));await call('__cwbSceneResources.flush()');await until(()=>c.evaluate('__delivery.length===2'));
 assert.deepEqual(await c.evaluate('__delivery'),[[4,3,2,1],[4,3,2,1]]);assert.equal(await c.evaluate('__cwbSceneResources.stats.hits'),1);result.pendingWriteReusedAndBytesMatch=true;
 await c.evaluate('__cwbSceneResources.begin("fallback",'+JSON.stringify('b'.repeat(64))+',4);__cwbSceneResources.receive("fallback","BQYHCA==",0);true');
 await call('__cwbSceneResources.complete("fallback",'+JSON.stringify(info)+')');await call('__cwbSceneResources.flush()');await until(()=>c.evaluate('__delivery.length===3'));
 assert.deepEqual(await c.evaluate('__delivery[2]'),[5,6,7,8]);result.base64FallbackBytesMatch=true;
 await c.evaluate('__cwbSceneResources.begin("aborted",'+JSON.stringify(key)+',4);__cwbSceneResources.abort("aborted");true');await assert.rejects(call('__cwbSceneResources.complete("aborted",'+JSON.stringify(info)+')'));result.abortedBufferRejected=true;result.passed=true;
}catch(e){result.error=e.stack;process.exitCode=1}
finally{if(c){await c.call('Browser.close').catch(()=>{});c.close()}browser.kill();console.log(JSON.stringify(result,null,2))}
