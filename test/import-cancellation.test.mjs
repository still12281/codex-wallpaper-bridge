import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {createActions} from '../src/wallpaper-actions.mjs';import {createImportJobs} from '../src/import-jobs.mjs';
import {convertMedia} from '../src/media-converter.mjs';import {findFFmpeg,defaultSettings} from '../src/runtime-paths.mjs';
test('queued cancellation belongs to one owner and committing work refuses cancellation',()=>{
 const jobs=createImportJobs(),owner={},other={},req={action:'wallpaper-engine',operationId:'fixture'},job=jobs.begin(owner,req);
 assert.equal(jobs.cancel(other,'fixture').cancelAccepted,false);assert.equal(job.controller.signal.aborted,false);assert(jobs.cancel(owner,'fixture').cancelAccepted);assert.equal(job.controller.signal.reason.code,'IMPORT_CANCELLED');jobs.end(job);
 assert.equal(jobs.begin(owner,req).controller.signal.aborted,true);
 const next=jobs.begin(owner,{...req,operationId:'next'});next.phase='committing';assert.equal(jobs.cancel(owner,'next').cancelAccepted,false);assert.equal(next.controller.signal.aborted,false);
});
test('registered queued import is cancelled before resolution and incomplete upload owner is cleaned',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-cancel-upload-'));await mkdir(path.join(root,'media'));const owner={},other={},config=defaultSettings(),actions=createActions(root,config,async()=>{}),req={action:'wallpaper-engine',projectToken:'not-resolved',operationId:'queued'};
 actions.beginImport(owner,req);assert((await actions(owner,{action:'import-cancel',operationId:'queued'})).cancelAccepted);await assert.rejects(actions(owner,req),e=>e.code==='IMPORT_CANCELLED');
 const upload=await actions(owner,{action:'import-start',name:'fixture.png',mime:'image/png',size:5,operationId:'upload'});await actions(owner,{action:'import-chunk',uploadId:upload.uploadId,data:Buffer.from('xx').toString('base64')});
 await actions(other,{action:'import-cancel',operationId:'upload'});assert.equal((await readdir(path.join(root,'media'))).length,1);await actions.disposeOwner(owner);assert.deepEqual(await readdir(path.join(root,'media')),[]);assert.deepEqual(config.library,[]);
});
test('abort kills only the active conversion and removes output after the child closes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-cancel-convert-'));await mkdir(path.join(root,'media'));const source=path.join(root,'source.mp4'),ffmpeg=await findFFmpeg();
 await promisify(execFile)(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','testsrc2=s=1280x720:r=60','-t','3','-c:v','libx264','-preset','ultrafast','-threads','2','-pix_fmt','yuv420p',source],{windowsHide:true});
 const controller=new AbortController();let converting=false;
 await assert.rejects(convertMedia(root,source,'video/mp4','aa11',{maxWidth:960,fps:12},{signal:controller.signal,onProgress:p=>{if(p.phase==='转换'&&!converting){converting=true;setTimeout(()=>controller.abort(Object.assign(Error('cancelled fixture'),{code:'IMPORT_CANCELLED'})),20);}}}),e=>e.code==='IMPORT_CANCELLED');
 assert(converting);assert.deepEqual(await readdir(path.join(root,'media')),[]);assert((await readFile(source)).length>0);
});
test('cancellation during commit does not delete a source being adopted',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-cancel-commit-'));await mkdir(path.join(root,'media'));const source=path.join(root,'image.png'),ffmpeg=await findFFmpeg();await promisify(execFile)(ffmpeg,['-v','error','-f','lavfi','-i','color=red:s=16x16','-frames:v','1','-threads','1',source],{windowsHide:true});
 const bytes=await readFile(source),owner={},config=defaultSettings();let release,entered;const gate=new Promise(r=>entered=r),actions=createActions(root,config,async()=>{entered();await new Promise(r=>release=r);});
 const u=await actions(owner,{action:'import-start',operationId:'commit',name:'fixture.png',mime:'image/png',size:bytes.length});await actions(owner,{action:'import-chunk',uploadId:u.uploadId,data:bytes.toString('base64')});
 const completing=actions(owner,{action:'import-end',uploadId:u.uploadId});await gate;const cancelled=await actions(owner,{action:'import-cancel',operationId:'commit'});assert.equal(cancelled.cancelAccepted,false);release();await completing;assert.equal(config.library.length,1);assert.equal((await readdir(path.join(root,'media'))).length,2);
});
test('declining repeated scene reviews releases the bounded operation slots',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-cancel-review-'));await mkdir(path.join(root,'media'));await mkdir(path.join(root,'scene'));await writeFile(path.join(root,'scene/project.json'),JSON.stringify({title:'Fixture',type:'scene'}));
 const owner={},config=defaultSettings(),actions=createActions(root,config,async()=>{}),catalog=await actions(owner,{action:'engine-list',scope:'folder',folder:root,kind:'engine'}),projectToken=catalog.wallpapers[0].token;
 for(let i=0;i<40;i++){const operationId='review-'+i;assert((await actions(owner,{action:'wallpaper-engine',operationId,projectToken,renderMode:'webwallgl',apply:false})).confirmation);assert((await actions(owner,{action:'import-cancel',operationId})).cancelAccepted);}
 assert.deepEqual(config.library,[]);
});
