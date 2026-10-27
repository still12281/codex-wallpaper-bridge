import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createProjectReader} from '../src/webwallgl-source.mjs';
test('a wallpaper resource capability cannot read outside its own project',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-assets-'));await writeFile(path.join(root,'project.json'),'{"type":"scene"}');await writeFile(path.join(root,'owned.txt'),'owned');const source=await createProjectReader(root);assert.equal((await source.read('owned.txt')).toString(),'owned');assert.equal(await source.read('missing.txt'),null);const firstTag=(await source.metadata('owned.txt')).etag;await writeFile(path.join(root,'owned.txt'),'changed length');assert.notEqual((await source.metadata('owned.txt')).etag,firstTag);
 const local=await source.localFile('owned.txt');assert.equal(local.path,await realpath(path.join(root,'owned.txt')));assert.equal(local.size,14);assert.equal(await source.localFile('missing.txt'),null);
 for(const name of ['../secret','..\\secret','C:/secret','/secret','https://example.com','bad\0name']){await assert.rejects(source.read(name));await assert.rejects(source.localFile(name));}
});
