import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
const exec=promisify(execFile),cli=path.resolve('tools/library-maintenance.mjs');
test('backup roundtrip preserves external references and rejects overwrite, corruption and escaping paths',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'cwb-maintenance-')),data=path.join(temp,'data'),snapshot=path.join(temp,'snapshot'),restored=path.join(temp,'restored');await mkdir(path.join(data,'media'),{recursive:true});
 const owned=path.join(data,'media','original.mp4'),external=path.join(temp,'external-project');await writeFile(owned,'synthetic-owned-media');const settings={library:[{id:'video',file:'media/original.mp4',sourcePath:owned},{id:'scene',mode:'realtime',projectRoot:external}],selectedId:'video'};await writeFile(path.join(data,'settings.json'),JSON.stringify(settings));
 const run=(...args)=>exec(process.execPath,[cli,...args]);await run('backup',data,snapshot);await run('restore',snapshot,restored);
 const result=JSON.parse(await readFile(path.join(restored,'settings.json'),'utf8'));assert.equal(result.library[0].sourcePath,'media/original.mp4');assert.equal(result.library[1].projectRoot,external);assert.equal(await readFile(path.join(restored,'media/original.mp4'),'utf8'),'synthetic-owned-media');assert.equal(JSON.parse(await readFile(path.join(data,'settings.json'),'utf8')).library[0].sourcePath,owned);
 await assert.rejects(run('restore',snapshot,restored),/Destination must be empty/);
 await writeFile(path.join(snapshot,'media/original.mp4'),'corrupted');const corrupt=path.join(temp,'corrupt-restore');await assert.rejects(run('restore',snapshot,corrupt),/checksum mismatch/);await assert.rejects(access(path.join(corrupt,'settings.json')));
 const manifest=JSON.parse(await readFile(path.join(snapshot,'backup-manifest.json'),'utf8'));manifest.files[0].path='../escape.mp4';await writeFile(path.join(snapshot,'backup-manifest.json'),JSON.stringify(manifest));await assert.rejects(run('restore',snapshot,path.join(temp,'unsafe-restore')),/Invalid or duplicate backup path/);await assert.rejects(access(path.join(temp,'escape.mp4')));
});
