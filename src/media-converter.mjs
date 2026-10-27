import {findFFmpeg} from './runtime-paths.mjs';
import {planMedia} from './media-preflight.mjs';
import {spawn} from 'node:child_process';
import {stat,unlink,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {setPriority,constants} from 'node:os';
import {randomUUID} from 'node:crypto';
export async function convertMedia(root,input,mime,id,profile={maxWidth:1280,fps:24},options={}){
 const start=performance.now(),{signal,onProgress=()=>{}}=options;
 if(!/^(default|[a-f0-9-]+)$/i.test(id))throw Error('壁纸标识无效');
 onProgress({phase:'预检'});const {source,limits,route,motion,rateMbps,cacheKey,cached,extension,outputMime}=await planMedia(root,input,mime,profile,options);signal?.throwIfAborted();
 const file='media/pending-'+id+'-'+randomUUID()+extension,destination='media/wallpaper-'+id+'-'+randomUUID()+extension,output=path.join(root,file);
 let conversionMs=0;
 try{
  onProgress({phase:route==='cache'?'复用转换结果':route==='copy'?'直接复用':route==='remux'?'快速封装':'转换',route,duration:source.duration});const prepared=performance.now();
  if(route==='copy'||route==='cache'){await copyFile(cached||input,output);signal?.throwIfAborted();}
  else{
   const ffmpeg=await findFFmpeg();
   const args=['-hide_banner','-nostdin','-n','-threads','2','-protocol_whitelist','file,pipe',...(mime==='image/gif'?['-ignore_loop','1']:[]),'-i',input,'-map','0:v:0','-an'];
   if(route==='remux')args.push('-c:v','copy','-movflags','+faststart');
   else{
    const scale=`scale=w='min(${limits.maxWidth},iw)':h='min(${limits.maxHeight},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`;
    args.push('-vf',scale+(motion?`,fps='min(source_fps,${limits.fps})'`:''),'-filter_threads','1');
    if(motion)args.push('-c:v','libx264','-preset','fast','-crf','23','-maxrate',rateMbps+'M','-bufsize',(rateMbps*2)+'M','-threads','2','-pix_fmt','yuv420p','-movflags','+faststart');
    else args.push('-frames:v','1','-c:v','libwebp','-quality','85','-threads','2');
   }
   args.push('-progress','pipe:1','-nostats',output);
   await new Promise((resolve,reject)=>{
    let log='',failure,lastProgress=Date.now(),checking=false,finished=false;const child=spawn(ffmpeg,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});try{setPriority(child.pid,constants.priority.PRIORITY_BELOW_NORMAL)}catch{}
    const stop=error=>{failure??=error;child.kill();};const abort=()=>stop(signal.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    const timer=setInterval(async()=>{if(checking||finished)return;checking=true;try{if((await stat(output)).size>limits.maxBytes)stop(Error('输出已达到 '+limits.maxBytes/1048576+' MiB 上限，已停止并清理；请返回选择其他规格，不会采用截短视频'));}catch{}finally{checking=false;}if(!finished&&Date.now()-lastProgress>45000)stop(Error('转换超过45秒无进展，已停止；可检查素材或重试'));},250);
    const deadline=setTimeout(()=>stop(Error('本次转换达到15分钟上限，已停止并保留原素材')),900000);
    child.stdout.on('data',b=>{lastProgress=Date.now();const time=String(b).match(/out_time_us=(\d+)/)?.[1];if(time)onProgress({phase:route==='remux'?'快速封装':'转换',route,processedSeconds:Number(time)/1e6,duration:source.duration});});
    child.stderr.on('data',b=>{log=(log+b).slice(-1600)});
    const finish=error=>{if(finished)return;finished=true;clearInterval(timer);clearTimeout(deadline);signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
    child.on('error',finish);child.on('close',code=>finish(failure||(code===0?null:Error('素材转换失败：'+log.slice(-300)))));
   });
  }
  conversionMs=performance.now()-prepared;signal?.throwIfAborted();
  const after=await stat(input);if(after.size!==source.bytes||after.mtimeMs!==source.mtimeMs||after.ctimeMs!==source.ctimeMs)throw Error('原素材在导入期间发生变化，请重试');
  if((await stat(output)).size>limits.maxBytes)throw Error('播放副本超过 '+limits.maxBytes/1048576+' MiB，请选择其他规格；未采用不完整输出');
 }catch(error){await unlink(output).catch(()=>{});throw error;}
 return {file,destination,cacheKey,mime:outputMime,limits:{...limits,fps:motion?limits.fps:null},importInfo:{route,sourceWidth:source.width,sourceHeight:source.height,sourceFps:source.fps,duration:source.duration,probeMs:source.probeMs,probeCacheHit:!!source.probeCacheHit,conversionMs,totalMs:performance.now()-start}};
}
