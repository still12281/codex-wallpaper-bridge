import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createProjectReader} from '../src/webwallgl-source.mjs';
test('a wallpaper resource capability cannot read outside its own project',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-assets-'));await writeFile(path.join(root,'project.json'),'{"type":"scene"}');await writeFile(path.join(root,'owned.txt'),'owned');const source=await createProjectReader(root);assert.equal((await source.read('owned.txt')).toString(),'owned');assert.equal(await source.read('missing.txt'),null);const firstTag=(await source.metadata('owned.txt')).etag;await writeFile(path.join(root,'owned.txt'),'changed length');assert.notEqual((await source.metadata('owned.txt')).etag,firstTag);
 for(const name of ['../secret','..\\secret','C:/secret','/secret','https://example.com','bad\0name'])await assert.rejects(source.read(name));
});
