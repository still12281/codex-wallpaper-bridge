export const visualDefaults={theme:'auto',glassBlur:0,glassOpacity:.5,wallpaperBlur:0,brightness:1,flip:false,speed:1,transitionMs:250,fontFamily:'inherit',codeFontFamily:'inherit',fontSize:14,parallax:0,volume:0,fxEnabled:false,fxClick:true,fxTrail:true,fxClickStyle:'ripple',fxTrailStyle:'comet',fxColorMode:'accent',fxColor:'#6cd9e8',fxClickSize:140,fxClickGlow:60,fxTrailLength:420,fxTrailWidth:3,fxTrailGlow:60,fxOpacity:85,fxBlend:'screen'};
const ranges={glassBlur:[0,24],glassOpacity:[.2,1],wallpaperBlur:[0,20],brightness:[.25,1.5],speed:[.25,2],transitionMs:[0,1000],fontSize:[12,22],parallax:[0,30],volume:[0,1],fxClickSize:[40,400],fxClickGlow:[0,100],fxTrailLength:[80,2000],fxTrailWidth:[1,12],fxTrailGlow:[0,100],fxOpacity:[10,100]};
const choices={theme:['auto','light','dark'],fontFamily:['inherit','system-ui','Microsoft YaHei','KaiTi','SimSun'],codeFontFamily:['inherit','Consolas','Cascadia Code','monospace'],fxClickStyle:['ripple','spark','both'],fxTrailStyle:['comet','dust'],fxColorMode:['accent','rainbow','custom'],fxBlend:['screen','normal','lighten']};
export function sanitizeVisual(values={}){
 if(!values||typeof values!=='object'||Array.isArray(values))throw Error('外观配置无效');const result={...visualDefaults};
 for(const [key,value]of Object.entries(values)){if(!(key in visualDefaults))throw Error('不支持的外观字段：'+key);if(key in ranges){const [min,max]=ranges[key];if(!Number.isFinite(value)||value<min||value>max)throw Error('外观参数超出范围：'+key);}else if(key in choices){if(!choices[key].includes(value))throw Error('外观选项无效：'+key);}else if(key==='fxColor'){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw Error('特效颜色无效');}else if(typeof value!=='boolean')throw Error('外观开关无效：'+key);result[key]=value;}
 return result;
}
export function appearancePalette(settings){
 const palette=settings.palette||{r:20,g:22,b:28,dark:true},theme=settings.visual?.theme;
 return theme==='light'?{r:240,g:242,b:246,dark:false}:theme==='dark'?{r:20,g:22,b:28,dark:true}:palette;
}
export function appearanceSnapshot(settings){return {visual:sanitizeVisual(settings.visual),darkOverlay:settings.darkOverlay??.4,lightOverlay:settings.lightOverlay??.4,pauseOnBlur:settings.pauseOnBlur!==false,surfaceSync:{code:settings.surfaceSync?.code!==false,embedded:settings.surfaceSync?.embedded!==false}};}
export function parsePreset(input){
 if(typeof input!=='string'||input.length>65536)throw Error('预设文件过大或无效');let value;try{value=JSON.parse(input);}catch{throw Error('预设不是有效 JSON');}
 if(value?.format!=='codex-wallpaper-appearance'||value.version!==1||typeof value.name!=='string'||!value.name.trim()||value.name.length>80)throw Error('不支持此预设格式或版本');
 const p=value.appearance;if(!p||!Number.isFinite(p.darkOverlay)||p.darkOverlay<.25||p.darkOverlay>.85||!Number.isFinite(p.lightOverlay)||p.lightOverlay<.25||p.lightOverlay>.85||typeof p.pauseOnBlur!=='boolean')throw Error('预设中的遮罩或播放设置无效');
 return {name:value.name.trim(),appearance:{visual:sanitizeVisual(p.visual),darkOverlay:p.darkOverlay,lightOverlay:p.lightOverlay,pauseOnBlur:p.pauseOnBlur,surfaceSync:{code:p.surfaceSync?.code!==false,embedded:p.surfaceSync?.embedded!==false}}};
}
export function nextRotation(settings,random=Math.random){
 const rotation=settings.rotation||{},hidden=new Set(settings.hiddenWallpaperIds||[]),ids=new Set(rotation.ids||[]),candidates=settings.library.filter(e=>!['realtime','webwallgl'].includes(e.mode)&&e.file&&!hidden.has(e.workshopId||e.sourceKey||e.id)&&(!ids.size||ids.has(e.id)));
 if(candidates.length<2)return null;const available=candidates.filter(e=>e.id!==settings.selectedId);if(rotation.order==='shuffle')return available[Math.min(available.length-1,Math.floor(random()*available.length))];const index=candidates.findIndex(e=>e.id===settings.selectedId);return candidates[(index+1)%candidates.length];
}
