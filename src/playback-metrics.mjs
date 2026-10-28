// Counts describe renderer/decoder submissions, never physical screen presentation.
export function playbackMetrics(entry,sample,previous,now=Date.now()){
 if(entry.displayTier==='static')return {reading:null,data:{metric:'静态画面',fps:0,configuredFps:null,measurement:'static frame; no active renderer'},text:`输出 ${sample.width} × ${sample.height} · 静态画面；动态渲染与频谱已停止`};
 const mode=sample.mode||'media',identity=entry.id+':'+(sample.rendererId||sample.rendererStartedAt||mode),count=mode==='realtime'?sample.frames:sample.quality?.total;
 const elapsed=previous?.identity===identity?now-previous.at:0;
 const measured=sample.paused?0:mode==='webwallgl'?sample.stats?.fps:elapsed>=1000&&count>=previous.count?(count-previous.count)*1000/elapsed:null;
 const metric=mode==='webwallgl'?'GPU渲染':mode==='realtime'?(entry.engine==='chromium-web'?'网页画布更新':'原版画布更新'):'视频解码';
 const parts=[`输出 ${sample.width} × ${sample.height}`,`视口 ${sample.viewportWidth||'?'} × ${sample.viewportHeight||'?'}`,`设置上限 ${sample.configuredFps||entry.limits?.fps||'?'} FPS`];
 if(entry.mime?.startsWith('image/')&&entry.mime!=='image/gif'&&mode==='media')parts.push('静态图片');
 else parts.push(metric+' '+(Number.isFinite(measured)?measured.toFixed(1):'待采样')+' FPS');
 if(mode==='media')parts.push('原素材 '+(entry.importInfo?.sourceFps?entry.importInfo.sourceFps.toFixed(2)+' FPS':'帧率未知'));
 if(mode==='webwallgl'){if(sample.videoTexScale!==undefined)parts.push('视频纹理 '+Math.round(sample.videoTexScale*100)+'%');if(sample.qualityEffective)parts.push('实际画质 '+Object.entries(sample.qualityEffective).map(([k,v])=>k+'='+v).join('/'));if(sample.fontsLoaded)parts.push('已载内嵌字体 '+sample.fontsLoaded);if(sample.fontAdapterExpected&&sample.fontBufferAdapter===false)parts.push('当前引擎字体适配未匹配');}
 if(sample.paused)parts.push('已暂停');else if(sample.stats?.idle)parts.push('静止待命');else if(sample.hidden)parts.push('后台');
 return {reading:{identity,count,at:now},data:{metric,fps:Number.isFinite(measured)?measured:null,configuredFps:sample.configuredFps||entry.limits?.fps,measurement:'renderer/decoder/canvas submissions; not physical presentation'},text:parts.join(' · ')+'；非屏幕呈现帧率'};
}
