// Called only after Windows package/root identity verification by the launcher.
import {connectCdp} from './cdp-client.mjs';
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1],port=Number(value('--cdp-port')),browserId=value('--browser-id');
if(!Number.isInteger(port)||port<1024||port>65535||!/^[a-f0-9-]+$/i.test(browserId||''))throw Error('Invalid verified activation identity');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let target;
const verify=async()=>{const version=await(await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(1500)})).json();if(version.webSocketDebuggerUrl.split('/').pop()!==browserId)throw Error('Browser changed while reopening Codex');};
for(let i=0;i<(args.includes('--no-wait')?1:40);i++){await verify();target=(await(await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(1500)})).json()).find(t=>t.type==='page'&&t.url==='app://-/index.html');if(target)break;await sleep(100);}
if(!target){console.log(JSON.stringify({missingMain:true}));process.exitCode=2;}
else{const c=await connectCdp(target.webSocketDebuggerUrl);try{
 let nativeRestore;
 if(args.includes('--show-current')){
  const restored=await c.call('Runtime.evaluate',{expression:`(async()=>{if(location.href!=='app://-/index.html'||typeof window.electronBridge?.sendMessageFromView!=='function')throw Error('Codex native window bridge is unavailable');await window.electronBridge.sendMessageFromView({type:'open-current-main-window',stealFocus:true});if(document.hidden)await new Promise(resolve=>{let timer;const changed=()=>{if(!document.hidden){clearTimeout(timer);document.removeEventListener('visibilitychange',changed);resolve();}};document.addEventListener('visibilitychange',changed);timer=setTimeout(()=>{document.removeEventListener('visibilitychange',changed);resolve();},600);changed();});if(document.hidden)throw Error('Codex main view remained hidden after native restore');return {bridgeUsed:true,hidden:document.hidden,focused:document.hasFocus()};})()`,awaitPromise:true,returnByValue:true},undefined,2000);
  if(restored.exceptionDetails)throw Error(restored.exceptionDetails.exception?.description||restored.exceptionDetails.text);nativeRestore=restored.result?.value;
 }
 const result=await c.call('Runtime.evaluate',{expression:'({x:screenX,y:screenY,width:outerWidth,height:outerHeight,dpr:devicePixelRatio})',returnByValue:true},undefined,1500);if(result.exceptionDetails)throw Error('Codex main window geometry is unavailable');const geometry=result.result?.value;await verify();console.log(JSON.stringify({mainTarget:target.id,existingBrowser:true,geometry,...(nativeRestore?{nativeRestore}:{})}));
}finally{c.close();}}
