export async function connectCdp(url){
 if(!/^ws:\/\/127\.0\.0\.1:\d+\/devtools\/(?:page|browser)\/[A-Za-z0-9-]+$/.test(url))throw Error('Invalid loopback CDP URL');
 const ws=new WebSocket(url);let sequence=0,closing=false;const pending=new Map();
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.close();reject(Error('CDP connect timeout'))},5000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP connection failed'))},{once:true})});
 ws.addEventListener('message',e=>{let value;try{value=JSON.parse(e.data)}catch{return}const request=pending.get(value.id);if(!request)return;pending.delete(value.id);clearTimeout(request.timer);value.error?request.reject(Error(value.error.message)):request.resolve(value.result)});
 const rejectPending=()=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('CDP disconnected'))}pending.clear();};
 ws.addEventListener('close',()=>{closing=true;rejectPending()});
 const call=(method,params={},sessionId,timeoutMs=20000)=>new Promise((resolve,reject)=>{if(closing||ws.readyState!==1){reject(Error('CDP disconnected'));return}const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'))},timeoutMs);pending.set(id,{resolve,reject,timer});try{ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))}catch(error){pending.delete(id);clearTimeout(timer);reject(error)}});
 const evaluate=async(expression,contextId,sessionId)=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,...(contextId?{contextId}:{})},sessionId);if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value};
 return {ws,call,evaluate,close:()=>{if(closing)return;closing=true;rejectPending();ws.close()}};
}
