// Functions are serialized into the renderer. Keep browser code dependency-free.
export async function installRealtime(config,base64,info){
 const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
 const image=await createImageBitmap(new Blob([bytes],{type:'image/jpeg'}));
 const layer=document.createElement('div');layer.id='codex-wallpaper-bridge-layer';layer.setAttribute('aria-hidden','true');layer.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0';
 const shadow=layer.attachShadow({mode:'open'}),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.style.cssText='width:100%;height:100%;object-fit:cover;display:block';shadow.append(canvas);
 const context=canvas.getContext('2d',{alpha:false});context.drawImage(image,0,0);image.close();
 const tiny=document.createElement('canvas');tiny.width=tiny.height=16;const sample=tiny.getContext('2d',{willReadFrequently:true});sample.drawImage(canvas,0,0,16,16);const data=sample.getImageData(0,0,16,16).data;let r=0,g=0,b=0;for(let i=0;i<data.length;i+=4){r+=data[i];g+=data[i+1];b+=data[i+2]}r/=256;g/=256;b/=256;const dark=.2126*r+.7152*g+.0722*b<145,tint=v=>Math.round(dark?v*.18:220+v*.12);
 const old=window.__codexWallpaperBridge;old?.dispose?.();document.getElementById('codex-wallpaper-bridge-layer')?.remove();if(old?.blobUrl)URL.revokeObjectURL(old.blobUrl);document.body.prepend(layer);
 const state=window.__codexWallpaperBridge={installed:true,ready:true,mode:'realtime',transport:'window-capture-jpeg',palette:{r:tint(r),g:tint(g),b:tint(b),dark},frames:1,lastFrameAt:Date.now(),sourceWindow:info.name,captureFps:info.fps,captureError:null};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const paused=()=>document.hidden||(config.pauseOnBlur&&!document.hasFocus())||reduced.matches;
 state.setPauseOnBlur=value=>{config.pauseOnBlur=!!value};
 state.sample=()=>({ready:true,mode:'realtime',paused:paused(),width:canvas.width,height:canvas.height,frames:state.frames,lastFrameAt:state.lastFrameAt,sourceWindow:state.sourceWindow,captureFps:state.captureFps,error:state.captureError,hidden:document.hidden,focused:document.hasFocus()});
 let disposed=false;state.dispose=()=>{disposed=true};
 state.draw=async encoded=>{if(disposed||paused())return;const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),image=await createImageBitmap(new Blob([bytes],{type:'image/jpeg'}));if(!disposed){if(canvas.width!==image.width||canvas.height!==image.height){canvas.width=image.width;canvas.height=image.height}context.drawImage(image,0,0);state.frames++;state.lastFrameAt=Date.now()}image.close()};
 return state.sample();
}
