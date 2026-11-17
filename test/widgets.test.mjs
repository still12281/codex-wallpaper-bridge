import test from 'node:test';
import assert from 'node:assert/strict';
import {installNativeWidgets} from '../src/wallpaper-widgets.mjs';

function environment(supported=true){
 const names=['window','document','MutationObserver','requestAnimationFrame','cancelAnimationFrame'],saved=new Map(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const surface={toggleAttribute(){},removeAttribute(){}};
 Object.assign(globalThis,{window:{},document:{body:{},querySelectorAll:()=>supported?[{href:'app://-/assets/app-initial-ad16eaadf81f.js'}]:[]},MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}});
 class Terminal{constructor(){this.raw={theme:{background:'#fff',foreground:'#111'},fontSize:13,minimumContrastRatio:1,allowTransparency:true};this.rows=2;this.element={closest:()=>surface};this.fail=false}get options(){return this.raw}set options(next){Object.assign(this.raw,next)}open(){}refresh(){if(this.fail)throw Error('renderer unavailable')}dispose(){}}
 const terminal=new Terminal(),renderer={terminal},manager={renderers:new Map([['fixture',renderer]]),getOrCreateRenderer(){return renderer},releaseRenderer(){}};
 return {terminal,manager,module:{f3t:manager},restore(){window.__cwbWidgets?.dispose();for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}};
}
const config={palette:{dark:true},surfaceSync:{code:true}};
test('transparent terminal keeps inverse RGB, resets contaminated ANSI overrides, and guards explicit cell contrast',async()=>{
 const luminance=hex=>hex.slice(1,7).match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 for(const dark of [true,false]){const e=environment();try{
  const original={background:'#ffffff',foreground:'#111111',black:'rgba(26,28,31,.494)',white:'rgb(26,28,31)',red:'#c71f2d',blue:'#1c5fbd'};e.terminal.options.theme={...original};
  const palette=dark?{r:20,g:22,b:28,dark}:{r:239,g:240,b:245,dark};await installNativeWidgets({...config,palette},async()=>e.module);
  const theme=e.terminal.options.theme;assert.equal(theme.background,dark?'#3b3d4200':'#c7c8cc00');assert(ratio(theme.foreground,theme.background)>=7,'Normal and reversed defaults must both remain legible');
  for(const key of ['black','white','red','blue','brightBlack','brightWhite'])assert(!Object.hasOwn(theme,key),'Use the library opaque ANSI defaults');assert.equal(e.terminal.options.minimumContrastRatio,4.5);assert.equal(e.terminal.options.allowTransparency,true);
  await installNativeWidgets({...config,palette,visual:{glassOpacity:1}},async()=>e.module);assert.equal(e.terminal.options.theme.background,dark?'#14161c00':'#eff0f500');await installNativeWidgets({...config,palette},async()=>e.module);
  e.terminal.options.minimumContrastRatio=2;assert.equal(e.terminal.options.minimumContrastRatio,4.5);e.terminal.options={minimumContrastRatio:7,fontSize:16};assert.equal(e.terminal.options.minimumContrastRatio,7);
  await installNativeWidgets({...config,palette,surfaceSync:{code:false}},async()=>e.module);assert.deepEqual(e.terminal.options.theme,original);assert.equal(e.terminal.options.minimumContrastRatio,7);
  e.terminal.options.minimumContrastRatio=2;await installNativeWidgets({...config,palette},async()=>e.module);assert.equal(e.terminal.options.minimumContrastRatio,4.5);window.__cwbWidgets.dispose();assert.equal(e.terminal.options.minimumContrastRatio,2);assert.equal(e.terminal.options.fontSize,16);assert.deepEqual(e.terminal.options.theme,original);
 }finally{e.restore()}}
});

