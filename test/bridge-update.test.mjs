import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createBridgeUpdater,newerVersion,releaseUpdate} from '../src/bridge-update.mjs';
const base='https://github.com/still12281/codex-wallpaper-bridge',name='CodexWallpaperBridge-0.3.0-Setup.exe',bytes=Buffer.from('fixture installer, never executed'),digest=createHash('sha256').update(bytes).digest('hex');
const release=()=>({tag_name:'v0.3.0',draft:false,prerelease:false,assets:[{name,size:bytes.length,digest:'sha256:'+digest,browser_download_url:base+'/releases/download/v0.3.0/'+name},{name:name+'.sha256',browser_download_url:base+'/releases/download/v0.3.0/'+name+'.sha256'}]});
const wait=async predicate=>{for(let i=0;i<100;i++){const value=await predicate();if(value)return value;await new Promise(r=>setTimeout(r,10));}assert.fail('Update did not settle');};
test('stable version comparison handles numeric components and rejects unsupported tags',()=>{
 for(const [a,b,expected] of [['0.3.0','0.2.2',true],['0.2.10','0.2.9',true],['0.2.2','0.2.2',false],['0.1.9','0.2.2',false],['0.3.0-rc.1','0.2.2',false],['01.3.0','0.2.2',false]])assert.equal(newerVersion(a,b),expected);
});
test('release metadata binds stable version, exact repository, name, size and checksum',()=>{
 assert.equal(releaseUpdate(release(),'0.2.2').available,true);
 for(const mutate of [r=>r.prerelease=true,r=>r.assets.pop(),r=>r.assets[0].size=200*1024*1024,r=>r.assets[0].browser_download_url='https://example.com/run.exe',r=>r.tag_name='v0.3.0/evil']){const r=release();mutate(r);assert.throws(()=>releaseUpdate(r,'0.2.2'));}
});
async function fixture({badHash=false,truncate=false,redirect=false,failLaunch=false}={}){
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-update-'));let requests=0,launches=0,requestFile;
 const updater=createBridgeUpdater({root,currentVersion:'0.2.2',request:async url=>{
  requests++;if(redirect)return new Response(null,{status:302,headers:{location:'https://example.com/installer'}});
  if(url.endsWith('/latest'))return Response.json(release());
  if(url.endsWith('.sha256'))return new Response((badHash?'0'.repeat(64):digest)+'  '+name+'\n');
  return new Response(truncate?bytes.subarray(0,4):bytes);
 },launch:async file=>{launches++;requestFile=file;if(failLaunch)throw Error('launch failed');}});
 return {root,updater,get requests(){return requests;},get launches(){return launches;},get requestFile(){return requestFile;}};
}
test('checks cache, deduplicate and report network failures without claiming up to date',async()=>{
 const f=await fixture();await Promise.all([f.updater.check(),f.updater.check()]);assert.equal(f.requests,1);await f.updater.check();assert.equal(f.requests,1);await f.updater.check(true);assert.equal(f.requests,2);
 const u=createBridgeUpdater({root:f.root,currentVersion:'0.2.2',request:async()=>new Response('',{status:403})});assert.match((await u.check()).message,/403/);assert.equal((await u.status()).phase,'error');
 const redirected=await fixture({redirect:true});assert.equal((await redirected.updater.check()).phase,'error');assert.equal(redirected.requests,1);
});
test('verified download launches once, pins data directory and reads terminal installer status',async()=>{
 const f=await fixture();await Promise.all([f.updater.start(),f.updater.start()]);await wait(()=>f.launches);assert.equal(f.launches,1);
 const request=JSON.parse(await readFile(f.requestFile,'utf8'));assert.equal(request.dataDirectory,f.root);assert.equal(request.sha256,digest);assert.deepEqual(await readFile(request.installer),bytes);
 const restored=createBridgeUpdater({root:f.root,currentVersion:'0.2.2',request:async()=>{assert.fail('An active update must not download twice');}});
 assert.equal((await restored.status()).phase,'installing');assert.equal((await restored.start()).phase,'installing');
 await writeFile(request.statusFile,JSON.stringify({id:'foreign',phase:'installed'}));assert.equal((await f.updater.status()).phase,'installing');
 await writeFile(request.statusFile,JSON.stringify({id:request.id,phase:'installed',message:'Restart normally'}));assert.equal((await f.updater.status()).phase,'installed');await f.updater.start();assert.equal(f.launches,1);
 assert.equal((await restored.status()).phase,'installed');
 const upgraded=createBridgeUpdater({root:f.root,currentVersion:'0.3.0'});await upgraded.status();await assert.rejects(readFile(path.join(f.root,'updates','active.json')),e=>e.code==='ENOENT');
});
test('starting an update returns before metadata networking and holds duplicate clicks',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-update-'));let releaseNetwork;
 const gate=new Promise(r=>releaseNetwork=r);let calls=0;
 const u=createBridgeUpdater({root,currentVersion:'0.2.2',request:async()=>{calls++;await gate;return Response.json({...release(),tag_name:'v0.2.2',assets:release().assets.map(a=>({...a,name:a.name.replace('0.3.0','0.2.2'),browser_download_url:a.browser_download_url.replaceAll('0.3.0','0.2.2')}))});}});
 assert.equal((await u.start()).phase,'checking');assert.equal((await u.start()).phase,'checking');assert.equal(calls,1);releaseNetwork();await wait(async()=>(await u.status()).phase==='idle');
});
test('long running installation keeps its real phase and later process loss permits retry',async()=>{
 const f=await fixture();await f.updater.start();await wait(()=>f.launches);
 const request=JSON.parse(await readFile(f.requestFile,'utf8'));
 let clock=Date.now()+21*60*1000;
 const restored=createBridgeUpdater({root:f.root,currentVersion:'0.2.2',now:()=>clock});
 await writeFile(path.join(path.dirname(request.statusFile),'runner.json'),JSON.stringify({id:request.id,pid:process.pid}));
 assert.equal((await restored.status()).phase,'installing');assert.match((await restored.status()).message,/20 分钟/);
 await writeFile(path.join(path.dirname(request.statusFile),'runner.json'),JSON.stringify({id:request.id,pid:2147483647}));
 assert.equal((await restored.status()).phase,'error');await assert.rejects(readFile(path.join(f.root,'updates','active.json')),e=>e.code==='ENOENT');
});
test('corrupt or truncated downloads and failed process launch never become installed',async()=>{
 for(const options of [{badHash:true},{truncate:true},{failLaunch:true}]){
  const f=await fixture(options);await f.updater.start();const settled=await wait(async()=>{const s=await f.updater.status();return s.phase==='error'&&s;});assert.equal(f.launches,options.failLaunch?1:0,JSON.stringify(settled));
  const folders=await readdir(path.join(f.root,'updates'));assert.equal(folders.length,1);assert(!(await readdir(path.join(f.root,'updates',folders[0]))).some(n=>n.endsWith('.part')));
 }
});
