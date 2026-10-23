import {findFFmpeg} from './runtime-paths.mjs';
import {spawn} from 'node:child_process';
import {stat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {setPriority,constants} from 'node:os';
import {randomUUID} from 'node:crypto';
export async function convertMedia(root,input,mime,id,profile={maxWidth:1280,fps:24}){
 const ffmpeg=await findFFmpeg();
 const width=Number(profile.maxWidth),fps=Number(profile.fps);
 if(![960,1280,1920,2560,3840].includes(width)||![12,24,30,60].includes(fps))throw Error('播放规格无效');
 const height=Math.floor(width*900/1280/2)*2;
 const maxBytes=width<=1280&&fps<=30?32*1024*1024:128*1024*1024;
 const motion=mime.startsWith('video/')||mime==='image/gif';
 if(!/^(default|[a-f0-9-]+)$/i.test(id))throw Error('壁纸标识无效');
 const extension=motion?'.mp4':'.webp';
 const file='media/pending-'+id+'-'+randomUUID()+extension;
 const destination='media/wallpaper-'+id+extension;
 const scale=`scale=w='min(${width},iw)':h='min(${height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`;
 const rate=Math.max(2,Math.round(3*Math.pow(width/1280,1.5)*fps/24));
 const args=['-hide_banner','-nostdin','-n','-threads','2',...(mime==='image/gif'?['-ignore_loop','1']:[]),'-i',input,'-an','-vf',scale+(motion?`,fps='min(source_fps,${fps})'`:''),'-filter_threads','1'];
 if(motion)args.push('-c:v','libx264','-preset','fast','-crf','23','-maxrate',rate+'M','-bufsize',(rate*2)+'M','-threads','2','-pix_fmt','yuv420p','-movflags','+faststart');
 else args.push('-frames:v','1','-c:v','libwebp','-quality','85','-threads','2');
 args.push(path.join(root,file));
 try{await new Promise((resolve,reject)=>{let log='',timedOut=false;const child=spawn(ffmpeg,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});try{setPriority(child.pid,constants.priority.PRIORITY_BELOW_NORMAL)}catch{}
  const timer=setTimeout(()=>{timedOut=true;child.kill()},150000);
  child.stderr.on('data',b=>{log=(log+b).slice(-1600)});child.on('error',e=>{clearTimeout(timer);reject(e)});child.on('exit',code=>{clearTimeout(timer);timedOut?reject(Error('生成轻量副本超时，请缩短视频或降低原素材分辨率')):code===0?resolve():reject(Error('素材转换失败：'+log.slice(-300)))})});
 if((await stat(path.join(root,file))).size>maxBytes)throw Error('播放副本过大，请缩短视频或降低规格');
 }catch(e){await unlink(path.join(root,file)).catch(()=>{});throw e}
 return {file,destination,mime:motion?'video/mp4':'image/webp',limits:{maxWidth:width,maxHeight:height,fps:motion?fps:null,maxBytes,muted:true}};
}
