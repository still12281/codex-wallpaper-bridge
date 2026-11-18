// Functions are serialized into the renderer. Keep browser code dependency-free.
export async function installRealtime(config,base64,info){
 const image=new Image();image.decoding='async';image.src='data:image/jpeg;base64,'+base64;await image.decode();
 if(info.selectionStamp&&(window.__cwbSelectionStamp!==info.selectionStamp||window.__cwbDesiredWallpaperId!==info.entryId)){image.src='';return {superseded:true};}
 const layer=document.createElement('div');layer.id='codex-wallpaper-bridge-layer';layer.setAttribute('aria-hidden','true');layer.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0';
 const shadow=layer.attachShadow({mode:'open'}),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.style.cssText='width:100%;height:100%;object-fit:cover;display:block';shadow.append(canvas);
 const context=canvas.getContext('2d',{alpha:false});context.drawImage(image,0,0);image.src='';
 const tiny=document.createElement('canvas');tiny.width=tiny.height=16;const sample=tiny.getContext('2d',{willReadFrequently:true});sample.drawImage(canvas,0,0,16,16);const data=sample.getImageData(0,0,16,16).data;let r=0,g=0,b=0;for(let i=0;i<data.length;i+=4){r+=data[i];g+=data[i+1];b+=data[i+2]}r/=256;g/=256;b/=256;const dark=.2126*r+.7152*g+.0722*b<145,tint=v=>Math.round(dark?v*.18:220+v*.12);
 const old=window.__codexWallpaperBridge;old?.dispose?.();document.getElementById('codex-wallpaper-bridge-layer')?.remove();if(old?.blobUrl)URL.revokeObjectURL(old.blobUrl);document.body.prepend(layer);
 const state=window.__codexWallpaperBridge={installed:true,ready:true,mode:'realtime',engine:info.engine||'wallpaper-engine',transport:info.transport||'window-capture-jpeg',palette:{r:tint(r),g:tint(g),b:tint(b),dark},frames:1,lastFrameAt:Date.now(),sourceWindow:info.name,captureFps:info.fps,captureError:null,decodePending:0};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let manualPause=null;
 const paused=()=>manualPause===null?(document.hidden||(config.pauseOnBlur&&!document.hasFocus())||reduced.matches):manualPause;
 state.pause=value=>{manualPause=typeof value==='boolean'?value:null;};
 state.setPauseOnBlur=value=>{config.pauseOnBlur=!!value};
 state.sample=()=>({ready:true,mode:'realtime',engine:state.engine,transport:state.transport,paused:paused(),width:canvas.width,height:canvas.height,frames:state.frames,lastFrameAt:state.lastFrameAt,sourceWindow:state.sourceWindow,captureFps:state.captureFps,error:state.captureError,hidden:document.hidden,focused:document.hasFocus(),timing:state.timing,decodePending:state.decodePending});
 const jpegTransport=state.transport;
 let disposed=false,decoder=null,hardwareError=null,hardwareGeneration=0;
 const arrivals=new Map();
 state.endHardware=()=>{
  const previous=decoder;hardwareGeneration++;decoder=null;hardwareError=null;arrivals.clear();state.transport=jpegTransport;
  if(previous&&previous.state!=='closed')previous.close();
 };
 state.dispose=()=>{disposed=true;state.endHardware();};
 state.drawHardware=async(configuration,frames)=>{
  if(disposed||paused())return {paused:true};
  if(configuration){
   state.endHardware();
   const generation=hardwareGeneration;
   if(typeof VideoDecoder!=='function')throw Error('客户端没有 WebCodecs H.264 解码接口');
   const options={codec:configuration.codec,description:Uint8Array.fromBase64(configuration.description),
    codedWidth:canvas.width,codedHeight:canvas.height,hardwareAcceleration:'prefer-hardware',optimizeForLatency:true};
   if(!(await VideoDecoder.isConfigSupported(options)).supported)throw Error('客户端不支持此 H.264 格式');
   if(disposed||paused()||hardwareGeneration!==generation)return {paused:true};
   const current=new VideoDecoder({
    output(frame){
     try{
      const arrival=arrivals.get(frame.timestamp);arrivals.delete(frame.timestamp);
      if(disposed||paused()||decoder!==current)return;
      if(canvas.width!==frame.displayWidth||canvas.height!==frame.displayHeight){canvas.width=frame.displayWidth;canvas.height=frame.displayHeight;}
      context.drawImage(frame,0,0);state.transport='window-capture-h264';state.frames++;state.lastFrameAt=Date.now();
      state.timing={receivedToDrawMs:arrival?Date.now()-arrival:null,measurement:'encoded-frame-received-to-canvas-draw; not physical screen presentation'};
     }catch(error){hardwareError=error.message;}finally{frame.close();}
    },
    error:error=>{if(decoder===current)hardwareError=error.message;}
   });
   decoder=current;current.configure(options);
  }
  if(hardwareError)throw Error(hardwareError);
  if(decoder?.state!=='configured')throw Error('H.264 解码器未就绪');
  if(arrivals.size+frames.length>24)throw Error('H.264 解码积压');
  for(const frame of frames){
   arrivals.set(frame.timestamp,frame.arrivedAt);
   decoder.decode(new EncodedVideoChunk({type:frame.key?'key':'delta',timestamp:frame.timestamp,data:Uint8Array.fromBase64(frame.data)}));
  }
  return {paused:false,ready:state.transport==='window-capture-h264'};
 };
 state.draw=async(encoded,info={})=>{if(disposed||paused()||state.transport==='window-capture-h264')return state.sample();const started=performance.now(),image=new Image();state.decodePending++;try{image.decoding='async';image.src='data:image/jpeg;base64,'+encoded;await image.decode();const decoded=performance.now();if(!disposed&&!paused()&&state.transport!=='window-capture-h264'&&(!info.sequence||info.sequence>(state.lastSequence||0))){if(canvas.width!==image.width||canvas.height!==image.height){canvas.width=image.width;canvas.height=image.height}context.drawImage(image,0,0);state.frames++;state.lastSequence=info.sequence;state.lastFrameAt=Date.now();state.timing={sequence:info.sequence,encodeMs:info.encodeMs,decodeMs:decoded-started,drawMs:performance.now()-decoded,receivedToDrawMs:Date.now()-(info.receivedAt||Date.now()),callbackToDrawMs:info.callbackAt?Date.now()-info.callbackAt:null,measurement:state.engine==='chromium-web'?'browser-JPEG-received-to-canvas-draw; not physical screen presentation':'capture-callback-to-canvas-draw; not physical screen presentation'};}}finally{image.src='';state.decodePending--;}return state.sample()};
 return state.sample();
}
