import assert from 'node:assert/strict';
import {mkdtemp,readFile,rename} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createRuntimeStatusWriter} from '../src/runtime-status.mjs';

test('persistent replacement failure preserves the last valid snapshot and can recover',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-status-'));
 const status=path.join(root,'runtime-status.json');
 let blocked=false,attempts=0;
 const reports=[];
 const writer=createRuntimeStatusWriter(root,{pause:async()=>{},onFailure:message=>reports.push(message),
  replace:async(from,to)=>{
   if(blocked){attempts++;throw Object.assign(Error('fixture file is held'),{code:'EPERM'});}
   await rename(from,to);
  }
 });
 await writer.save('{"phase":"background-rendered","version":1}');
 blocked=true;
 await writer.save('{"phase":"background-rendered","version":2}');
 await writer.save('{"phase":"background-rendered","version":3}');
 assert.equal(writer.failures,2);
 assert.equal(attempts,process.platform==='win32'?6:2);
 assert.deepEqual(reports,['fixture file is held']);
 assert.equal(JSON.parse(await readFile(status,'utf8')).version,1);
 blocked=false;
 await writer.save('{"phase":"background-rendered","version":4}');
 assert.equal(writer.error,null);
 assert.equal(JSON.parse(await readFile(status,'utf8')).version,4);
});

test('busy snapshot writer publishes just the newest pending value',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-status-'));
 const visited=[];let release;
 const entered=new Promise(start=>{
  release={start};
 });
 const writer=createRuntimeStatusWriter(root,{replace:async(from,to)=>{
  visited.push(await readFile(from,'utf8'));
  if(visited.length===1)await new Promise(done=>{release.done=done;release.start();});
  await rename(from,to);
 }});
 const first=writer.save('first');
 await entered;
 const next=writer.save('middle');
 writer.save('latest');
 release.done();
 await Promise.all([first,next]);
 assert.deepEqual(visited,['first','latest']);
 assert.equal(await readFile(path.join(root,'runtime-status.json'),'utf8'),'latest');
});
