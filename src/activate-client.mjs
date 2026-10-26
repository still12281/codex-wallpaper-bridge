// Called only after Windows package/root identity verification by the launcher.
import {connectCdp} from './cdp-client.mjs';
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1],port=Number(value('--cdp-port')),browserId=value('--browser-id');
if(!Number.isInteger(port)||port<1024||port>65535||!/^[a-f0-9-]+$/i.test(browserId||''))throw Error('Invalid verified activation identity');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let target;
for(let i=0;i<40;i++){const version=await(await fetch('http://127.0.0.1:'+port+'/json/version')).json();if(version.webSocketDebuggerUrl.split('/').pop()!==browserId)throw Error('Browser changed while reopening Codex');target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page'&&t.url==='app://-/index.html');if(target)break;await sleep(100);}
if(!target)throw Error('Codex main window was not restored; detached windows are not a substitute');
const c=await connectCdp(target.webSocketDebuggerUrl);try{await c.call('Page.bringToFront');console.log(JSON.stringify({mainTarget:target.id,existingBrowser:true}));}finally{c.close();}
