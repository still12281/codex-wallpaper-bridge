import {readFile,stat,realpath} from 'node:fs/promises';
import {projectKey,discoverEngineRoots} from './engine-library.mjs';
import path from 'node:path';
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
export async function inspectEngineProject(projectDirectory,renderMode='auto'){
 const root=await realpath(projectDirectory),projectPath=path.join(root,'project.json'),projectStat=await stat(projectPath),project=JSON.parse(await readFile(projectPath,'utf8')),type=String(project.type||'').toLowerCase();
 if(['image','video'].includes(type)){const input=await realpath(path.resolve(root,project.file||''));if(!input.toLowerCase().startsWith((root+path.sep).toLowerCase()))throw Error('壁纸素材路径不受支持');await stat(input);return {supported:true,needsRealtime:false,mode:'media',label:'不需要实时渲染',reason:type==='video'?'当前选中的是视频，生成播放副本后直接播放。':'当前选中的是图片，直接生成显示副本。'}}
 if(!['scene','web'].includes(type))return {supported:false,needsRealtime:null,mode:'unsupported',label:'此项目暂不支持',reason:'无法识别的项目类型：'+type};
 if(type==='web'||renderMode==='realtime')return {supported:true,needsRealtime:true,mode:'realtime',label:'需要实时渲染',reason:type==='web'?'当前选中的是网页壁纸，需要 Wallpaper Engine 持续运行。':'已选择完整场景模式，此项目由 Wallpaper Engine 实时运行。'};
 if(renderMode==='video-layer')return {supported:false,needsRealtime:true,mode:'unsupported',label:'视频层导入已移除',reason:'请选择 GPU 流畅模式或原版兼容模式。'};
 return {supported:true,needsRealtime:true,mode:'webwallgl',label:'GPU 场景',reason:'保留完整场景；音频响应由媒体设置控制。'};
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
 throw Object.assign(Error('场景和网页请使用 GPU 或原版兼容模式'),{code:['scene','web'].includes(type)?'REALTIME_REQUIRED':'UNSUPPORTED_TYPE'});
}
