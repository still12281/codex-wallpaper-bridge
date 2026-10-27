import test from 'node:test';import assert from 'node:assert/strict';
import {playbackMetrics} from '../src/playback-metrics.mjs';
import {gpuProfile,realtimeProfile} from '../src/realtime-source.mjs';
import {mediaLimits} from '../src/media-preflight.mjs';
test('measure decoder and canvas increments separately from caps, reset counters, zero paused rates',()=>{
 const entry={id:'a',limits:{fps:60},mime:'video/mp4',importInfo:{sourceFps:24}},sample={width:1280,height:720,quality:{total:100}};
 const first=playbackMetrics(entry,sample,null,1000);assert.equal(first.data.fps,null);
 const next=playbackMetrics(entry,{...sample,quality:{total:148}},first.reading,3000);assert.equal(next.data.fps,24);assert(next.text.includes('设置上限 60'));assert(next.text.includes('原素材 24.00'));
 assert.equal(playbackMetrics(entry,{...sample,quality:{total:2}},next.reading,5000).data.fps,null);
 assert.equal(playbackMetrics(entry,{...sample,paused:true},next.reading,5000).data.fps,0);
 assert.equal(playbackMetrics(entry,{mode:'webwallgl',stats:{fps:58},qualityEffective:{postProcessing:'high'}},null,1000).data.metric,'GPU渲染');
 const native=playbackMetrics(entry,{mode:'realtime',frames:20},null,1000);assert.equal(playbackMetrics(entry,{mode:'realtime',frames:74},native.reading,3000).data.fps,27);
 const still=playbackMetrics({...entry,mode:'webwallgl',displayTier:'static',limits:{fps:144}},sample,null,1000);assert.equal(still.data.fps,0);assert.equal(still.data.configuredFps,null);assert(!still.text.includes('视频解码'));
});
test('GPU high-refresh does not relax native capture or media import caps',()=>{
 assert.equal(gpuProfile({maxWidth:3840,maxHeight:2160,fps:144,exactResolution:true}).exactResolution,true);
 for(const fps of [120,144]){assert.equal(gpuProfile({maxWidth:1280,fps}).fps,fps);assert.throws(()=>realtimeProfile({maxWidth:1280,fps}));assert.throws(()=>mediaLimits({maxWidth:1280,fps}));}
});
