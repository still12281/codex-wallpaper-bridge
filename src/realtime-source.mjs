import {access,readFile,realpath,writeFile} from 'node:fs/promises';
import {StringDecoder} from 'node:string_decoder';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {discoverEngineRoots,projectKey} from './engine-library.mjs';

export function realtimeProfile(profile){
 const maxWidth=Number(profile?.maxWidth),fps=Number(profile?.fps);
 if(![960,1280,1920,2560,3840].includes(maxWidth)||![12,24,30,60].includes(fps))throw Error('实时播放规格无效');
 const maxHeight=profile?.maxHeight===undefined?Math.floor(maxWidth*900/1280/2)*2:Number(profile.maxHeight);
 if(!Number.isInteger(maxHeight)||maxHeight<64||maxHeight>4320||maxHeight%2)throw Error('实时输出高度无效');
 const result={maxWidth,maxHeight,fps};if(profile?.jpegQuality!==undefined){const quality=Number(profile.jpegQuality);if(!Number.isInteger(quality)||quality<60||quality>96)throw Error('实时画面质量无效');result.jpegQuality=quality;}return result;
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
async function desktopSettings(engine,projectRoot){
 try{const config=JSON.parse(await readFile(path.join(path.dirname(engine),'config.json'),'utf8')),user=config[process.env.USERNAME]||Object.values(config).find(v=>v?.general?.user),fps=Number(user?.general?.user?.fps),normalize=p=>String(p).replace(/\\/g,'/').toLowerCase(),prefix=normalize(projectRoot)+'/';
 const selected=user?.general?.wallpaperconfig?.selectedwallpapers||{},monitor=Object.keys(selected).find(k=>normalize(selected[k]?.file).startsWith(prefix));let properties={};
 for(const [file,values]of Object.entries(user?.wproperties||{}))if(normalize(file).startsWith(prefix)&&monitor&&values[monitor]){properties=values[monitor];break;}
 return {fps:Number.isFinite(fps)?fps:30,properties};
 }catch{return {fps:30,properties:{}};}
}
export async function nativeFullProfile(projectRoot,viewport={width:1920,height:1080}){
 const desktop=await desktopSettings(await executable(),projectRoot),width=[960,1280,1920,2560,3840].find(w=>w>=Math.min(3840,Math.max(960,Number(viewport.width)||1920)))||3840,ratio=Math.max(.5,Math.min(3,(Number(viewport.width)||1920)/(Number(viewport.height)||1080)));
 return realtimeProfile({maxWidth:width,maxHeight:Math.min(4320,Math.floor(width/ratio/2)*2),fps:[60,30,24,12].find(f=>f<=desktop.fps)||12,jpegQuality:92});
}
let latestDiagnosticId=0;
export async function startRealtime(entry,dataRoot){
 const diagnosticId=++latestDiagnosticId;
 const diagnostic={startedAt:new Date().toISOString(),entryId:entry.id,events:[],phase:'preparing'};let saveQueue=Promise.resolve();
 const report=(phase,detail={})=>{diagnostic.phase=phase;if(phase==='failed'||phase==='helper-error')diagnostic.lastFailure=detail;diagnostic.events.push({at:new Date().toISOString(),phase,...detail});diagnostic.events=diagnostic.events.slice(-40);const serialized=JSON.stringify(diagnostic,null,2);saveQueue=saveQueue.catch(()=>{}).then(()=>diagnosticId===latestDiagnosticId?writeFile(path.join(dataRoot,'realtime-diagnostic.json'),serialized):undefined);return saveQueue};
 await report('prepare-project');
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
 await report('interpreter-ready',{interpreter});
 if(!path.isAbsolute(interpreter)||path.basename(interpreter).toLowerCase()!=='python.exe')throw Error('实时采集解释器路径无效');await access(interpreter);
 runtime.stop=async()=>{
  if(runtime.closed)return;runtime.closed=true;await report('stopping');
  const child=runtime.helper;
  if(child&&child.exitCode===null){child.stdin.write('STOP\n',()=>{});await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);if(child.exitCode===null)child.kill()}
  await invoke(engine,['-control','closeWallpaper','-location',name],{windowsHide:true,timeout:8000}).catch(()=>{});runtime.frame=null;await report('stopped');
 };
 runtime.setPaused=paused=>{runtime.paused=paused;if(!paused)runtime.resumedAt=Date.now();if(runtime.helper?.stdin.writable)runtime.helper.stdin.write(paused?'PAUSE\n':'RESUME\n',()=>{})};
 try{
  await report('opening-engine-window',{window:name,profile});
  await invoke(engine,['-control','openWallpaper','-file',path.join(project.root,'project.json'),'-playInWindow',name,'-width',String(profile.maxWidth),'-height',String(profile.maxHeight),'-x','-32000','-y','-32000','-borderless'],{windowsHide:true,timeout:15000});
  const desktop=await desktopSettings(engine,project.root);
  if(Object.keys(desktop.properties).length)await invoke(engine,['-control','applyProperties','-properties','RAW~('+JSON.stringify(desktop.properties)+')~END','-location',name],{windowsHide:true,windowsVerbatimArguments:true,timeout:8000});
  runtime.desktop={configuredFps:desktop.fps,propertyCount:Object.keys(desktop.properties).length};
  const child=runtime.helper=spawn(interpreter,[helper,'--window',name,'--fps',String(profile.fps),'--width',String(profile.maxWidth),'--height',String(profile.maxHeight),'--quality',String(profile.jpegQuality||78),'--telemetry','--parent',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:captureEnv});
  await report('capture-process-started',{pid:child.pid});let buffer=Buffer.alloc(0),stderr='',stderrLine='';const decoder=new StringDecoder('utf8');
  child.stdout.on('data',chunk=>{
   buffer=Buffer.concat([buffer,chunk]);
    while(buffer.length>=4){const size=buffer.readUInt32LE(0);if(size<1||size>4*1024*1024){runtime.error='采集助手返回无效画面';child.kill();return}if(buffer.length<size+4)break;const packet=buffer.subarray(4,4+size);if(packet.length>20&&packet.toString('ascii',0,4)==='CWB1'){runtime.frame=packet.subarray(20);runtime.frameInfo={callbackAt:packet.readDoubleLE(4),encodeMs:packet.readFloatLE(12),captureSequence:packet.readUInt32LE(16)};}else{runtime.frame=packet;runtime.frameInfo={};}runtime.sequence++;runtime.lastFrameAt=Date.now();runtime.frameInfo.receivedAt=runtime.lastFrameAt;buffer=buffer.subarray(4+size);runtime.onFrame?.();}
   if(buffer.length>4*1024*1024+4){runtime.error='采集画面缓存超限';child.kill()}
  });
  child.stderr.on('data',chunk=>{const text=decoder.write(chunk);stderr=(stderr+text).slice(-6000);stderrLine+=text;let newline;while((newline=stderrLine.indexOf('\n'))>=0){const line=stderrLine.slice(0,newline);stderrLine=stderrLine.slice(newline+1);try{const event=JSON.parse(line);if(event.event==='error')runtime.error=event.message;else if(event.event==='window')runtime.hwnd=event.hwnd;report('helper-'+event.event,event).catch(()=>{})}catch{}}});
  child.on('error',e=>{runtime.error='采集助手启动失败：'+e.message});
  child.on('exit',(code,signal)=>{report('capture-process-exited',{code,signal,stderr}).catch(()=>{});if(!runtime.closed)runtime.error=runtime.error||'采集助手已退出（'+code+'）：'+stderr.slice(-600)});
  child.stdin.on('error',()=>{});
  const deadline=Date.now()+35000;
  while(Date.now()<deadline){if(runtime.error)throw Error(runtime.error);if(runtime.frame){await report('first-frame',{sequence:runtime.sequence,hwnd:runtime.hwnd});return runtime}await new Promise(resolve=>setTimeout(resolve,100))}
  throw Error('实时场景未收到首帧，请检查专用渲染窗口是否正常显示');
 }catch(error){await report('failed',{error:error.stack||error.message,stderr:diagnostic.events.findLast(e=>e.stderr)?.stderr});await runtime.stop();throw error}
}
