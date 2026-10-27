import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {commitConverted,removeManagedFile} from '../src/media-store.mjs';
test('failed save after promotion retains old bytes and removes the newly owned final file',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-import-transaction-'));await mkdir(path.join(root,'media'));
 await writeFile(path.join(root,'media/old.mp4'),'old bytes');await writeFile(path.join(root,'media/pending.mp4'),'new bytes');
 const entry={id:'fixture',file:'media/old.mp4',mime:'video/mp4'},settings={library:[entry]},previous={...entry};
 await assert.rejects(commitConverted(root,settings,entry,{file:'media/pending.mp4',destination:'media/old.mp4',mime:'video/mp4'},previous,async()=>{assert.equal(await readFile(path.join(root,entry.file),'utf8'),entry.file===previous.file?'old bytes':'new bytes');},async()=>{throw Error('save failed');}),/save failed/);
 assert.deepEqual(entry,previous);assert.equal(await readFile(path.join(root,'media/old.mp4'),'utf8'),'old bytes');assert.deepEqual(await readdir(path.join(root,'media')),['old.mp4']);
});
test('successful promotion preserves a saved custom-tier reference and does not overwrite it',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-import-custom-'));await mkdir(path.join(root,'media'));await writeFile(path.join(root,'media/custom.mp4'),'custom');await writeFile(path.join(root,'media/pending.mp4'),'new');
 const entry={id:'fixture',file:'media/custom.mp4',customDisplay:{file:'media/custom.mp4'}},settings={library:[entry]};let saved;
 await commitConverted(root,settings,entry,{file:'media/pending.mp4',destination:'media/custom.mp4'},structuredClone(entry),async()=>{},async()=>{saved=entry.file;});
 assert.equal(saved,entry.file);assert.notEqual(saved,'media/custom.mp4');assert.equal(await readFile(path.join(root,saved),'utf8'),'new');assert.equal(await removeManagedFile(root,settings,'media/custom.mp4'),false);assert.equal(await readFile(path.join(root,'media/custom.mp4'),'utf8'),'custom');
});
