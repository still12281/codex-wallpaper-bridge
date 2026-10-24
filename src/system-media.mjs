import {spawn} from 'node:child_process';
import path from 'node:path';
import {access} from 'node:fs/promises';
export function wallpaperMedia(snapshot){
 const now=snapshot.error?{}:snapshot.now||{},playback=now.playback||{},track=now.track||{},source=!snapshot.error&&snapshot.status?.sources?.find(s=>s.name==='audio'),audio=source?.state==='running'&&Number.isFinite(snapshot.spectrumReceivedAt)&&Date.now()-snapshot.spectrumReceivedAt<1000;
 return {sourceId:String(track.source?.appId||'').slice(0,200),sourceName:String(track.source?.appName||track.source?.appId||'').slice(0,200),hasMedia:now.hasMedia===true,title:String(track.title||'').slice(0,200),artist:String(track.artist||'').slice(0,200),album:String(track.album||'').slice(0,200),state:playback.state==='playing'?1:playback.state==='paused'?2:0,position:(playback.positionMs||0)/1000,duration:(playback.durationMs||track.durationMs||0)/1000,audioAvailable:audio,audioReason:source?.state==='running'&&!audio?'频谱未到达或已停止更新':null,bands:audio&&Array.isArray(snapshot.bands)?snapshot.bands.slice(0,64).map(n=>Math.max(0,Math.min(255,Number(n)||0))):Array(64).fill(0),capabilities:now.capabilities||{},sources:snapshot.status?.sources||[],error:snapshot.error||null};
}
export async function controlSystemMedia(state,request,poll,action,{sourceId=state.now?.track?.source?.appId,timeoutMs=5000}={}){
 state.now=await request('refresh');if(!sourceId||state.now?.track?.source?.appId!==sourceId)throw Error('系统当前播放器已切换，请确认面板中的播放器后再操作。');
 const capabilities=state.now?.capabilities||{},playing=state.now?.playback?.state==='playing',desired=playing?'paused':'playing';
 const mapping=action==='playPause'?(playing&&capabilities.pause?['pause','pause']:!playing&&capabilities.play?['play','play']:['play-pause','toggle']):({next:['next','next'],previous:['previous','previous']})[action];
 if(state.error||!mapping||!capabilities[mapping[1]])throw Error('当前播放器不支持此操作');
 const track=()=>JSON.stringify([state.now?.track?.title,state.now?.track?.artist,state.now?.track?.album,state.now?.track?.durationMs]),before=track();
 const result=await request('control',{action:mapping[0]});if(!result.outcome?.applied)throw Error(result.outcome?.reason||'播放器没有执行此操作');
 const end=Date.now()+timeoutMs;while(Date.now()<end){await poll();if(state.now?.track?.source?.appId!==sourceId)throw Error('系统当前播放器已变化，未确认原播放器的操作结果，请在播放器中查看。');if(!state.error&&(action==='playPause'?state.now?.playback?.state===desired:track()!==before))return result;await new Promise(resolve=>setTimeout(resolve,150));}
 throw Error('播放器已接受请求，但未确认'+(action==='playPause'?'播放状态变化':'曲目变化')+'，请查看播放器。');

}
export async function startSystemMedia(root,{audio=false}={}){
 if(process.platform!=='win32')throw Error('系统媒体适配目前只验收 Windows');
 const file=process.env.CODEX_WALLPAPER_MEDIA_BRIDGE||path.join(root,'engines','media-bridge-0.1.5','media-bridge.exe');try{await access(file);}catch{throw Error('系统媒体组件未准备，请先运行 npm run prepare:media');}
 const child=spawn(file,['serve','--no-online','--cache-dir',path.join(root,'system-media-cache'),...(!audio?['--no-audio']:[])],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
 const pending=new Map(),state={pid:child.pid,audioEnabled:audio,status:null,now:null,bands:null,error:null,spectrumFrames:0,spectrumDetails:null};let sequence=0,buffer='',closed=false,polling=false,stderr='';
 const request=(method,params={})=>new Promise((resolve,reject)=>{if(closed)return reject(Error('系统媒体组件已关闭'));const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('系统媒体请求超时：'+method));},8000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,params})+'\n',error=>{if(error){clearTimeout(timer);pending.delete(id);reject(error);}});});
 child.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.length>1024*1024){state.error='系统媒体返回超限';child.kill();return;}let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);let message;try{message=JSON.parse(line);}catch{continue;}if(message.event==='spectrum'){state.bands=message.frame?.bands;state.spectrumReceivedAt=Date.now();state.spectrumFrames++;const {sampleRate,tsMs,peak,rms}=message.frame||{};state.spectrumDetails={sampleRate,tsMs,peak,rms};continue;}const call=pending.get(message.id);if(call){pending.delete(message.id);clearTimeout(call.timer);message.ok?call.resolve(message.result):call.reject(Error(message.error?.message||'系统媒体请求失败'));}}});
 child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-1000);});child.stdin.on('error',()=>{});child.on('error',error=>{state.error=error.message;});child.on('exit',code=>{clearInterval(timer);if(!closed)state.error='系统媒体退出：'+code+' '+stderr;state.status=null;state.now=null;state.bands=null;for(const call of pending.values()){clearTimeout(call.timer);call.reject(Error(state.error||'系统媒体关闭'));}pending.clear();});
 let timer;const stop=async()=>{if(closed)return;closed=true;clearInterval(timer);child.stdin.end();if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);if(child.exitCode===null)child.kill();};
 const poll=async()=>{if(polling||closed)return;polling=true;try{state.status=await request('status');state.now=await request('now',{interpolate:false});state.error=null;}catch(error){state.error=error.message;}finally{polling=false;}};
 try{const hello=await request('hello');if(hello.protocol!==1)throw Error('不支持的系统媒体协议');await poll();if(state.error)throw Error(state.error);if(audio)await request('subscribe',{events:['spectrum'],intervalMs:100});timer=setInterval(poll,1000);timer.unref();return {state,payload:()=>wallpaperMedia(state),stop,control:(action,options)=>controlSystemMedia(state,request,poll,action,options)};}catch(error){await stop();throw error;}
}
