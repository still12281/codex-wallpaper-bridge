import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {paintShell} from '../src/wallpaper-style.mjs';

// Capture the production sheet before document listeners install. This fast
// contract runs in npm test; Chromium integration verifies its rendering cost.
function generatedSheet(config){
 let css;const done={};
 const sheet={set textContent(value){css=value;throw done;}};
 const document={getElementById:id=>id==='codex-wallpaper-bridge-style'?sheet:null};
 try{vm.runInNewContext('('+paintShell.toString()+')(config)',{window:{__codexWallpaperBridge:{ready:true}},document,config});}catch(error){if(error!==done)throw error;}
 assert.equal(typeof css,'string','Painter did not generate a stylesheet');return css;
}
function localStyleContract(css){
 assert(!/\[class\s*~=/.test(css),'Exact class tokens must use class selectors');
 for(const name of ['--cwb-transcript-clip','--cwb-code-clip-top','--cwb-transcript-start','--cwb-transcript-end']){
  const rule=css.match(new RegExp('@property\\s+'+name+'\\s*\\{([^}]*)\\}'))?.[1];
  assert(rule&&/inherits\s*:\s*false\s*(?:;|$)/.test(rule),name+' must stay local to its element');
 }
}
test('generated shell styles bound class and clipping dependencies in native modes',()=>{
 for(const dark of [false,true])for(const code of [false,true]){
  const css=generatedSheet({palette:{r:30,g:38,b:49,dark},visual:{glassOpacity:.5,glassBlur:0},lightOverlay:.4,darkOverlay:.4,surfaceSync:{code}});
  localStyleContract(css);
  assert.throws(()=>localStyleContract(css+'\n[class~="bg-inherit"]{background:inherit}'),/Exact class tokens/);
  assert.throws(()=>localStyleContract(css.replace('inherits:false','inherits:true')),/must stay local/);
 }
});
