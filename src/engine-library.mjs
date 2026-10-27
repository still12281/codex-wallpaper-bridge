import {readFile,readdir,stat,realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
const run=promisify(execFile);
import {getPowerShell} from './runtime-paths.mjs';
const exists=async p=>{try{return (await stat(p)).isDirectory()}catch{return false}};
const key=p=>path.resolve(p).toLowerCase();
export const projectKey=p=>createHash('sha256').update(key(p)).digest('hex');
const mediaTypes={'.mp4':'video/mp4','.webm':'video/webm','.gif':'image/gif','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
export async function discoverEngineRoots(){
 const command="$ErrorActionPreference='SilentlyContinue'; $steamPaths=@((Get-ItemProperty -LiteralPath 'HKCU:\Software\Valve\Steam').SteamPath,(Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam').InstallPath); $drives=@(Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -in 2,3 } | ForEach-Object { $_.DeviceID + '\\' }); @{steam=$steamPaths;drives=$drives}|ConvertTo-Json -Compress";
 let system;const warnings=[];try{system=JSON.parse((await run(getPowerShell(),['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:12000})).stdout)}catch{system={steam:[],drives:[]};warnings.push('系统库路径读取失败，请使用自选文件夹或检查 PowerShell 配置。')}
 const candidates=new Set((system.steam||[]).filter(Boolean));
 for(const drive of system.drives||[]){for(const name of ['Steam','SteamLibrary','Program Files (x86)/Steam','Program Files/Steam'])candidates.add(path.join(drive,name));try{for(const e of await readdir(drive,{withFileTypes:true}))if(e.isDirectory()&&!e.isSymbolicLink()&&!['Windows','Users','ProgramData','$Recycle.Bin','System Volume Information'].includes(e.name))candidates.add(path.join(drive,e.name))}catch{warnings.push('无法读取磁盘 '+drive)}}
 const libraries=new Map();for(const candidate of candidates)if(await exists(path.join(candidate,'steamapps')))libraries.set(key(candidate),candidate);
 for(const library of libraries.values()){try{const vdf=await readFile(path.join(library,'steamapps/libraryfolders.vdf'),'utf8');for(const m of vdf.matchAll(/"(?:path|\d+)"\s*"((?:\\.|[^"\\])*)"/g)){const p=m[1].replace(/\\\\/g,'\\');if(path.isAbsolute(p)&&await exists(path.join(p,'steamapps')))libraries.set(key(p),p)}}catch{}}
 const roots=new Map(),engines=new Set();
 const add=async p=>{if(await exists(p)){const canonical=await realpath(p);roots.set(key(canonical),canonical)}};
 for(const library of libraries.values()){await add(path.join(library,'steamapps/workshop/content/431960'));let install='wallpaper_engine';try{const manifest=await readFile(path.join(library,'steamapps/appmanifest_431960.acf'),'utf8');install=manifest.match(/"installdir"\s*"([^"\\/]+)"/)?.[1]||install}catch{}const engine=path.join(library,'steamapps/common',install);if(await exists(engine))engines.add(engine)}
 for(const engine of engines){await add(path.join(engine,'projects/myprojects'));await add(path.join(engine,'projects/defaultprojects'));try{const config=JSON.parse(await readFile(path.join(engine,'config.json'),'utf8'));const walk=async value=>{if(typeof value==='string'){const normalized=value.replace(/\\/g,'/'),match=normalized.match(/^(.*?\/steamapps\/workshop\/content\/431960)(?:\/|$)/i);if(match)await add(match[1])}else if(value&&typeof value==='object')for(const child of Object.values(value))await walk(child)};await walk(config)}catch{}}
 return {roots:[...roots.values()],engines:[...engines],warnings};
}
export function createEngineCatalog(){
 const tokens=new Map();let generation=0;
 return {
  async registerMedia(file,owner){
   if(typeof file!=='string'||!path.isAbsolute(file)||/^(?:\\\\|\/\/)/.test(file))throw Error('请选择本机媒体文件');
   const canonical=await realpath(file),info=await stat(canonical),mime=mediaTypes[path.extname(canonical).toLowerCase()];
   if(path.parse(canonical).root.startsWith(path.sep+path.sep))throw Error('请选择本机媒体文件');
   if(!mime||!info.isFile()||!Number.isSafeInteger(info.size)||info.size<1)throw Error('媒体文件无效');
   for(const [key,value]of tokens)if(value.picked&&value.owner===owner)tokens.delete(key);
   const token=randomUUID(),sourceKey=projectKey(canonical);tokens.set(token,{root:path.dirname(canonical),file:canonical,mime,sourceKey,kind:'media',owner,picked:true});return {projectToken:token,name:path.basename(canonical)};
  },
  releaseOwner(owner){for(const [key,value]of tokens)if(value.owner===owner)tokens.delete(key);},
  async search({scope='global',folder='',kind='engine',roots:givenRoots}={}){
   if(!['engine','media'].includes(kind))throw Error('搜索类型无效');if(kind==='media'&&scope!=='folder')throw Error('图片/视频搜索请指定文件夹');
   let roots,warnings=[];if(givenRoots)roots=givenRoots;else if(scope==='folder'){if(typeof folder!=='string'||!path.isAbsolute(folder)||folder.startsWith('\\\\'))throw Error('请选择本地文件夹，或填写完整路径');if(!await exists(folder))throw Error('文件夹不存在或无法读取');roots=[await realpath(folder)]}else if(scope==='global'){({roots,warnings}=await discoverEngineRoots())}else throw Error('搜索范围无效');
   const queue=roots.map(p=>({p,depth:0})),visited=new Set(),items=[],start=Date.now();let directories=0,truncated=false;const nextTokens=new Map();
   for(let i=0;i<queue.length;i++){if(directories>=6000||items.length>=3000||Date.now()-start>15000){truncated=true;break}const {p,depth}=queue[i];let canonical;try{canonical=await realpath(p)}catch{continue}if(visited.has(key(canonical)))continue;visited.add(key(canonical));directories++;
    let project;if(kind==='engine')try{const file=path.join(canonical,'project.json');if((await stat(file)).size>1024*1024)continue;project=JSON.parse(await readFile(file,'utf8'))}catch{}
    if(project){const type=String(project.type||'unknown').toLowerCase(),sourceKey=projectKey(canonical),workshopId=canonical.replace(/\\/g,'/').match(/\/workshop\/content\/431960\/(\d+)$/i)?.[1],token=randomUUID();nextTokens.set(token,{root:canonical,sourceKey,workshopId,kind:'engine',preview:project.preview});items.push({id:workshopId||sourceKey,token,title:String(project.title||path.basename(canonical)).slice(0,160),contentrating:String(project.contentrating||'').slice(0,40),type,location:canonical});continue}
    try{for(const e of await readdir(canonical,{withFileTypes:true})){if(e.isSymbolicLink())continue;if(e.isDirectory()&&!/^(node_modules|\.git|Windows|\$Recycle\.Bin|System Volume Information)$/i.test(e.name)){if(depth>=12){truncated=true;continue}queue.push({p:path.join(canonical,e.name),depth:depth+1})}else if(kind==='media'&&e.isFile()&&mediaTypes[path.extname(e.name).toLowerCase()]){const file=path.join(canonical,e.name),size=(await stat(file)).size;if(!Number.isSafeInteger(size)||size<1)continue;const mime=mediaTypes[path.extname(e.name).toLowerCase()],sourceKey=projectKey(file),token=randomUUID();nextTokens.set(token,{root:canonical,file,mime,sourceKey,kind:'media'});items.push({id:sourceKey,token,title:e.name,type:mime.startsWith('video/')||mime==='image/gif'?'video':'image',location:file});if(items.length>=3000){truncated=true;break}}}}catch{warnings.push('无法读取 '+canonical)}
   }
   // Keep the previous search valid for another open window, with a fixed memory bound.
   if(++generation%4===0||tokens.size>12000)tokens.clear();for(const [t,value]of nextTokens)tokens.set(t,value);
   items.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));return {wallpapers:items,roots,warnings:[...new Set(warnings)].slice(0,8),truncated,directories};
  },
  async resolve(token,owner){const item=tokens.get(token);if(!item||item.picked&&item.owner!==owner)throw Error('搜索结果已过期，请重新搜索');if(key(await realpath(item.file||item.root))!==key(item.file||item.root))throw Error('素材路径已改变，请重新搜索');return item},
  async preview(token){const item=await this.resolve(token);let file;if(item.kind==='media')file=item.file;else{if(typeof item.preview!=='string'||path.isAbsolute(item.preview))return null;file=path.join(item.root,item.preview);}const extension=path.extname(file).toLowerCase(),mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'}[extension];if(!mime)return null;try{const canonical=await realpath(file),relative=path.relative(item.root,canonical);if(relative.startsWith('..')||path.isAbsolute(relative)||(await stat(canonical)).size>1024*1024)return null;return 'data:'+mime+';base64,'+(await readFile(canonical)).toString('base64');}catch{return null;}},
 };
}
