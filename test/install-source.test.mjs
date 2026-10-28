import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,unlink,rmdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {installSource} from '../tools/install-source.mjs';
import {canonical,digest} from '../tools/release-files.mjs';

async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-install-')),source=path.join(root,'source'),data=path.join(root,'data'),files=[],directories=[root];
 const directory=async value=>{await mkdir(value,{recursive:true});directories.push(value)};
 const file=async(value,text)=>{await writeFile(value,text);files.push(value)};
 await directory(source);await directory(data);await file(path.join(source,'example.txt'),'source\r\n');
 await file(path.join(source,'release-manifest.json'),JSON.stringify({files:[{path:'example.txt',utf8Bytes:7,sha256:digest(canonical(Buffer.from('source\r\n')))}]}));
 t.after(async()=>{for(const f of [...new Set(files)].reverse())await unlink(f).catch(e=>{if(e.code!=='ENOENT')throw e});for(const d of [...new Set(directories)].sort((a,b)=>b.length-a.length))await rmdir(d)});
 const track=result=>{directories.push(path.join(data,'versions'),result.directory);files.push(path.join(result.directory,'example.txt'),path.join(result.directory,'release-manifest.json'));return result};
 return {source,data,file,track};
}
test('versioned installation preserves settings and is repeatable',async t=>{
 const f=await fixture(t);await f.file(path.join(f.data,'settings.json'),'private settings');
 const first=f.track(await installSource(f.source,f.data)),second=await installSource(f.source,f.data);
 assert.equal(first.directory,second.directory);assert.equal(await readFile(path.join(f.data,'settings.json'),'utf8'),'private settings');
 assert.equal(await readFile(path.join(first.directory,'example.txt'),'utf8'),'source\r\n');
 await writeFile(path.join(first.directory,'example.txt'),'modified');await assert.rejects(installSource(f.source,f.data),/modified; preserving/);
});
test('installation rejects changed source checksums and manifest traversal',async t=>{
 const f=await fixture(t);await writeFile(path.join(f.source,'example.txt'),'changed');await assert.rejects(installSource(f.source,f.data),/checksum/);
 await writeFile(path.join(f.source,'release-manifest.json'),JSON.stringify({files:[{path:'../private.txt'}]}));await assert.rejects(installSource(f.source,f.data),/Unsafe/);
});
test('data and source directories cannot contain each other',async t=>{
 const f=await fixture(t);await assert.rejects(installSource(f.source,path.join(f.source,'data')),/separate/);await assert.rejects(installSource(f.source,path.dirname(f.source)),/separate/);
});
