// Serialized into both media and opaque WebGL documents. Copy only when pausing.
export function installFrameFreeze(source,container){
 let frozen=null,timer=0,held=false;
 const release=()=>{clearTimeout(timer);timer=setTimeout(()=>{held=false;if(frozen){frozen.hidden=true;frozen.style.display='none';}},250);};
 return {
  hold(){clearTimeout(timer);if(held)return true;if(!source||!container?.append)return false;const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;if(!width||!height)return false;
   if(!frozen){frozen=document.createElement('canvas');frozen.dataset.cwbFrozen='';frozen.setAttribute('aria-hidden','true');frozen.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none';if(source.parentNode===container)source.after(frozen);else container.append(frozen);}
   frozen.style.filter=source.style.filter;frozen.style.scale=source.style.scale;
   try{frozen.width=width;frozen.height=height;frozen.getContext('2d',{alpha:false}).drawImage(source,0,0,width,height);frozen.hidden=false;frozen.style.display='block';held=true;return true;}catch{frozen.hidden=true;frozen.style.display='none';return false;}
  },release,get held(){return held;},dispose(){clearTimeout(timer);frozen?.remove();held=false;}
 };
}
