// Called only after Windows package/root identity verification by the launcher.
import {connectCdp} from './cdp-client.mjs';
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1],port=Number(value('--cdp-port')),browserId=value('--browser-id');
if(!Number.isInteger(port)||port<1024||port>65535||!/^[a-f0-9-]+$/i.test(browserId||''))throw Error('Invalid verified activation identity');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let target;
const verify=async()=>{const version=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();if(version.webSocketDebuggerUrl.split('/').pop()!==browserId)throw Error('Browser changed while reopening Codex');};
for(let i=0;i<(args.includes('--no-wait')?1:40);i++){await verify();target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page'&&t.url==='app://-/index.html');if(target)break;await sleep(100);}
if(!target){console.log(JSON.stringify({missingMain:true}));process.exitCode=2;}
else{const c=await connectCdp(target.webSocketDebuggerUrl);try{const geometry=await c.evaluate('({x:screenX,y:screenY,width:outerWidth,height:outerHeight,dpr:devicePixelRatio})');await verify();console.log(JSON.stringify({mainTarget:target.id,existingBrowser:true,geometry}));}finally{c.close();}}
