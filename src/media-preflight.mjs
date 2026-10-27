import {findFFmpeg} from './runtime-paths.mjs';
import {access,stat,statfs} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {cachedConversion} from './conversion-cache.mjs';
const run=promisify(execFile),probes=new Map();
export function mediaLimits(profile){
 const maxWidth=Number(profile.maxWidth),fps=Number(profile.fps);
 if(![960,1280,1920,2560,3840].includes(maxWidth)||![12,24,30,60].includes(fps))throw Error('播放规格无效');
 return {maxWidth,maxHeight:Math.floor(maxWidth*900/1280/2)*2,fps,maxBytes:maxWidth<=1280&&fps<=30?32*1024*1024:128*1024*1024,muted:true};
}
const rate=value=>{const [n,d=1]=String(value||'0').split('/').map(Number);return d&&Number.isFinite(n/d)?n/d:0;};
export async function probeMedia(input,{signal}={}){
 signal?.throwIfAborted();const info=await stat(input);if(!info.isFile()||!info.size)throw Error('素材为空或不是普通文件');
 const key=JSON.stringify([path.resolve(input),info.size,info.mtimeMs,info.ctimeMs]);if(probes.has(key))return {...probes.get(key),probeMs:0,probeCacheHit:true};
 const ffmpeg=await findFFmpeg(),ffprobe=path.join(path.dirname(ffmpeg),process.platform==='win32'?'ffprobe.exe':'ffprobe');await access(ffprobe);
 const start=performance.now();let parsed;
 try{const {stdout}=await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',input],{windowsHide:true,timeout:12000,maxBuffer:2*1024*1024,signal});parsed=JSON.parse(stdout);}
 catch(error){if(signal?.aborted)throw signal.reason;throw Error('素材预检失败：文件损坏、无法读取或缺少可用的 ffprobe（'+error.message.slice(0,160)+'）');}
 const video=parsed.streams?.find(s=>s.codec_type==='video'&&!s.disposition?.attached_pic);if(!video?.width||!video?.height)throw Error('素材没有可读取的图像/视频流');
 const result={key,bytes:info.size,mtimeMs:info.mtimeMs,ctimeMs:info.ctimeMs,width:video.width,height:video.height,codec:video.codec_name,pixelFormat:video.pix_fmt,sar:video.sample_aspect_ratio,rotation:Number(video.tags?.rotate||video.side_data_list?.find(s=>s.rotation!==undefined)?.rotation||0),fps:rate(video.avg_frame_rate||video.r_frame_rate),duration:Math.max(0,Number(parsed.format?.duration||video.duration)||0),audio:parsed.streams.some(s=>s.codec_type==='audio'),format:parsed.format?.format_name||'',probeMs:performance.now()-start};
 probes.set(key,result);while(probes.size>32)probes.delete(probes.keys().next().value);return result;
}
export async function planMedia(root,input,mime,profile,options={}){
 const limits=mediaLimits(profile),source=await probeMedia(input,options),motion=mime.startsWith('video/')||mime==='image/gif';
 const fits=source.width<=limits.maxWidth&&source.height<=limits.maxHeight&&(!motion||(source.fps>0&&source.fps<=limits.fps+.01));
 const squarePixels=!source.sar||['0:1','1:1','N/A'].includes(source.sar),unrotated=source.rotation===0;
 const image=!motion&&({'image/png':'png','image/jpeg':'mjpeg','image/webp':'webp'})[mime]===source.codec;
 const video=mime==='video/mp4'&&source.format.includes('mp4')&&source.codec==='h264'&&source.pixelFormat==='yuv420p'&&squarePixels&&unrotated;
 let route=fits&&(motion||source.bytes<=limits.maxBytes)&&(image||video)?(video&&source.audio?'remux':'copy'):'transcode';
 const extension=route==='copy'?({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','video/mp4':'.mp4'})[mime]:motion?'.mp4':'.webp';
 const cacheKey=createHash('sha256').update(JSON.stringify(['media-preparation-v2',source.key,mime,{...limits,maxBytes:motion?'file-backed':limits.maxBytes}])).digest('hex');
 const cached=await cachedConversion(root,cacheKey,extension);if(cached)route='cache';
 const rateMbps=Math.max(2,Math.round(3*Math.pow(limits.maxWidth/1280,1.5)*limits.fps/24));
 const estimatedBytes=motion&&route==='transcode'&&source.duration?Math.ceil(source.duration*rateMbps*1e6/8*1.03):source.bytes;
 const space=await statfs(root),reserve=64*1024*1024,available=space.bavail*space.bsize;
 if(motion){limits.fileBacked=true;limits.maxBytes=Math.max(0,Math.floor(available-reserve));}
 const requiredBytes=Math.max(source.bytes,motion?estimatedBytes:Math.min(estimatedBytes,limits.maxBytes))+reserve;
 if(space.bavail*space.bsize<requiredBytes)throw Error('保存空间不足，请先释放空间或更换素材；原素材保持不变');
 const risk=motion&&route==='transcode'&&source.duration&&estimatedBytes>limits.maxBytes;
 if(risk&&!options.acceptSizeRisk)throw Object.assign(Error('按当前规格估算可能超过播放容量；估算不是保证。可返回选择较低规格，或确认按原规格尝试。'),{code:'IMPORT_SIZE_REVIEW',review:{duration:source.duration,estimatedMiB:Math.round(estimatedBytes/1048576),maxMiB:limits.maxBytes/1048576}});
 options.signal?.throwIfAborted();return {source,limits,route,motion,rateMbps,estimatedBytes,cacheKey,cached,extension,outputMime:{'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4'}[extension]};
}
