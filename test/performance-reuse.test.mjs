import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {hashMedia,libraryPreview} from '../src/library-preview.mjs';

test('fingerprints reuse unchanged files, invalidate changed bytes and respect cancellation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-fingerprint-')),file=path.join(root,'sample.mp4'),bytes=Buffer.alloc(2*1024*1024,35);
 await writeFile(file,bytes);const events=[];
 const first=await hashMedia(file);assert.equal(first,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(await hashMedia(file,{onProgress:e=>events.push(e)}),first);assert(events.some(e=>e.cacheHit));
 await writeFile(file,Buffer.from('changed source'));const changed=await hashMedia(file);assert.notEqual(changed,first);
 const abort=new AbortController();abort.abort(Error('cancelled fingerprint'));await assert.rejects(hashMedia(file,{signal:abort.signal}),/cancelled fingerprint/);
 const growing=path.join(root,'growing.mp4');await writeFile(growing,bytes);let mutation;
 await assert.rejects(hashMedia(growing,{onProgress:e=>{if(e.processedBytes&&!mutation)mutation=writeFile(growing,Buffer.from('source replaced during read'));}}),/发生变化/);await mutation;
});

test('preview reuse preserves current labels and invalidates replaced source files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-preview-'));await mkdir(path.join(root,'media'));
 const file='media/preview.png';await writeFile(path.join(root,file),Buffer.from('generated image fixture'));
 const first=await libraryPreview(root,{name:'First',file,mime:'image/png'});
 const second=await libraryPreview(root,{name:'Renamed',file,mime:'image/png'});assert.equal(second.preview,first.preview);assert.equal(second.name,'Renamed');
 await writeFile(path.join(root,file),Buffer.from('different generated image fixture'));
 assert.notEqual((await libraryPreview(root,{name:'Third',file,mime:'image/png'})).preview,first.preview);
});
