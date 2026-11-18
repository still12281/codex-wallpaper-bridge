import {spawn} from 'node:child_process';
import {findFFmpeg} from './runtime-paths.mjs';

const boxLimit=6*1024*1024;
const historyLimit=12*1024*1024;
const reads=buffer=>{
 const result=[];let offset=0;
 while(buffer.length-offset>=8){
  const size=buffer.readUInt32BE(offset);
  if(size<8||size>boxLimit)throw Error('H.264 传帧封装尺寸无效');
  if(size>buffer.length-offset)break;
  result.push({type:buffer.toString('ascii',offset+4,offset+8),data:buffer.subarray(offset,offset+size)});
  offset+=size;
 }
 return {result,rest:buffer.subarray(offset)};
};
function sampleTime(fragment){
 const track=reads(fragment.subarray(8)).result.find(box=>box.type==='traf');
 const time=track&&reads(track.data.subarray(8)).result.find(box=>box.type==='tfdt')?.data;
 if(!time||time.length<(time[8]===1?20:16))throw Error('H.264 传帧缺少时间戳');
 const ticks=time[8]===1?Number(time.readBigUInt64BE(12)):time.readUInt32BE(12);
 return Math.round(ticks*1000000/90000);
}
function isKeyFrame(data){
 for(let offset=0;offset+5<=data.length;){
  const size=data.readUInt32BE(offset);
  if(!size||offset+4+size>data.length)throw Error('H.264 传帧数据无效');
  if((data[offset+4]&31)===5)return true;
  offset+=size+4;
 }
 return false;
}

export function createH264Reader(onConfig,onFrame){
 let pending=Buffer.alloc(0),fragment,configured=false;
 return chunk=>{
  const {result,rest}=reads(pending.length?Buffer.concat([pending,chunk]):chunk);
  pending=rest;
  for(const {type,data} of result){
   if(type==='moov'){
    const i=data.indexOf('avcC');
    if(i<4||i+9>data.length)throw Error('H.264 解码配置缺失');
    const end=i-4+data.readUInt32BE(i-4);
    if(end>data.length||end<i+9||(data[i+8]&3)!==3)throw Error('H.264 解码配置无效');
    onConfig({codec:'avc1.'+data.subarray(i+5,i+8).toString('hex'),description:data.subarray(i+4,end).toString('base64')});
    configured=true;
   }else if(type==='moof'){
    fragment=data;
   }else if(type==='mdat'&&fragment){
    if(!configured)throw Error('H.264 解码配置尚未就绪');
    const sample=data.subarray(8);
    onFrame({timestamp:sampleTime(fragment),key:isKeyFrame(sample),data:sample.toString('base64')});
    fragment=null;
   }
  }
 };
}

// One encoder per owned Wallpaper Engine window. Keep only its latest GOP so a
// resumed or slow target can rejoin at a keyframe without holding up other windows.
export function startHardwareCapture(hwnd,profile,notify,{sourceFps}={}){
 if(!Number.isSafeInteger(hwnd)||hwnd<=0)throw Error('原版窗口句柄无效');
 const state={startedAt:Date.now(),lastAt:0,frames:[],error:null,closed:false,config:null};
 let child,historyBytes=0,sequence=0,stderr='';
 const fail=error=>{
  if(state.closed||state.error)return;
  state.error=error.message||String(error);notify();
 };
 const consume=createH264Reader(config=>{state.config=config;},frame=>{
  if(frame.key){state.frames=[];historyBytes=0;}
  if(!frame.key&&!state.frames.length)return;
  historyBytes+=frame.data.length;
  if(state.frames.length>=120||historyBytes>historyLimit){fail(Error('硬件传帧超过缓冲上限'));return;}
  state.frames.push({...frame,sequence:++sequence,arrivedAt:Date.now()});
  state.lastAt=Date.now();
  notify();
 });
 void findFFmpeg().then(ffmpeg=>{
  if(state.closed)return;
  const {fps,maxWidth,maxHeight}=profile;
  // Give the capture clock headroom when the native renderer already limits
  // the source. Otherwise apply the requested output limit at capture.
  const captureFps=sourceFps>0&&sourceFps<=fps?Math.min(120,fps*2):fps;
  const bitrate=Math.max(3,Math.min(40,Math.round(12*maxWidth*maxHeight*fps/(1280*900*30))))+'M';
  child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-nostats','-f','lavfi','-i',
   'gfxcapture=hwnd='+hwnd+':max_framerate='+captureFps+':capture_cursor=0:width='+maxWidth+':height='+maxHeight,
   '-an','-c:v','h264_amf','-usage','ultralowlatency','-quality','balanced','-b:v',bitrate,'-g',String(fps),'-bf','0',
   '-fps_mode','passthrough','-video_track_timescale','90000','-movflags','+frag_every_frame+empty_moov+default_base_moof+skip_trailer',
   '-flush_packets','1','-f','mp4','pipe:1'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  child.stdout.on('data',chunk=>{if(!state.closed&&!state.error)try{consume(chunk);}catch(error){fail(error);}});
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-1500);});
  child.stdin.on('error',()=>{});
  child.once('error',fail);
  child.once('close',code=>fail(Error(stderr.trim()||'硬件采集已退出（'+code+'）')));
 }).catch(fail);
 state.stop=async()=>{
  if(state.closed)return;
  state.closed=true;
  state.frames=[];
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  let timer;
  const closed=new Promise(resolve=>child.once('close',resolve));
  child.stdin.end('q\n');
  try{
   if(await Promise.race([closed.then(()=>true),new Promise(resolve=>timer=setTimeout(()=>resolve(false),1000))]))return;
   child.kill();await closed;
  }finally{clearTimeout(timer);}
 };
 return state;
}
