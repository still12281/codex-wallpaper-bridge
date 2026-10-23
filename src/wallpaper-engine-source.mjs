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
 if(type!=='scene')throw Error('轻量模式暂不支持这类壁纸，请使用图片或视频壁纸');
 const pkgPath=await realpath(path.join(projectRoot,'scene.pkg'));if(!pkgPath.toLowerCase().startsWith((projectRoot+path.sep).toLowerCase()))throw Error('场景包路径不受支持');const size=(await stat(pkgPath)).size;
 const handle=await open(pkgPath,'r');let candidate;
 try{
  const header=Buffer.alloc(Math.min(8*1024*1024,size));await handle.read(header,0,header.length,0);
  const magicLength=header.readUInt32LE(0);if(magicLength>16||magicLength<4)throw Error('场景包格式无效');
  if(header.readUInt32LE(4+magicLength)>50000)throw Error('场景资源表过大，轻量导入不支持');
  const pkg=parsePkg(header);const videos=[];
  for(const entry of pkg.entries){
   const start=pkg.dataStart+entry.offset;if(start+entry.size>size)throw Error('场景资源越界');
   if(/\.(mp4|webm)$/i.test(entry.name)){videos.push({start,size:entry.size,mime:/\.webm$/i.test(entry.name)?'video/webm':'video/mp4'});continue}
   if(!/\.tex$/i.test(entry.name)||entry.size<100000)continue;
   const sample=Buffer.alloc(Math.min(entry.size,4096));await handle.read(sample,0,sample.length,start);
   try{const tex=parseTex(sample,{name:entry.name});if(tex.isVideo){const payload=tex.images[0][0].data;const offset=payload.byteOffset-sample.byteOffset;videos.push({start:start+offset,size:entry.size-offset,mime:'video/mp4'})}}catch{}
  }
  if(videos.length!==1)throw Error('当前场景不含单一背景视频，轻量模式暂不支持；请选择视频壁纸');candidate=videos[0];
 }finally{await handle.close()}
 await mkdir(path.join(root,'staging'),{recursive:true});const input=path.join(root,'staging','we-'+id+'.mp4');
 await pipeline(createReadStream(pkgPath,{start:candidate.start,end:candidate.start+candidate.size-1}),createWriteStream(input,{flags:'wx'}));
 return {input,mime:candidate.mime,name:title+' · 视频层',source:'Wallpaper Engine 场景中的视频层（不含独立脚本组件）',...metadata,temporary:true};
}
