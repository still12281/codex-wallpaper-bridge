import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {AUDIO_FPS_OPTIONS,startSystemMedia} from '../src/system-media.mjs';
import {getDataRoot} from '../src/runtime-paths.mjs';
import {playQuietAudio} from './fixtures/quiet-audio.mjs';

// Use the installed component and an owned, bounded audio fixture.
assert(!process.env.CODEX_WALLPAPER_MEDIA_BRIDGE,'Clear the custom media override to verify the installed component');
const stopTone=playQuietAudio(45);
try{
 for(const rate of AUDIO_FPS_OPTIONS){
  const frames=[];
  let capture;
  try{
   capture=await startSystemMedia(getDataRoot(),{audio:true,audioFps:rate,onSpectrum:()=>{
    if(capture)frames.push(...capture.drainSpectrum());
   }});
   const deadline=Date.now()+6000;
   while(!frames.length&&Date.now()<deadline)await delay(120);
   assert(frames.length,'No WASAPI samples at '+rate);
   const first=frames.at(-1);frames.length=0;
   const startingGaps=capture.state.sampleGaps,startingDrops=capture.state.queueDrops;
   await delay(2400);
   const last=frames.at(-1);
   assert(last&&last.sampleRate===first.sampleRate,'Audio endpoint changed during sampling');
   const hz=frames.length*last.sampleRate/(last.sampleEnd-first.sampleEnd);
   const gaps=capture.state.sampleGaps-startingGaps,drops=capture.state.queueDrops-startingDrops;
   assert(Math.abs(hz-rate)<.2&&gaps===0&&drops===0,'Invalid native spectrum cadence at '+rate);
   assert(frames.every((frame,i)=>frame.left.length===64&&frame.right.length===64&&
    frame.sampleEnd>(i?frames[i-1].sampleEnd:first.sampleEnd)));
   assert(frames.some(frame=>frame.left.some((value,i)=>Math.abs(value-frame.right[i])>.001)),'Stereo channels did not differ');
   console.log(JSON.stringify({rate,applied:hz,frames:frames.length,gaps,drops,maxQueued:capture.state.maxQueued}));
  }finally{await capture?.stop();}
 }
}finally{await stopTone();}
