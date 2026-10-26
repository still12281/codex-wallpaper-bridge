// Functions are serialized into the renderer. Keep browser code dependency-free.
export async function installRealtime(config,base64,info){
 const image=new Image();image.decoding='async';image.src='data:image/jpeg;base64,'+base64;await image.decode();
 const layer=document.createElement('div');layer.id='codex-wallpaper-bridge-layer';layer.setAttribute('aria-hidden','true');layer.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0';
 const shadow=layer.attachShadow({mode:'open'}),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.style.cssText='width:100%;height:100%;object-fit:cover;display:block';shadow.append(canvas);
 const context=canvas.getContext('2d',{alpha:false});context.drawImage(image,0,0);image.src='';
 const tiny=document.createElement('canvas');tiny.width=tiny.height=16;const sample=tiny.getContext('2d',{willReadFrequently:true});sample.drawImage(canvas,0,0,16,16);const data=sample.getImageData(0,0,16,16).data;let r=0,g=0,b=0;for(let i=0;i<data.length;i+=4){r+=data[i];g+=data[i+1];b+=data[i+2]}r/=256;g/=256;b/=256;const dark=.2126*r+.7152*g+.0722*b<145,tint=v=>Math.round(dark?v*.18:220+v*.12);
 const old=window.__codexWallpaperBridge;old?.dispose?.();document.getElementById('codex-wallpaper-bridge-layer')?.remove();if(old?.blobUrl)URL.revokeObjectURL(old.blobUrl);document.body.prepend(layer);
 const state=window.__codexWallpaperBridge={installed:true,ready:true,mode:'realtime',transport:'window-capture-jpeg',palette:{r:tint(r),g:tint(g),b:tint(b),dark},frames:1,lastFrameAt:Date.now(),sourceWindow:info.name,captureFps:info.fps,captureError:null};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const paused=()=>document.hidden||(config.pauseOnBlur&&!document.hasFocus())||reduced.matches;
 state.setPauseOnBlur=value=>{config.pauseOnBlur=!!value};
 state.sample=()=>({ready:true,mode:'realtime',paused:paused(),width:canvas.width,height:canvas.height,frames:state.frames,lastFrameAt:state.lastFrameAt,sourceWindow:state.sourceWindow,captureFps:state.captureFps,error:state.captureError,hidden:document.hidden,focused:document.hasFocus(),timing:state.timing});
 let disposed=false;state.dispose=()=>{disposed=true};
 state.draw=async(encoded,info={})=>{if(disposed||paused())return state.sample();const started=performance.now(),image=new Image();image.decoding='async';image.src='data:image/jpeg;base64,'+encoded;await image.decode();const decoded=performance.now();if(!disposed&&!paused()&&(!info.sequence||info.sequence>(state.lastSequence||0))){if(canvas.width!==image.width||canvas.height!==image.height){canvas.width=image.width;canvas.height=image.height}context.drawImage(image,0,0);state.frames++;state.lastSequence=info.sequence;state.lastFrameAt=Date.now();state.timing={sequence:info.sequence,encodeMs:info.encodeMs,decodeMs:decoded-started,drawMs:performance.now()-decoded,receivedToDrawMs:Date.now()-(info.receivedAt||Date.now()),callbackToDrawMs:info.callbackAt?Date.now()-info.callbackAt:null,measurement:'capture-callback-to-canvas-draw; not physical screen presentation'};}image.src='';return state.sample()};
 return state.sample();
}
