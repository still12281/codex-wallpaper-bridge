import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createBootstrap} from '../tools/create-bootstrap.mjs';

test('release bootstrap binds an exact ZIP digest and refuses version/path injection',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'cwb-bootstrap-'));
 const archive=path.join(root,'CodexWallpaperBridge-0.1.0-alpha.0.zip'),output=path.join(root,'install.ps1');
 const bytes=Buffer.from([80,75,3,4,1,2,3,4]);await writeFile(archive,bytes);
 const result=await createBootstrap({archive,output,version:'0.1.0-alpha.0'});
 const source=await readFile(output,'utf8');
 assert.equal(result.archiveSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.ok(source.includes("$expected='"+result.archiveSha256+"'"));
 assert.ok(source.includes("$version='0.1.0-alpha.0'"));assert.ok(!source.includes('__CWB_'));
 assert.equal(await readFile(output+'.sha256','utf8'),result.bootstrapSha256+'  install.ps1\n');
 await assert.rejects(createBootstrap({archive,output,version:"0.1.0';invoke-anything"}),/Invalid release version/);
 await assert.rejects(createBootstrap({archive:path.join(root,'wrong.zip'),output,version:'0.1.0-alpha.0'}),/filename/);
});
