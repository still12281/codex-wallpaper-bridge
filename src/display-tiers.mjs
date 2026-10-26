import {appearancePalette} from './appearance-model.mjs';
// Lower tiers adjust budgets. Full projects can request native rendering after confirmation.
export const DISPLAY_TIERS={
 static:{name:'静态',description:'保存当前画面；停止视频、场景渲染和频谱采集',audioFps:0},
 economy:{name:'省电',maxWidth:960,fps:12,postProcessing:'low',particles:'low',videoTexScale:.5,audioFps:0,description:'960 / 12 FPS；保留基础动画，停用频谱、视差与互动装饰'},
 balanced:{name:'均衡',maxWidth:1280,fps:24,postProcessing:'medium',particles:'medium',videoTexScale:.5,audioFps:20,description:'1280 / 24 FPS；保留效果链，频谱最多 20 次/秒'},
 smooth:{name:'高画质',maxWidth:1920,fps:30,postProcessing:'high',particles:'high',videoTexScale:.75,audioFps:30,description:'1920 / 30 FPS；保留效果链，频谱最多 30 次/秒'},
 full:{name:'最高画质',maxWidth:3840,fps:60,postProcessing:'high',particles:'high',videoTexScale:1,audioFps:60,description:'3840 × 2160 渲染；可选择 GPU 场景或原版兼容，按窗口缩放显示，不补帧'},
 custom:{name:'自定义',audioFps:60,description:'保留当前具体参数，在高级设置中分别调整'}
};
export const selectedEntry=settings=>settings.library?.find(e=>e.id===settings.selectedId);
export const displayTier=entry=>DISPLAY_TIERS[entry?.displayTier]||DISPLAY_TIERS.custom;
export function effectiveEntry(entry){
 if(entry?.displayTier!=='static')return entry;
 if(!entry.staticFile)throw Error('静态画面尚未准备好；当前背景保持不变');
 return {...entry,mode:undefined,file:entry.staticFile,mime:'image/png',limits:{...entry.limits,maxBytes:32*1024*1024}};
}
export function effectiveMediaSettings(settings){
 const tier=displayTier(selectedEntry(settings)),saved=settings.systemMedia||{};
 return {...saved,audio:!!saved.audio&&tier.audioFps!==0,audioFps:Math.min(saved.audioFps||30,tier.audioFps||30)};
}
export function displaySettings(settings){
 const quiet=['static','economy'].includes(selectedEntry(settings)?.displayTier);
 return {...settings,palette:appearancePalette(settings),systemMedia:effectiveMediaSettings(settings),visual:quiet?{...settings.visual,fxEnabled:false,parallax:0,volume:0,glassBlur:0}:settings.visual};
}
