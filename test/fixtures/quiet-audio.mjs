import {spawn} from 'node:child_process';
import {getPowerShell} from '../../src/runtime-paths.mjs';

export function playQuietAudio(seconds){
 const sampleRate=48000,frameBytes=4,frames=sampleRate*seconds;
 const wav=Buffer.alloc(44+frames*frameBytes);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
 wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);
 wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*frameBytes,28);
 wav.writeUInt16LE(frameBytes,32);wav.writeUInt16LE(16,34);
 wav.write('data',36);wav.writeUInt32LE(frames*frameBytes,40);
 for(let i=0;i<sampleRate;i++){
  wav.writeInt16LE(Math.round(32*Math.sin(2*Math.PI*440*i/sampleRate)),44+i*4);
  wav.writeInt16LE(Math.round(27*Math.sin(2*Math.PI*1700*i/sampleRate)),46+i*4);
 }
 for(let i=1;i<seconds;i++)wav.copy(wav,44+i*sampleRate*frameBytes,44,44+sampleRate*frameBytes);
 const script='$m=[IO.MemoryStream]::new();[Console]::OpenStandardInput().CopyTo($m);$m.Position=0;$p=[System.Media.SoundPlayer]::new($m);try{$p.PlaySync()}finally{$p.Dispose();$m.Dispose()}';
 const player=spawn(getPowerShell(),['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['pipe','ignore','inherit']});
 player.stdin.on('error',()=>{});
 const done=new Promise((resolve,reject)=>{player.once('close',resolve);player.once('error',reject);});
 done.catch(()=>{});
 player.stdin.end(wav);
 return async()=>{
  if(player.exitCode===null&&player.signalCode===null)player.kill();
  return done;
 };
}
