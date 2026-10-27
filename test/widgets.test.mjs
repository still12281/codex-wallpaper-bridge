import test from 'node:test';
import assert from 'node:assert/strict';
import {installNativeWidgets} from '../src/wallpaper-widgets.mjs';

function environment(supported=true){
 const names=['window','document','MutationObserver','requestAnimationFrame','cancelAnimationFrame'],saved=new Map(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const surface={toggleAttribute(){},removeAttribute(){}};
 Object.assign(globalThis,{window:{},document:{body:{},querySelectorAll:()=>supported?[{href:'app://-/assets/app-initial-ad16eaadf81f.js'}]:[]},MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}});
 class Terminal{constructor(){this.raw={theme:{background:'#fff',foreground:'#111'},fontSize:13};this.rows=2;this.element={closest:()=>surface};this.fail=false}get options(){return this.raw}set options(next){Object.assign(this.raw,next)}open(){}refresh(){if(this.fail)throw Error('renderer unavailable')}dispose(){}}
 const terminal=new Terminal(),renderer={terminal},manager={renderers:new Map([['fixture',renderer]]),getOrCreateRenderer(){return renderer},releaseRenderer(){}};
 return {terminal,manager,module:{f3t:manager},restore(){window.__cwbWidgets?.dispose();for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}};
}
const config={palette:{dark:true},surfaceSync:{code:true}};

test('unsupported client safely retains native terminal behavior',async()=>{
 const e=environment(false);try{const r=await installNativeWidgets(config,async()=>{throw Error('must not load')});assert.equal(r.phase,'unsupported');assert.equal(Object.hasOwn(e.terminal,'options'),false)}finally{e.restore()}
});
test('the inspected 438d client uses its exact terminal manager export',async()=>{
 const e=environment();try{document.querySelectorAll=()=>[{href:'app://-/assets/app-initial-438d1df57f70.js'}];let loaded;const result=await installNativeWidgets(config,async url=>{loaded=url;return {Lrt:e.manager}});assert.equal(loaded,'app://-/assets/app-initial-438d1df57f70.js');assert.equal(result.phase,'adapted');assert.equal(e.terminal.options.theme.background,'#00000000');window.__cwbWidgets.dispose();assert.equal(e.terminal.options.theme.background,'#fff');}finally{e.restore()}
});
test('disposing during module loading cannot install a late manager hook',async()=>{
 const e=environment();try{let resolve;const pending=new Promise(r=>{resolve=r}),original=e.manager.getOrCreateRenderer,installing=installNativeWidgets(config,()=>pending);window.__cwbWidgets.dispose();delete window.__cwbWidgets;resolve(e.module);await installing;assert.equal(e.manager.getOrCreateRenderer,original);assert.equal(Object.hasOwn(e.terminal,'options'),false)}finally{e.restore()}
});
test('renderer failure removes hooks and cannot silently reapply after fallback',async()=>{
 const e=environment();try{const original=e.manager.getOrCreateRenderer;await installNativeWidgets(config,async()=>e.module);e.terminal.fail=true;window.__cwbWidgets.update();assert.equal(window.__cwbWidgets.status.phase,'unsupported');assert.equal(e.manager.getOrCreateRenderer,original);assert.equal(e.terminal.options.theme.background,'#fff');e.terminal.fail=false;e.manager.getOrCreateRenderer();assert.equal(Object.hasOwn(e.terminal,'options'),false);assert.equal(e.terminal.options.theme.background,'#fff')}finally{e.restore()}
});
test('theme restoration uses latest native colors and preserves other terminal options',async()=>{
 const e=environment();try{await installNativeWidgets(config,async()=>e.module);const held=e.terminal.options;held.fontSize=17;held.theme={background:'#eee',foreground:'#222'};assert.equal(e.terminal.options.theme.background,'#00000000');await installNativeWidgets({...config,surfaceSync:{code:false}},async()=>e.module);assert.equal(e.terminal.options.theme.background,'#eee');assert.equal(e.terminal.options.fontSize,17);window.__cwbWidgets.dispose();held.theme={background:'#ddd'};assert.equal(e.terminal.options.theme.background,'#ddd');assert.equal(Object.hasOwn(e.terminal,'options'),false)}finally{e.restore()}
});
