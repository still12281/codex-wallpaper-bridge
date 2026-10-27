import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';import path from 'node:path';
import {findFFmpeg,defaultSettings} from '../src/runtime-paths.mjs';
import {convertMedia} from '../src/media-converter.mjs';
import {planMedia,probeMedia} from '../src/media-preflight.mjs';
import {createActions} from '../src/wallpaper-actions.mjs';
import {commitConverted} from '../src/media-store.mjs';
const run=promisify(execFile),profile={maxWidth:1280,fps:24};
test('real media preparation copies compatible bytes, remuxes audio and filters only when needed',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-media-prepare-'));await mkdir(path.join(root,'media'));const ffmpeg=await findFFmpeg();
 const video=path.join(root,'source.mp4'),audio=path.join(root,'audio.mp4'),image=path.join(root,'source.png');
 await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-threads','2',video],{windowsHide:true});
 await run(ffmpeg,['-v','error','-nostdin','-i',video,'-f','lavfi','-i','sine=frequency=440','-t','1','-c:v','copy','-c:a','aac',audio],{windowsHide:true});
 await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','color=red:s=32x32','-frames:v','1','-threads','1',image],{windowsHide:true});
 for(const [file,mime,id]of [[video,'video/mp4','a1'],[image,'image/png','a2']]){const result=await convertMedia(root,file,mime,id,profile);assert.equal(result.importInfo.route,'copy');assert.deepEqual(await readFile(path.join(root,result.file)),await readFile(file));assert.equal(result.mime,mime);}
 const remux=await convertMedia(root,audio,'video/mp4','a3',profile);assert.equal(remux.importInfo.route,'remux');assert.equal((await probeMedia(path.join(root,remux.file))).audio,false);assert.equal((await probeMedia(audio)).audio,true);
 const transcode=await convertMedia(root,video,'video/mp4','a4',{...profile,fps:12});assert.equal(transcode.importInfo.route,'transcode');assert((await probeMedia(path.join(root,transcode.file))).fps<=12.01);
 const entry={id:'a4'},settings={library:[entry]};await commitConverted(root,settings,entry,transcode,{},async()=>{},async()=>{});
 const reused=await convertMedia(root,video,'video/mp4','a6',{...profile,fps:12});assert.equal(reused.importInfo.route,'cache');assert.deepEqual(await readFile(path.join(root,reused.file)),await readFile(path.join(root,entry.file)));assert.equal(reused.mime,'video/mp4');
 const first=await probeMedia(video),cached=await probeMedia(video);assert.equal(cached.probeCacheHit,true);assert.equal(first.key,cached.key);
});
test('corrupt uploads are cleaned without creating library records or touching the background',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-bad-upload-'));await mkdir(path.join(root,'media'));const config=defaultSettings();let applies=0;const owner={},actions=createActions(root,config,async()=>applies++),bytes=Buffer.from('invalid png');
 const {uploadId}=await actions(owner,{action:'import-start',name:'bad.png',mime:'image/png',size:bytes.length});await actions(owner,{action:'import-chunk',uploadId,data:bytes.toString('base64')});await assert.rejects(actions(owner,{action:'import-end',uploadId}),/预检失败|图像/);assert.deepEqual(await readdir(path.join(root,'media')),[]);assert.deepEqual(config.library,[]);assert.equal(applies,0);
 const next=await actions(owner,{action:'import-start',name:'next.png',mime:'image/png',size:10});await actions(owner,{action:'import-cancel',uploadId:next.uploadId});assert.deepEqual(await readdir(path.join(root,'media')),[]);
});
test('capacity uncertainty is surfaced before encoding, while direct sources and cancelled work remain intact',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cwb-media-risk-'));await mkdir(path.join(root,'media'));const ffmpeg=await findFFmpeg(),source=path.join(root,'long.webm');
 await run(ffmpeg,['-v','error','-nostdin','-f','lavfi','-i','color=blue:s=16x16:r=1','-frames:v','2','-vf','setpts=120*PTS','-fps_mode','vfr','-c:v','libvpx','-threads','1',source],{windowsHide:true});
 await assert.rejects(planMedia(root,source,'video/webm',profile),e=>e.code==='IMPORT_SIZE_REVIEW'&&e.review.estimatedMiB>32);assert.deepEqual(await readdir(path.join(root,'media')),[]);
 assert.equal((await planMedia(root,source,'video/webm',profile,{acceptSizeRisk:true})).route,'transcode');
 const abort=new AbortController();abort.abort(Error('cancelled fixture'));await assert.rejects(convertMedia(root,source,'video/webm','a5',profile,{signal:abort.signal}),/cancelled fixture/);await stat(source);assert.deepEqual(await readdir(path.join(root,'media')),[]);
});
