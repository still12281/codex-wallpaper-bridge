// Minimal local CDP peer for the launcher dispatch fixture.
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {writeFileSync} from 'node:fs';

const [ready,shown,browser]=process.argv.slice(2);
const server=createServer((req,res)=>{res.writeHead(404);res.end();});
server.on('upgrade',(req,socket,head)=>{
 if(req.url!=='/devtools/browser/'+browser){socket.end('HTTP/1.1 404 Not Found\r\n\r\n');return;}
 const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
 socket.on('error',()=>socket.destroy());
 let buffer=Buffer.alloc(0);
 function receive(chunk){
  buffer=Buffer.concat([buffer,chunk]);
  while(buffer.length>=2){
   if(buffer[0]===0x88){socket.end();return;}
   if(buffer[0]!==0x81||!(buffer[1]&128)){socket.destroy();return;}
   let size=buffer[1]&127,offset=2;
   if(size===127){socket.destroy();return;}
   if(size===126){if(buffer.length<4)return;size=buffer.readUInt16BE(2);offset=4;}
   if(buffer.length<offset+4+size)return;
   const mask=buffer.subarray(offset,offset+4),data=buffer.subarray(offset+4,offset+4+size);
   for(let i=0;i<data.length;i++)data[i]^=mask[i%4];
   const {id,method,params,sessionId}=JSON.parse(data.toString());
   buffer=buffer.subarray(offset+4+size);
   let result;
   if(method==='Target.getTargetInfo'&&params.targetId==='A11')result={targetInfo:{type:'page',url:'app://-/index.html'}};
   if(method==='Target.attachToTarget'&&params.targetId==='A11'&&params.flatten)result={sessionId:'main'};
   if(method==='Runtime.evaluate'&&sessionId==='main'&&params.awaitPromise&&params.expression.includes('open-current-main-window')){
    writeFileSync(shown,'direct');result={result:{type:'boolean',value:true}};
   }
   const reply=Buffer.from(JSON.stringify(result?{id,result}:{id,error:{message:'Unexpected fixture call'}}));
   if(reply.length>=126){socket.destroy();return;}
   socket.write(Buffer.concat([Buffer.from([0x81,reply.length]),reply]));
  }
 }
 socket.on('data',receive);if(head.length)receive(head);
});
let port=9354;
server.on('error',error=>{if(error.code==='EADDRINUSE'&&port>9335)server.listen(--port,'127.0.0.1');else throw error;});
server.on('listening',()=>writeFileSync(ready,String(port)));
server.listen(port,'127.0.0.1');
