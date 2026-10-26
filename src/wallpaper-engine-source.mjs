import {readFile,open,stat,mkdir,readdir,realpath} from 'node:fs/promises';
import {projectKey,discoverEngineRoots} from './engine-library.mjs';
import {createReadStream,createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {parsePkg} from '../vendor/webwallgl/we-scene/pkg/container.js';
import {parseTex} from '../vendor/webwallgl/we-scene/pkg/texture.js';
export async function getCurrentEngineProject(){
 const discovery=await discoverEngineRoots();
 for(const engine of discovery.engines){
  let config;try{config=JSON.parse(await readFile(path.join(engine,'config.json'),'utf8'))}catch{continue}
  const username=process.env.USERNAME||'',userKey=Object.keys(config).find(k=>k.toLowerCase()===username.toLowerCase());
  const users=[config[userKey],...Object.values(config)].filter(Boolean);
  for(const user of users){const selected=user?.general?.wallpaperconfig?.selectedwallpapers;if(!selected)continue;const entries=Array.isArray(selected)?selected:Object.values(selected);const file=selected.Monitor0?.file||entries.find(e=>e?.file)?.file;if(!file)continue;
   try{const root=await realpath(path.dirname(file));await stat(path.join(root,'project.json'));return {root,sourceKey:projectKey(root),workshopId:root.replace(/\\/g,'/').match(/\/workshop\/content\/431960\/(\d+)$/i)?.[1],kind:'engine'}}catch{}
  }
 }
 throw Error('没有找到可用的 Wallpaper Engine 当前壁纸，请使用搜索或手动导入');
}
export async function probeSceneVideo(pkgPath){
 const size=(await stat(pkgPath)).size,handle=await open(pkgPath,'r');
 try{
  const header=Buffer.alloc(Math.min(8*1024*1024,size));await handle.read(header,0,header.length,0);
  if(header.length<16)throw Error('场景包文件不完整');const magicLength=header.readUInt32LE(0);if(magicLength>16||magicLength<4)throw Error('场景包格式无效');
  if(header.readUInt32LE(4+magicLength)>50000)throw Error('场景资源表过大，无法完成轻量预检');
  const pkg=parsePkg(header),videos=[];
  for(const entry of pkg.entries){
   const start=pkg.dataStart+entry.offset;if(start+entry.size>size||start<0)throw Error('场景资源越界');
   if(/\.(mp4|webm)$/i.test(entry.name)){videos.push({start,size:entry.size,mime:/\.webm$/i.test(entry.name)?'video/webm':'video/mp4'});continue}
   if(!/\.tex$/i.test(entry.name)||entry.size<100000)continue;
   const sample=Buffer.alloc(Math.min(entry.size,4096));await handle.read(sample,0,sample.length,start);
   try{const tex=parseTex(sample,{name:entry.name});if(tex.isVideo){const payload=tex.images[0][0].data,offset=payload.byteOffset-sample.byteOffset;videos.push({start:start+offset,size:entry.size-offset,mime:'video/mp4'})}}catch{}
  }
  return {videoCount:videos.length,candidate:videos.length===1?videos[0]:null};
 }finally{await handle.close()}
}
const inspectionCache=new Map();
export async function inspectEngineProject(projectDirectory,renderMode='auto'){
 const root=await realpath(projectDirectory),projectPath=path.join(root,'project.json'),projectStat=await stat(projectPath),project=JSON.parse(await readFile(projectPath,'utf8')),type=String(project.type||'').toLowerCase();
 if(['image','video'].includes(type)){const input=await realpath(path.resolve(root,project.file||''));if(!input.toLowerCase().startsWith((root+path.sep).toLowerCase()))throw Error('壁纸素材路径不受支持');await stat(input);return {supported:true,needsRealtime:false,mode:'media',label:'不需要实时渲染',reason:type==='video'?'当前选中的是视频，生成播放副本后直接播放。':'当前选中的是图片，直接生成显示副本。'}}
 if(!['scene','web'].includes(type))return {supported:false,needsRealtime:null,mode:'unsupported',label:'此项目暂不支持',reason:'无法识别的项目类型：'+type};
 if(type==='web'||renderMode==='realtime')return {supported:true,needsRealtime:true,mode:'realtime',label:'需要实时渲染',reason:type==='web'?'当前选中的是网页壁纸，需要 Wallpaper Engine 持续运行。':'已选择完整场景模式，此项目由 Wallpaper Engine 实时运行。'};
 if(renderMode==='auto'&&project.general?.supportsaudioprocessing===true)return {supported:true,needsRealtime:true,mode:'realtime',label:'音频响应场景 · 需要完整实时渲染',reason:'此项目声明支持音频响应。视频层不包含独立音频条、场景特效或脚本；自动模式保留完整场景。若只要背景视频，可明确选择“仅视频层”。'};
 const pkgPath=await realpath(path.join(root,'scene.pkg'));if(!pkgPath.toLowerCase().startsWith((root+path.sep).toLowerCase()))throw Error('场景包路径不受支持');const pkgStat=await stat(pkgPath),key=[root,projectStat.mtimeMs,projectStat.size,pkgStat.mtimeMs,pkgStat.size].join('|');
 if(inspectionCache.has(key))return inspectionCache.get(key);
 const result=await probeSceneVideo(pkgPath),verdict=result.candidate?{supported:true,needsRealtime:false,mode:'video-layer',label:'当前轻量模式不需要实时渲染',reason:'已检查此项目，可提取单一视频层。该方式不包含场景独立特效或脚本；需要完整效果时改选完整实时。'}:{supported:true,needsRealtime:true,mode:'realtime',label:'需要实时渲染',reason:`已检查此项目，${result.videoCount?'包含多个视频资源，不能直接作为单一背景视频。':'没有可提取的独立背景视频。'}将由 Wallpaper Engine 运行完整场景。`};
 if(inspectionCache.size>128)inspectionCache.clear();inspectionCache.set(key,verdict);return verdict;
}
export async function currentEngineSource(root,id,workshopId,projectDirectory){
 if(!projectDirectory){
  if(workshopId){if(!/^\d{4,20}$/.test(workshopId))throw Error('工坊ID无效');const discovery=await discoverEngineRoots();for(const base of discovery.roots.filter(p=>path.basename(p)==='431960')){try{const candidate=path.join(base,workshopId);await stat(path.join(candidate,'project.json'));projectDirectory=candidate;break}catch{}}if(!projectDirectory)throw Error('没有找到该工坊项目，请重新搜索')}
  else projectDirectory=(await getCurrentEngineProject()).root;
 }
 const projectRoot=await realpath(projectDirectory),project=JSON.parse(await readFile(path.join(projectRoot,'project.json'),'utf8'));
 const metadata={sourceKey:projectKey(projectRoot),workshopId:projectRoot.replace(/\\/g,'/').match(/\/workshop\/content\/431960\/(\d+)$/i)?.[1]};
 const title=String(project.title||path.basename(projectRoot)).slice(0,120);
 const type=String(project.type||'').toLowerCase();
 if(['video','image'].includes(type)){
  const input=await realpath(path.resolve(projectRoot,project.file||''));if(!input.toLowerCase().startsWith((projectRoot+path.sep).toLowerCase()))throw Error('壁纸素材路径不受支持');
  const extension=path.extname(input).toLowerCase(),mime={'.mp4':'video/mp4','.webm':'video/webm','.gif':'image/gif','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[extension];
  if(!mime)throw Error('当前壁纸媒体格式暂不支持');return {input,mime,name:title,source:'Wallpaper Engine',...metadata,temporary:false};
 }
 if(type!=='scene')throw Object.assign(Error('轻量模式暂不支持这类壁纸，请使用图片或视频壁纸'),{code:type==='web'?'REALTIME_REQUIRED':'UNSUPPORTED_TYPE'});
 const pkgPath=await realpath(path.join(projectRoot,'scene.pkg'));if(!pkgPath.toLowerCase().startsWith((projectRoot+path.sep).toLowerCase()))throw Error('场景包路径不受支持');const {candidate}=await probeSceneVideo(pkgPath);
 if(!candidate)throw Object.assign(Error('当前场景不含单一背景视频，需要实时渲染'),{code:'REALTIME_REQUIRED'});
 await mkdir(path.join(root,'staging'),{recursive:true});const input=path.join(root,'staging','we-'+id+'.mp4');
 await pipeline(createReadStream(pkgPath,{start:candidate.start,end:candidate.start+candidate.size-1}),createWriteStream(input,{flags:'wx'}));
 return {input,mime:candidate.mime,name:title+' · 视频层',source:'Wallpaper Engine 场景中的视频层（不含独立脚本组件）',...metadata,temporary:true};
}