test('unsupported client safely retains native terminal behavior',async()=>{
 const e=environment(false);try{const r=await installNativeWidgets(config,async()=>{throw Error('must not load')});assert.equal(r.phase,'unsupported');assert.equal(Object.hasOwn(e.terminal,'options'),false)}finally{e.restore()}
});
test('the inspected 438d client uses its exact terminal manager export',async()=>{
 const e=environment();try{document.querySelectorAll=()=>[{href:'app://-/assets/app-initial-438d1df57f70.js'}];let loaded;const result=await installNativeWidgets(config,async url=>{loaded=url;return {Lrt:e.manager}});assert.equal(loaded,'app://-/assets/app-initial-438d1df57f70.js');assert.equal(result.phase,'adapted');assert.equal(e.terminal.options.theme.background,'#3b3d4200');window.__cwbWidgets.dispose();assert.equal(e.terminal.options.theme.background,'#fff');}finally{e.restore()}
});
test('new native module hashes and renamed exports resolve by one manager contract without calling exports',async()=>{
 const e=environment();try{document.querySelectorAll=()=>[{href:'app://-/assets/app-initial-db76c3384587.js'}];const result=await installNativeWidgets(config,async()=>({unrelated(){throw Error('must not invoke')},Bat:e.manager,alias:e.manager}));assert.equal(result.phase,'adapted');assert.equal(result.terminals,1);assert.equal(result.adapter,'terminal-manager-contract-v1');assert.equal(e.terminal.options.theme.background,'#3b3d4200');}finally{e.restore()}
});
test('no terminal is armed rather than marked adapted; a later native renderer is themed',async()=>{
 const e=environment();try{e.manager.renderers.clear();const result=await installNativeWidgets(config,async()=>e.module);assert.equal(result.phase,'armed');assert.equal(result.terminals,0);e.manager.getOrCreateRenderer();assert.equal(window.__cwbWidgets.status.phase,'adapted');assert.equal(window.__cwbWidgets.status.terminals,1);assert.equal(e.terminal.options.theme.background,'#3b3d4200');e.terminal.dispose();assert.equal(window.__cwbWidgets.status.phase,'armed');assert.equal(window.__cwbWidgets.status.terminals,0);}finally{e.restore()}
});
test('a native module loaded after initialization can recover without polling or a new adapter instance',async()=>{
 const e=environment(false);try{await installNativeWidgets(config,async()=>e.module);const first=window.__cwbWidgets;assert.equal(first.status.phase,'unsupported');document.querySelectorAll=()=>[{href:'app://-/assets/app-initial-db76c3384587.js'}];await installNativeWidgets(config,async()=>({Bat:e.manager}));assert.equal(window.__cwbWidgets,first);assert.equal(first.status.phase,'adapted');}finally{e.restore()}
});
test('ambiguous managers and accessor-shaped candidates do not change terminal options',async()=>{
 const e=environment();try{let reads=0;const accessor={get renderers(){reads++;return e.manager.renderers},getOrCreateRenderer(){},releaseRenderer(){}};const second={...e.manager,renderers:new Map()};const result=await installNativeWidgets(config,async()=>({a:e.manager,b:second,c:accessor}));assert.equal(result.phase,'unsupported');assert.match(result.reason,/Ambiguous/);assert.equal(reads,0);assert.equal(Object.hasOwn(e.terminal,'options'),false);assert.equal(e.terminal.options.theme.background,'#fff');}finally{e.restore()}
});
test('disposing during module loading cannot install a late manager hook',async()=>{
 const e=environment();try{let resolve;const pending=new Promise(r=>{resolve=r}),original=e.manager.getOrCreateRenderer,installing=installNativeWidgets(config,()=>pending);window.__cwbWidgets.dispose();delete window.__cwbWidgets;resolve(e.module);await installing;assert.equal(e.manager.getOrCreateRenderer,original);assert.equal(Object.hasOwn(e.terminal,'options'),false)}finally{e.restore()}
});
test('renderer failure removes hooks and cannot silently reapply after fallback',async()=>{
 const e=environment();try{const original=e.manager.getOrCreateRenderer;await installNativeWidgets(config,async()=>e.module);e.terminal.fail=true;window.__cwbWidgets.update();assert.equal(window.__cwbWidgets.status.phase,'unsupported');assert.equal(e.manager.getOrCreateRenderer,original);assert.equal(e.terminal.options.theme.background,'#fff');e.terminal.fail=false;e.manager.getOrCreateRenderer();assert.equal(Object.hasOwn(e.terminal,'options'),false);assert.equal(e.terminal.options.theme.background,'#fff')}finally{e.restore()}
});
test('theme restoration uses latest native colors and preserves other terminal options',async()=>{
 const e=environment();try{await installNativeWidgets(config,async()=>e.module);const held=e.terminal.options;held.fontSize=17;held.theme={background:'#eee',foreground:'#222'};assert.equal(e.terminal.options.theme.background,'#3b3d4200');await installNativeWidgets({...config,surfaceSync:{code:false}},async()=>e.module);assert.equal(e.terminal.options.theme.background,'#eee');assert.equal(e.terminal.options.fontSize,17);window.__cwbWidgets.dispose();held.theme={background:'#ddd'};assert.equal(e.terminal.options.theme.background,'#ddd');assert.equal(Object.hasOwn(e.terminal,'options'),false)}finally{e.restore()}
});
test('Rspack reads only the uniquely identified cached manager; neither loader nor factory is executed',async()=>{
 const e=environment();try{
  document.querySelectorAll=()=>[{tagName:'SCRIPT',type:'module',src:'app://-/assets/348410.1a97dde15f.js'}];
  let calls=0;const loader=()=>{calls++;throw Error('Loader must never run')};
  // The real factory defines a manager with public class fields.
  loader.m={manager:function(){throw Error('Factory must never run');class Manager{renderers=new Map;getOrCreateRenderer(){}releaseRenderer(){}}return Manager;}};
  loader.c={};const module={__webpack_require__:loader};
  let result=await installNativeWidgets(config,async()=>module);assert.equal(result.phase,'unsupported');assert.equal(calls,0);assert.equal(Object.hasOwn(e.terminal,'options'),false);
  const manager=e.manager,exports={};Object.defineProperty(exports,'A',{enumerable:true,get:()=>manager});Object.defineProperty(exports,'danger',{enumerable:true,get(){throw Error('Arbitrary getter must never run')}});loader.c.manager={exports};
  result=await installNativeWidgets(config,async()=>module);assert.equal(result.phase,'adapted');assert.equal(result.terminals,1);assert.equal(calls,0);assert.equal(e.terminal.options.theme.background,'#3b3d4200');
  window.__cwbWidgets.dispose();delete window.__cwbWidgets;loader.m.second=loader.m.manager;
  result=await installNativeWidgets(config,async()=>module);assert.equal(result.phase,'unsupported');assert.match(result.reason,/Ambiguous/);assert.equal(calls,0);assert.equal(Object.hasOwn(e.terminal,'options'),false);
 }finally{e.restore()}
});
