// This function runs in the Codex page. Events replace a permanent CDP polling loop.
export function installMediaActivity(token){
 if(window.__cwbMediaActivity?.token===token){window.__cwbMediaActivity.report();return;}
 window.__cwbMediaActivity?.dispose();let last='';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const report=()=>{const s=window.__codexWallpaperBridge,host=document.getElementById('codex-wallpaper-controls');
  const active=s?.mode==='webwallgl'&&s.ready&&!s.error&&!s.paused&&!document.hidden;
  const payload={token,renderer:s?.rendererId||'',active:!!active,audio:s?.supportsAudio!==false,webgl:s?.mode==='webwallgl',panel:!!host?.__cwbMediaPanelVisible?.()};
  const key=JSON.stringify(payload);if(key===last)return;last=key;
  if(!active)s?.setSystemSpectrum?.({audioAvailable:false,bands:[]});
  window.__cwbMediaActivitySend(JSON.stringify(payload));
 };
 const changed=()=>queueMicrotask(report);
 document.addEventListener('visibilitychange',changed);addEventListener('focus',changed);addEventListener('blur',changed);reduced.addEventListener('change',changed);
 window.__cwbMediaActivity={token,report,dispose(){document.removeEventListener('visibilitychange',changed);removeEventListener('focus',changed);removeEventListener('blur',changed);reduced.removeEventListener('change',changed);}};report();
}

export function createMediaPower({start,sessions,send,now=Date.now,debounceMs=600}){
 let options={enabled:false,audio:false},backend=null,key='',wanted='',changedAt=0,retryAt=0,error=null,closed=false,queue=Promise.resolve();
 const delivery=new WeakMap();const stats={starts:0,stops:0,spectrumSent:0,metadataSent:0,panelUpdates:0};
 const active=c=>!!(c.mediaActivity?.active&&c.mediaActivity?.webgl);
 const desired=()=>JSON.stringify([!!options.enabled,!!(options.enabled&&options.audio&&[...sessions()].some(c=>active(c)&&c.mediaActivity.audio!==false))]);
 const reconcile=async(force=false)=>{
  if(closed)return;
  const nextKey=desired();if(wanted!==nextKey){wanted=nextKey;changedAt=now();}
  if(nextKey===key&&(!backend||!backend.state.error))return;
  if(!force&&(now()-changedAt<debounceMs||now()<retryAt))return;
  const old=backend;backend=null;key='';if(old){stats.stops++;await old.stop();}
  if(closed||nextKey!==desired())return;
  const [enabled,audio]=JSON.parse(nextKey);
  try{
   const next=enabled?await start({audio}):null;
   if(closed||nextKey!==desired()){await next?.stop();return;}
   backend=next;key=nextKey;error=null;retryAt=0;if(next)stats.starts++;
  }catch(e){error=e.message;retryAt=now()+30000;if(force)throw e;}
 };
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const empty=()=>({hasMedia:false,title:'',artist:'',album:'',sourceId:'',sourceName:'',state:0,duration:0,position:0,audioAvailable:false,audioReason:null,bands:[],sources:[],capabilities:{},error});
 const pump=async()=>{
  await reconcile();if(closed)return;
  const clients=[...sessions()],needed=clients.some(c=>active(c)||c.mediaActivity?.panel);
  const payload=(needed&&backend?.payload())||empty();
  const {bands,position,...metadata}=payload;
  // Position is a separate correction; frequency frames never invalidate metadata.
  const signature=JSON.stringify(metadata),frame=backend?.state.spectrumFrames||0;
  for(const c of clients){
   const activity=c.mediaActivity||{};let d=delivery.get(c);
   if(!d||d.renderer!==activity.renderer){d={renderer:activity.renderer,spectrum:false};delivery.set(c,d);}
   if(active(c)){
    if(d.metadata!==signature){await send(c,'metadata',metadata);d.metadata=signature;stats.metadataSent++;d.positionAt=-Infinity;}
    if(now()-(d.positionAt??-Infinity)>=5000){await send(c,'position',{position:position||0});d.positionAt=now();}
    if(payload.audioAvailable&&activity.audio!==false){if(!d.spectrum||d.frame!==frame){await send(c,'spectrum',{audioAvailable:true,bands});stats.spectrumSent++;d.spectrum=true;d.frame=frame;}}
    else if(d.spectrum){await send(c,'spectrum',{audioAvailable:false,bands:[]});stats.spectrumSent++;d.spectrum=false;}
   }else {d.metadata=null;d.positionAt=null;if(d.spectrum){await send(c,'spectrum',{audioAvailable:false,bands:[]});stats.spectrumSent++;d.spectrum=false;}}
   if(activity.panel){if(!d.panelOpen||d.panel!==signature){await send(c,'panel',metadata);d.panel=signature;stats.panelUpdates++;}d.panelOpen=true;}else d.panelOpen=false;
  }
 };
 return {
  configure(next){options={...next};return serial(()=>reconcile(true));},
  tick(){return serial(pump);},
  get backend(){return backend;},
  snapshot(){return {...stats,audioRequested:!!options.audio,audioRunning:!!backend&&JSON.parse(key||'[false,false]')[1],pid:backend?.state.pid||null,spectrumFrames:backend?.state.spectrumFrames||0,error};},
  stop(){closed=true;return serial(async()=>{const old=backend;backend=null;await old?.stop();});}
 };
}
