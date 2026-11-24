import {createReadStream,constants} from 'node:fs';
import {readFile,writeFile,mkdir,rename,rm,copyFile,readdir,lstat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const repo='still12281/codex-wallpaper-bridge',base='https://github.com/'+repo;
const latest='https://api.github.com/repos/'+repo+'/releases/latest';
const installedMessage='更新已安装。保存工作并正常退出 Codex，再从壁纸入口打开，新版本即生效。';
const stable=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const operationId=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export function newerVersion(candidate,current){
 if(!stable.test(candidate)||!stable.test(current))return false;
 const a=candidate.split('.').map(BigInt),b=current.split('.').map(BigInt);
 for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false;
}
export function releaseUpdate(release,current){
 const version=String(release.tag_name||'').replace(/^v/,'');
 if(release.draft||release.prerelease||!stable.test(version))throw Error('GitHub 未返回有效的正式版本。');
 const name='CodexWallpaperBridge-'+version+'-Setup.exe',url=base+'/releases/download/v'+version+'/'+name;
 const asset=release.assets?.find(a=>a.name===name),checksum=release.assets?.find(a=>a.name===name+'.sha256');
 if(!asset||asset.browser_download_url!==url||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>128*1024*1024||!checksum||checksum.browser_download_url!==url+'.sha256')throw Error('该版本缺少有效的安装包或校验文件。');
 const digest=asset.digest?.match(/^sha256:([a-f0-9]{64})$/i)?.[1]?.toLowerCase();
 return {version,name,url,size:asset.size,digest,checksumUrl:url+'.sha256',releaseUrl:base+'/releases/tag/v'+version,available:newerVersion(version,current)};
}
function allowed(url){const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='api.github.com'||u.hostname==='github.com'||u.hostname==='release-assets.githubusercontent.com'||u.hostname==='objects.githubusercontent.com');}
async function download(url,limit,{request=fetch,signal,onChunk}={}){
 for(let n=0;n<6;n++){
  if(!allowed(url))throw Error('更新下载地址不受信任。');
  const response=await request(url,{redirect:'manual',signal,headers:{'User-Agent':'CodexWallpaperBridge','Accept':url===latest?'application/vnd.github+json':'application/octet-stream'}});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('下载重定向无效。');url=new URL(location,url).href;continue;}
  if(!response.ok)throw Error('GitHub 请求失败（HTTP '+response.status+'）。请稍后重试或检查网络。');
  if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw Error('更新文件超出大小限制。');}
  let length=0;const chunks=[];
  for await(const chunk of response.body){length+=chunk.length;if(length>limit)throw Error('更新文件超出大小限制。');if(onChunk)await onChunk(chunk);else chunks.push(chunk);}
  return onChunk?length:Buffer.concat(chunks);
 }
 throw Error('更新下载重定向次数过多。');
}
// Keep each attempt's installer and receipt together. Copy an older verified
// package into the new attempt so the process never depends on the old folder.
async function reuseInstaller(directory,selected,expected,temp){
 const entries=await readdir(path.dirname(directory),{withFileTypes:true});
 for(const entry of entries){
  if(!entry.isDirectory()||!operationId.test(entry.name)||entry.name===path.basename(directory))continue;
  const candidate=path.join(path.dirname(directory),entry.name,selected.name);
  const info=await lstat(candidate).catch(()=>null);
  if(!info?.isFile()||info.size!==selected.size)continue;
  try{await copyFile(candidate,temp,constants.COPYFILE_EXCL);}
  catch(error){if(error.code==='ENOENT')continue;throw error;}
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(temp))hash.update(chunk);
  if(hash.digest('hex')===expected)return true;
  await rm(temp);
 }
 return false;
}
export function createBridgeUpdater({root,currentVersion,request=fetch,launch,now=Date.now}){
 let release=null,checking=null,operation=null,lastCheck=0;
 let statusIO=Promise.resolve();
 let state={currentVersion,phase:'idle',available:false};
 const activeFile=path.join(root,'updates','active.json');
 const snapshot=()=>({...state});
 const alive=pid=>{if(!Number.isSafeInteger(pid)||pid<1)return true;try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}};
 const readRelease=async()=>releaseUpdate(JSON.parse(await download(latest,1024*1024,{request,signal:AbortSignal.timeout(15000)})),currentVersion);
 const forget=async id=>{try{if(JSON.parse(await readFile(activeFile,'utf8')).id===id)await rm(activeFile);}catch(error){if(error.code!=='ENOENT')throw error;}};
 // Keep this process's status polls from holding the file open during replace.
 const accessStatus=task=>{
  const result=statusIO.then(task);
  statusIO=result.catch(()=>{});
  return result;
 };
 const readStatusFile=file=>accessStatus(async()=>JSON.parse(await readFile(file,'utf8')));
 const saveResult=(op,phase,message)=>accessStatus(async()=>{
  const temp=op.statusFile+'.next-'+randomUUID();
  await writeFile(temp,JSON.stringify({id:op.id,phase,message}));
  try{
   // The separate installer process or a scanner can still hold the file.
   const waits=[0,25,75,150,250];
   for(const wait of waits){
    if(wait)await delay(wait);
    try{await rename(temp,op.statusFile);return;}
    catch(error){if(process.platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(error.code)||wait===waits.at(-1))throw error;}
   }
  }catch(error){await rm(temp,{force:true}).catch(()=>{});throw error;}
 });
 const readInstallerResult=async op=>{
  const file=path.join(path.dirname(op.statusFile),'setup-complete');
  try{return (await readFile(file,'utf8')).trim()===op.id;}
  catch(error){if(error.code!=='ENOENT')throw error;return false;}
 };
 const installError=async(op,code)=>{
  const directory=path.dirname(op.statusFile),backend=path.join(directory,'setup-backend.log');
  const component=await readFile(path.join(directory,'setup-failure-component'),'utf8').catch(()=>null);
  const label=new Map([['spectrum','系统频谱'],['gpu','GPU 壁纸'],['capture','Wallpaper Engine 原版采集']]).get(component?.trim());
  const log=(await lstat(backend).catch(()=>null))?.isFile()?'setup-backend.log':'installer.log';
  return (label?label+'准备失败':'安装器未完成')+(code==null?'':'（'+code+'）')+'。安装日志位于 updates/'+op.id+'/'+log+'。';
 };
 const check=async(force=false)=>{
  if(checking)return checking;
  if(!operation&&state.phase!=='installed'&&(force||!lastCheck||now()-lastCheck>=60*60*1000))state={...state,phase:'checking',message:'正在检查 GitHub 正式版本…'};
  await status();
  if(checking)return checking;
  if(operation||state.phase==='installed'||(!force&&lastCheck&&now()-lastCheck<60*60*1000))return snapshot();
  state={...state,phase:'checking',message:'正在检查 GitHub 正式版本…'};
  checking=(async()=>{try{
   release=await readRelease();lastCheck=now();
   state={currentVersion,phase:'idle',available:release.available,latestVersion:release.version,releaseUrl:release.releaseUrl,checkedAt:new Date(now()).toISOString()};
  }catch(error){lastCheck=now();state={...state,phase:'error',message:error.message};}return snapshot();})().finally(()=>{checking=null;});
  return checking;
 };
 const status=async()=>{
  if(!operation)try{
   const saved=JSON.parse(await readFile(activeFile,'utf8'));
   if(!operationId.test(saved.id)||!stable.test(saved.version)||!Number.isFinite(saved.createdAt))throw Error('更新任务记录无效。');
   if(!newerVersion(saved.version,currentVersion)){await forget(saved.id);return snapshot();}
   if(operation)return snapshot();
   operation={...saved,statusFile:path.join(root,'updates',saved.id,'status.json')};
   state={...state,available:true,latestVersion:saved.version,phase:'installing',message:'正在读取上次更新的状态…'};
  }catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))state={...state,phase:'error',message:error.message};}
  const reading=operation;
  if(reading?.statusFile)try{
   const result=await readStatusFile(reading.statusFile);
   if(operation===reading&&result.id===reading.id&&['downloading','installing','installed','error'].includes(result.phase)){
    state={...state,phase:result.phase,message:result.message};
    if(result.phase==='error'){await forget(reading.id);if(operation===reading)operation=null;}
   }
  }catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError)){state={...state,message:'暂时无法读取安装状态：'+error.message};}}
  if(!reading||operation!==reading||['installed','error'].includes(state.phase))return snapshot();
  if(reading.runner==='inno'&&state.phase==='installing'){
   try{
    const installed=await readInstallerResult(reading);
    if(operation!==reading)return snapshot();
    if(installed){state={...state,phase:'installed',message:installedMessage};return snapshot();}
   }catch(error){
    if(operation===reading)state={...state,message:'暂时无法读取安装回执：'+error.message};
    return snapshot();
   }
  }
  const timedOut=now()-reading.createdAt>20*60*1000;
  if(timedOut)state={...state,message:'更新耗时超过 20 分钟，请查看数据目录 updates 下的安装日志。当前任务保留，避免重复安装。'};
  let abandoned=state.phase==='downloading'&&!alive(reading.ownerPid);
  if(state.phase==='installing'){
   const runner=await readFile(path.join(root,'updates',reading.id,'runner.json'),'utf8').then(JSON.parse).catch(()=>null);
   if(operation!==reading||state.phase!=='installing')return snapshot();
   abandoned=runner?.id===reading.id&&!alive(runner.pid);
   if(!runner&&reading.runner==='inno'&&timedOut)abandoned=!alive(reading.ownerPid);
  }
  if(abandoned){
   const message=reading.runner==='inno'?await installError(reading):'上次更新进程已退出，可重新点击更新。';
   await saveResult(reading,'error',message);await forget(reading.id);
   if(operation===reading){operation=null;state={...state,phase:'error',message};}
  }
  return snapshot();
 };
 const start=async()=>{
  await status();if(operation||state.phase==='installed')return snapshot();
  // Recheck before execution; never accept a URL, version or path from the page.
  const id=randomUUID(),directory=path.join(root,'updates',id);
  const op={id,ownerPid:process.pid,createdAt:now(),statusFile:path.join(directory,'status.json'),...(launch?{}:{runner:'inno'})};
  operation=op;state={...state,phase:'checking',message:'正在核对最新正式版本…'};
  void (async()=>{let temp;
   try{
    const selected=await readRelease();if(!selected.available){release=selected;operation=null;state={currentVersion,phase:'idle',available:false,latestVersion:selected.version};return;}
    op.version=selected.version;
    await mkdir(directory,{recursive:true});
    await saveResult(op,'downloading','正在下载并校验安装包…');
    try{await writeFile(activeFile,JSON.stringify(op),{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;operation=null;await status();return;}
    state={...state,latestVersion:selected.version,phase:'downloading',message:'正在下载并校验安装包…'};
    const installer=path.join(directory,selected.name);temp=installer+'.part';
    const checksum=(await download(selected.checksumUrl,4096,{request,signal:AbortSignal.timeout(15000)})).toString('utf8').trim();
    const match=checksum.match(/^([a-f0-9]{64})\s+\*?([^\r\n]+)$/i);
    if(!match||match[2]!==selected.name)throw Error('安装包校验文件格式无效。');
    const expected=match[1].toLowerCase();if(selected.digest&&selected.digest!==expected)throw Error('GitHub 安装包摘要与校验文件不一致。');
    const reused=await reuseInstaller(directory,selected,expected,temp);
    if(!reused){
     const hash=createHash('sha256');const {open}=await import('node:fs/promises');const file=await open(temp,'wx');let size;
     try{size=await download(selected.url,selected.size,{request,signal:AbortSignal.timeout(120000),onChunk:async chunk=>{hash.update(chunk);await file.writeFile(chunk);}});}finally{await file.close();}
     if(size!==selected.size||hash.digest('hex')!==expected)throw Error('安装包校验失败，已停止更新。');
    }
    await rename(temp,installer);temp=null;
    const statusFile=path.join(directory,'status.json'),requestFile=path.join(directory,'request.json');
    await writeFile(requestFile,JSON.stringify({id,installer,sha256:expected,dataDirectory:root,statusFile}));
    state={...state,phase:'installing',message:reused?'已复用并校验安装包，正在安装更新…':'正在安装更新…'};await saveResult(op,state.phase,state.message);
    if(launch)await launch(requestFile);else{
     const child=spawn(installer,[
      '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/NOCLOSEAPPLICATIONS','/SP-',
      '/UPDATE=keep','/LOGIN=keep','/DATADIR='+root,'/BRIDGEUPDATE='+id,
      '/LOG='+path.join(directory,'installer.log')
     ],{windowsHide:true,detached:true,stdio:'ignore'});
     const started=new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
     child.once('exit',code=>{
      void (async()=>{
       if(await readInstallerResult(op))return;
       await saveResult(op,'error',await installError(op,code));
      })().catch(()=>{});
     });
     await started;
     try{await writeFile(path.join(directory,'runner.json'),JSON.stringify({id,pid:child.pid}),{flag:'wx'});}
     finally{child.unref();}
    }
   }catch(error){if(temp)await rm(temp,{force:true}).catch(()=>{});await forget(id).catch(()=>{});operation=null;state={...state,phase:'error',message:error.message};}
  })();
  return snapshot();
 };
 return {check,status,start};
}
