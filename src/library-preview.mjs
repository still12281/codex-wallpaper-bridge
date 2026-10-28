import {readFile,realpath,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {findFFmpeg} from './runtime-paths.mjs';
const run=promisify(execFile);
const fingerprints=new Map(),previews=new Map();let previewBytes=0;
const version=(file,info)=>JSON.stringify([file,info.dev,info.ino,info.size,info.mtimeMs,info.ctimeMs]);
export function libraryMode(entry){return entry.mode==='webwallgl'?'GPU 直绘（WebGL）':entry.mode==='realtime'?(entry.engine==='chromium-web'?'网页浏览器（试验）':'原生实时渲染'):entry.mime?.startsWith('video/')?'视频直接播放':'图片直接显示';}
export async function hashMedia(file,{signal,onProgress=()=>{}}={}){
 signal?.throwIfAborted();const absolute=await realpath(file),before=await stat(absolute),key=version(absolute,before);
 if(fingerprints.has(key)){const hash=fingerprints.get(key);fingerprints.delete(key);fingerprints.set(key,hash);onProgress({phase:'指纹',processedBytes:before.size,totalBytes:before.size,cacheHit:true});signal?.throwIfAborted();return hash;}
 const hash=createHash('sha256');let bytes=0;onProgress({phase:'指纹'});
 for await(const chunk of createReadStream(absolute,{signal,highWaterMark:1024*1024})){hash.update(chunk);bytes+=chunk.length;onProgress({phase:'指纹',processedBytes:bytes,totalBytes:before.size});}
 signal?.throwIfAborted();if(bytes!==before.size||version(absolute,await stat(absolute))!==key)throw Error('原素材在指纹计算期间发生变化，请重试');
 const result=hash.digest('hex');fingerprints.set(key,result);while(fingerprints.size>64)fingerprints.delete(fingerprints.keys().next().value);return result;
}
export function duplicateEntry(settings,{mode='media',engine,sourceKey,workshopId,contentHash}){if(contentHash)return settings.library.find(e=>e.contentHash===contentHash);const matches=settings.library.filter(e=>(sourceKey&&e.sourceKey===sourceKey)||(workshopId&&e.workshopId===workshopId));if(engine)return matches.find(e=>e.mode===mode&&(e.engine||'wallpaper-engine')===engine);return matches.find(e=>e.mode===mode)||matches.find(e=>e.id===settings.selectedId)||matches[0];}
async function projectPreview(root){
 const canonical=await realpath(root),metadata=path.join(canonical,'project.json');if((await stat(metadata)).size>1024*1024)return null;
 const project=JSON.parse(await readFile(metadata,'utf8'));if(typeof project.preview!=='string'||path.isAbsolute(project.preview)||!/^\.(jpg|jpeg|png|webp|gif)$/i.test(path.extname(project.preview)))return null;
 const file=await realpath(path.join(canonical,project.preview)),relative=path.relative(canonical,file);if(relative.startsWith('..')||path.isAbsolute(relative)||(await stat(file)).size>8*1024*1024)return null;return file;
}
export async function libraryPreview(root,entry){
 const info={name:entry.name,label:libraryMode(entry),mode:entry.mode||'media',preview:null};
 try{
  let file;if(['webwallgl','realtime'].includes(entry.mode))file=await projectPreview(entry.projectRoot);else{file=await realpath(path.resolve(root,entry.file));const relative=path.relative(await realpath(root),file);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('预览缓存路径越界');}
  if(!file)return info;const before=await stat(file),key=version(file,before);if(previews.has(key)){const cached=previews.get(key);previews.delete(key);previews.set(key,cached);info.preview=cached;return info;}
  const format={'.jpg':'jpeg_pipe','.jpeg':'jpeg_pipe','.png':'png_pipe','.webp':'webp_pipe','.gif':'gif','.mp4':'mov','.webm':'matroska'}[path.extname(file).toLowerCase()];if(!format)return info;
  const mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'}[path.extname(file).toLowerCase()];
  if(mime&&before.size<=1024*1024)info.preview='data:'+mime+';base64,'+(await readFile(file)).toString('base64');
  else{const ffmpeg=await findFFmpeg();const {stdout}=await run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-threads','1','-protocol_whitelist','file,pipe','-f',format,'-i',file,'-an','-vf','scale=640:360:force_original_aspect_ratio=decrease','-frames:v','1','-threads','1','-f','image2pipe','-vcodec','mjpeg','pipe:1'],{windowsHide:true,encoding:'buffer',timeout:12000,maxBuffer:2*1024*1024});info.preview='data:image/jpeg;base64,'+stdout.toString('base64');}
  if(version(file,await stat(file))!==key)throw Error('预览素材已改变');
  const size=Buffer.byteLength(info.preview||'');if(size&&size<=8*1024*1024){previews.set(key,info.preview);previewBytes+=size;while(previews.size>64||previewBytes>8*1024*1024){const oldest=previews.keys().next().value;previewBytes-=Buffer.byteLength(previews.get(oldest));previews.delete(oldest);}}
 }catch{info.preview=null;info.previewUnavailable=true;}
 return info;
}
