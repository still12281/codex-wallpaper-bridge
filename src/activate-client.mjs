// Called only after Windows package/root identity verification by the launcher.
import {connectCdp} from './cdp-client.mjs';

const args=process.argv.slice(2);
const value=key=>args.includes(key)?args[args.indexOf(key)+1]:undefined;
const port=Number(value('--cdp-port')),browserId=value('--browser-id');
const boundTarget=value('--main-target'),showBound=args.includes('--show-bound');
if(!Number.isInteger(port)||port<1024||port>65535||!/^[a-f0-9-]+$/i.test(browserId||''))throw Error('Invalid verified activation identity');
if((showBound||args.includes('--main-target'))&&!/^[a-f0-9]+$/i.test(boundTarget||''))throw Error('Invalid bound main target');

const base='http://127.0.0.1:'+port,socket='ws://127.0.0.1:'+port+'/devtools/';
const mainUrl='app://-/index.html',sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const read=async route=>{
 const response=await fetch(base+route,{signal:AbortSignal.timeout(1500),redirect:'error'});
 if(!response.ok)throw Error('Codex endpoint returned HTTP '+response.status);
 return response.json();
};
const verify=async()=>{
 const version=await read('/json/version');
 if(version.webSocketDebuggerUrl!==socket+'browser/'+browserId)throw Error('Browser changed while reopening Codex');
};

let target;
for(let i=0;i<(args.includes('--no-wait')?1:40);i++){
 await verify();
 const candidates=(await read('/json/list')).filter(t=>t.type==='page'&&t.url===mainUrl&&/^[a-f0-9]+$/i.test(t.id||'')&&t.webSocketDebuggerUrl===socket+'page/'+t.id);
 target=boundTarget?candidates.find(t=>t.id===boundTarget):candidates[0];
 if(target)break;
 if(!args.includes('--no-wait'))await sleep(100);
}

if(!target){
 console.log(JSON.stringify({missingMain:true}));
 process.exitCode=2;
}else{
 const c=await connectCdp(target.webSocketDebuggerUrl);
 try{
  let nativeRestore,geometry;
  if(showBound||args.includes('--show-current')){
   const restored=await c.call('Runtime.evaluate',{expression:`(async()=>{
    if(location.href!=='app://-/index.html'||typeof window.electronBridge?.sendMessageFromView!=='function')throw Error('Codex native window bridge is unavailable');
    await window.electronBridge.sendMessageFromView({type:'open-current-main-window',stealFocus:true});
    if(document.hidden)await new Promise(resolve=>{
     let timer;
     const finish=()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',changed);resolve();};
     const changed=()=>{if(!document.hidden)finish();};
     document.addEventListener('visibilitychange',changed);timer=setTimeout(finish,600);changed();
    });
    if(document.hidden)throw Error('Codex main view remained hidden after native restore');
    return {bridgeUsed:true,hidden:document.hidden,focused:document.hasFocus()};
   })()`,awaitPromise:true,returnByValue:true},undefined,2000);
   if(restored.exceptionDetails)throw Error(restored.exceptionDetails.exception?.description||restored.exceptionDetails.text);
   nativeRestore=restored.result?.value;
  }
  if(!showBound){
   const result=await c.call('Runtime.evaluate',{expression:'({x:screenX,y:screenY,width:outerWidth,height:outerHeight,dpr:devicePixelRatio})',returnByValue:true},undefined,1500);
   if(result.exceptionDetails)throw Error('Codex main window geometry is unavailable');
   geometry=result.result?.value;
  }
  await verify();
  console.log(JSON.stringify({mainTarget:target.id,existingBrowser:true,geometry,nativeRestore}));
 }finally{c.close();}
}
