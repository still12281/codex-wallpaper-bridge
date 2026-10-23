import {access,readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {discoverEngineRoots,projectKey} from './engine-library.mjs';

export function realtimeProfile(profile){
 const maxWidth=Number(profile?.maxWidth),fps=Number(profile?.fps);
 if(![960,1280,1920,2560,3840].includes(maxWidth)||![12,24,30,60].includes(fps))throw Error('实时播放规格无效');
 return {maxWidth,maxHeight:Math.floor(maxWidth*900/1280/2)*2,fps};
}
export async function describeProject(projectRoot){
 const root=await realpath(projectRoot),project=JSON.parse(await readFile(path.join(root,'project.json'),'utf8'));
 return {root,type:String(project.type||'').toLowerCase(),name:String(project.title||path.basename(root)).slice(0,120),sourceKey:projectKey(root),workshopId:root.replace(/\\/g,'/').match(/\/workshop\/content\/431960\/(\d+)$/i)?.[1]};
}
export async function findWorkshopProject(id){
 if(!/^\d{4,20}$/.test(id||''))throw Error('工坊ID无效');
 const discovery=await discoverEngineRoots();
 for(const base of discovery.roots.filter(p=>path.basename(p)==='431960')){const root=path.join(base,id);try{await access(path.join(root,'project.json'));return await realpath(root)}catch{}}
 throw Error('未找到该工坊项目，请重新搜索壁纸库');
}
async function executable(){
 if(process.env.CODEX_WALLPAPER_ENGINE_EXE){await access(process.env.CODEX_WALLPAPER_ENGINE_EXE);return process.env.CODEX_WALLPAPER_ENGINE_EXE}
 const discovery=await discoverEngineRoots();
 const roots=new Set(discovery.engines||[]);
 for(const root of discovery.roots){const normalized=root.replace(/\\/g,'/');const marker=normalized.toLowerCase().indexOf('/steamapps/');if(marker>=0)roots.add(path.join(normalized.slice(0,marker),'steamapps/common/wallpaper_engine'))}
 for(const root of roots)for(const name of ['wallpaper64.exe','wallpaper32.exe']){const file=path.join(root,name);try{await access(file);return file}catch{}}
 throw Error('未找到 Wallpaper Engine，请先安装并启动，或配置 CODEX_WALLPAPER_ENGINE_EXE');
}
export async function startRealtime(entry,dataRoot){
 const profile=realtimeProfile(entry.limits),project=await describeProject(entry.projectRoot);
 if(!['scene','web'].includes(project.type))throw Error('此项目不是实时场景或网页壁纸');
 const engine=await executable(),name='CodexWallpaperBridge-'+randomUUID();
 let uv=process.env.CODEX_WALLPAPER_UV;
 if(!uv){const candidates=[...(process.env.PATH||'').split(path.delimiter).filter(Boolean).map(p=>path.join(p.replace(/^"|"$/g,''),'uv.exe')),path.join(process.env.USERPROFILE||'', '.local/bin/uv.exe')];for(const candidate of candidates){try{await access(candidate);uv=candidate;break}catch{}}}
 if(!uv)throw Error('实时模式需要 uv，请安装 uv 或配置 CODEX_WALLPAPER_UV');await access(uv);
 const helper=fileURLToPath(new URL('./capture-scene.py',import.meta.url));
 const runtime={name,engine,profile,frame:null,sequence:0,lastFrameAt:0,error:null,paused:false,closed:false,helper:null};
 const invoke=promisify(execFile);
 const captureEnv={...process.env,UV_CACHE_DIR:process.env.UV_CACHE_DIR||path.join(dataRoot,'capture-cache')};
 // Resolve the prepared environment once per start, then own Python directly.
 // Killing uv alone would not guarantee its Python child exits on Windows.
 const interpreter=(await invoke(uv,['run','--offline','--frozen','--script',helper,'--runtime-path'],{windowsHide:true,timeout:20000,maxBuffer:8192,env:captureEnv}).catch(error=>{throw Error('实时采集依赖未准备好，请先运行 Prepare-Realtime.ps1：'+error.message)})).stdout.trim();
 if(!path.isAbsolute(interpreter)||path.basename(interpreter).toLowerCase()!=='python.exe')throw Error('实时采集解释器路径无效');await access(interpreter);
 runtime.stop=async()=>{
  if(runtime.closed)return;runtime.closed=true;
  const child=runtime.helper;
  if(child&&child.exitCode===null){child.stdin.write('STOP\n',()=>{});await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);if(child.exitCode===null)child.kill()}
  await invoke(engine,['-control','closeWallpaper','-location',name],{windowsHide:true,timeout:8000}).catch(()=>{});runtime.frame=null;
 };
 runtime.setPaused=paused=>{runtime.paused=paused;if(runtime.helper?.stdin.writable)runtime.helper.stdin.write(paused?'PAUSE\n':'RESUME\n',()=>{})};
 try{
  await invoke(engine,['-control','openWallpaper','-file',path.join(project.root,'project.json'),'-playInWindow',name,'-width',String(profile.maxWidth),'-height',String(profile.maxHeight)],{windowsHide:true,timeout:15000});
  const child=runtime.helper=spawn(interpreter,[helper,'--window',name,'--fps',String(profile.fps),'--width',String(profile.maxWidth),'--height',String(profile.maxHeight),'--parent',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:captureEnv});
  let buffer=Buffer.alloc(0),stderr='';
  child.stdout.on('data',chunk=>{
   buffer=Buffer.concat([buffer,chunk]);
   while(buffer.length>=4){const size=buffer.readUInt32LE(0);if(size<1||size>4*1024*1024){runtime.error='采集助手返回无效画面';child.kill();return}if(buffer.length<size+4)break;runtime.frame=Buffer.from(buffer.subarray(4,4+size));runtime.sequence++;runtime.lastFrameAt=Date.now();buffer=buffer.subarray(4+size)}
   if(buffer.length>4*1024*1024+4){runtime.error='采集画面缓存超限';child.kill()}
  });
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-2400);for(const line of chunk.toString().split('\n')){try{const event=JSON.parse(line);if(event.event==='error')runtime.error=event.message;else if(event.event==='window')runtime.hwnd=event.hwnd}catch{}}});
  child.on('error',e=>{runtime.error='采集助手启动失败：'+e.message});
  child.on('exit',code=>{if(!runtime.closed)runtime.error=runtime.error||'采集助手已退出（'+code+'）：'+stderr.slice(-600)});
  child.stdin.on('error',()=>{});
  const deadline=Date.now()+35000;
  while(Date.now()<deadline){if(runtime.error)throw Error(runtime.error);if(runtime.frame)return runtime;await new Promise(resolve=>setTimeout(resolve,100))}
  throw Error('实时场景未收到首帧，请检查专用渲染窗口是否正常显示');
 }catch(error){await runtime.stop();throw error}
}
