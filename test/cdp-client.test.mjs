import test from 'node:test';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';

test('local CDP close rejects pending and later calls without waiting for a close event or timeout',async()=>{
 const original=globalThis.WebSocket;
 class FakeSocket extends EventTarget {
  readyState=1;sent=0;
  constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
  send(){this.sent++;if(this.failSend)throw Error('synthetic send failure');}
  close(){this.readyState=2;}
 }
 globalThis.WebSocket=FakeSocket;
 try{
  const c=await connectCdp('ws://127.0.0.1:9335/devtools/page/fixture');
  const pending=c.call('Runtime.evaluate');const rejected=assert.rejects(pending,/disconnected/);
  c.close();await rejected;
  await assert.rejects(c.evaluate('true'),/disconnected/);
  assert.equal(c.ws.sent,1);c.close();
  const failed=await connectCdp('ws://127.0.0.1:9335/devtools/page/fixture');
  failed.ws.failSend=true;await assert.rejects(failed.call('Runtime.evaluate'),/synthetic send failure/);failed.close();
 }finally{globalThis.WebSocket=original;}
});
