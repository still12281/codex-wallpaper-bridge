import {normalizeAudioFps} from './system-media.mjs';
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
 let rateSample=null,expectedSince=null,nextStallRecoveryAt=0;
 const delivery=new WeakMap();const stats={starts:0,stops:0,spectrumSent:0,metadataSent:0,panelUpdates:0,captureRestarts:0,deliveryErrors:0,deliveryDrops:0};
 const active=c=>!!(c.mediaActivity?.active&&c.mediaActivity?.webgl);
 const desired=()=>{const audio=!!(options.audio&&[...sessions()].some(c=>active(c)&&c.mediaActivity.audio!==false));return JSON.stringify([!!options.enabled||audio,audio,audio?normalizeAudioFps(options.audioFps):0]);};
 const reconcile=async(force=false)=>{
  if(closed)return;
  const nextKey=desired();if(wanted!==nextKey){wanted=nextKey;changedAt=now();}
  const [enabled,audio,audioFps]=JSON.parse(nextKey);
  const at=now(),state=backend?.state;
  // A paused player or an idle endpoint can legitimately emit no packets.
  // Silent packets still advance spectrumReceivedAt.
  const expected=audio&&state?.audioEnabled===true&&state.now?.playback?.state==='playing'&&nextKey===key;
  expectedSince=expected?(expectedSince??at):null;
  const stalled=expected&&at-Math.max(expectedSince,state.spectrumReceivedAt??0)>=3500&&at>=nextStallRecoveryAt;
  if(nextKey===key&&(!backend||!state.error)&&!stalled)return;
  if(!force&&(at-changedAt<debounceMs||at<retryAt))return;
  if(stalled){stats.captureRestarts++;nextStallRecoveryAt=at+30000;}
  const old=backend;backend=null;key='';rateSample=null;expectedSince=null;if(old){stats.stops++;await old.stop();}
  if(closed||nextKey!==desired())return;
  try{
   const next=enabled?await start({audio,audioFps}):null;
   if(closed||nextKey!==desired()){await next?.stop();return;}
   backend=next;key=nextKey;error=null;retryAt=0;if(next)stats.starts++;
  }catch(e){error=e.message;retryAt=now()+30000;if(force)throw e;}
 };
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const empty=()=>({hasMedia:false,title:'',artist:'',album:'',sourceId:'',sourceName:'',state:0,duration:0,position:0,audioAvailable:false,audioReason:null,bands:[],sources:[],capabilities:{},error});
 const staleBatchMs=250;
 const deliver=async(c,d,work)=>{
  const {activity,metadata,signature,position,frames,bands,frame,sampleClock,audioAvailable,targetRate,receivedHz,panelSignature}=work;
  if(d.renderer!==activity.renderer){
   d.renderer=activity.renderer;d.spectrum=false;d.metadata=null;d.positionAt=null;d.panelOpen=false;
  }
  const push=(kind,payload)=>{
   const current=c.mediaActivity||{};
   if(current.renderer!==activity.renderer||active(c)!==work.active||!!current.panel!==!!activity.panel||
    (kind==='spectrum'&&backend!==work.backend))return false;
   return send(c,kind,payload,activity.renderer);
  };
  if(work.active){
   if(d.metadata!==signature&&(await push('metadata',metadata))!==false){d.metadata=signature;stats.metadataSent++;d.positionAt=-Infinity;}
   if(now()-(d.positionAt??-Infinity)>=5000&&(await push('position',{position:position||0}))!==false)d.positionAt=now();
   if(audioAvailable&&activity.audio!==false){
    if(frames.length&&(await push('spectrum',{frames}))!==false){stats.spectrumSent+=frames.length;d.spectrum=true;d.frame=frame;}
    else if(!sampleClock&&(!d.spectrum||d.frame!==frame)&&(await push('spectrum',{audioAvailable:true,bands}))!==false){stats.spectrumSent++;d.spectrum=true;d.frame=frame;}
   }else if(d.spectrum&&(await push('spectrum',{audioAvailable:false,bands:[]}))!==false){stats.spectrumSent++;d.spectrum=false;}
  }else{
   d.metadata=null;d.positionAt=null;
   if(d.spectrum&&(await push('spectrum',{audioAvailable:false,bands:[]}))!==false){stats.spectrumSent++;d.spectrum=false;}
  }
  if(activity.panel){
   if((!d.panelOpen||d.panel!==panelSignature)&&(await push('panel',{...metadata,targetRate,receivedHz}))!==false){d.panel=panelSignature;stats.panelUpdates++;}
   d.panelOpen=true;
  }else d.panelOpen=false;
 };
 const drain=async(c,d)=>{
  d.running=true;
  try{
   while(!closed&&d.pending){
    const work=d.pending;d.pending=null;
    if(work.frames.length&&now()-work.queuedAt>staleBatchMs){stats.deliveryDrops+=work.frames.length;work.frames=[];}
    await deliver(c,d,work);
   }
  }catch{
   stats.deliveryErrors++;d.retryAt=now()+250;
  }finally{d.running=false;}
 };
 const offer=(c,work)=>{
  let d=delivery.get(c);
  if(!d){d={spectrum:false,pending:null,running:false,retryAt:0};delivery.set(c,d);}
  if(!work.active&&!work.activity.panel&&!d.running&&!d.pending&&!d.spectrum&&!d.panelOpen&&d.metadata==null)return;
  const previous=d.pending;
  if(d.running||previous||now()<d.retryAt){
   const limit=Math.max(4,Math.ceil(work.targetRate*staleBatchMs/1000));
   const retained=previous&&previous.backend===work.backend&&previous.activity.renderer===work.activity.renderer&&work.audioAvailable&&work.activity.audio!==false&&
    work.active&&work.queuedAt-previous.queuedAt<=staleBatchMs?previous.frames:[];
   const frames=[...retained,...work.frames];
   stats.deliveryDrops+=(previous?.frames.length||0)+work.frames.length-Math.min(limit,frames.length);
   work.frames=frames.slice(-limit);
   if(retained.length>Math.max(0,frames.length-limit))work.queuedAt=previous.queuedAt;
  }
  d.pending=work;
  if(!d.running&&now()>=d.retryAt)void drain(c,d);
 };
 const pump=async()=>{
  await reconcile();if(closed)return;
  const clients=[...sessions()],needed=clients.some(c=>active(c)||c.mediaActivity?.panel);
  const raw=(needed&&backend?.payload())||empty();
  const payload=options.enabled?raw:{...empty(),audioAvailable:raw.audioAvailable,audioReason:raw.audioReason,bands:raw.bands,sources:raw.sources,error:raw.error};
  const {bands,position,...metadata}=payload;
  // Position is a separate correction; frequency frames never invalidate metadata.
  const signature=JSON.stringify(metadata),frame=backend?.state.spectrumFrames||0;
  const frames=backend?.drainSpectrum?.()||[];
  const sampleClock=Number.isSafeInteger(backend?.state.spectrumDetails?.sampleEnd);
  const targetRate=backend?.state.audioFps||0;
  if(sampleClock||targetRate>60){
   const at=now();
   if(!rateSample)rateSample={at,frame,hz:null};
   else if(at-rateSample.at>=1000)rateSample={at,frame,hz:Math.round((frame-rateSample.frame)*1000/(at-rateSample.at))};
  }
  const panelSignature=signature+':'+targetRate+':'+(rateSample?.hz??'');
  for(const c of clients){
   const activity=c.mediaActivity||{};
   const visible=active(c);
   offer(c,{activity,backend,active:visible,metadata,signature,position,frames:visible&&activity.audio!==false&&payload.audioAvailable?frames:[],
    bands,frame,sampleClock,audioAvailable:payload.audioAvailable,targetRate,receivedHz:rateSample?.hz??null,panelSignature,queuedAt:now()});
  }
 };
 return {
  configure(next){options={...next};return serial(()=>reconcile(true));},
  tick(){return serial(pump);},
  get backend(){return backend;},
  snapshot(){
   const state=backend?.state;
   return {...stats,audioRequested:!!options.audio,audioFpsRequested:normalizeAudioFps(options.audioFps),audioRunning:!!backend&&JSON.parse(key||'[false,false]')[1]&&(state.audioEnabled!==true||backend.payload().audioAvailable),
    spectrumAgeMs:Number.isFinite(state?.spectrumReceivedAt)?Math.max(0,now()-state.spectrumReceivedAt):null,
    audioFps:backend?(state.audioFps??JSON.parse(key)[2])||0:0,receivedHz:rateSample?.hz??null,pid:state?.pid||null,
    spectrumFrames:state?.spectrumFrames||0,sampleGaps:state?.sampleGaps||0,sampleEnd:state?.spectrumDetails?.sampleEnd||0,
    queueDrops:state?.queueDrops||0,maxQueued:state?.maxQueued||0,error};
  },
  stop(){closed=true;return serial(async()=>{const old=backend;backend=null;await old?.stop();});}
 };
}
