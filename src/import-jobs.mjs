import {randomUUID} from 'node:crypto';
export const importCancelled=()=>Object.assign(Error('已取消本次导入并清理临时产物'),{code:'IMPORT_CANCELLED'});
// Bounded, owner-scoped operations. Cancellation is the only queue bypass.
export function createImportJobs({progress=()=>{}}={}){
 const jobs=new Map(),cancelled=[];
 const key=(owner,id)=>[...jobs.values()].find(j=>j.owner===owner&&j.id===id);
 const begin=(owner,req)=>{
  if(!['media-pick','import-start','import-end','wallpaper-engine','wallpaper-engine-confirm'].includes(req.action))return null;
  req.operationId??='import-'+randomUUID();if(!/^[a-zA-Z0-9_-]{1,96}$/.test(req.operationId))throw Error('导入任务标识无效');
  for(let i=cancelled.length-1;i>=0;i--)if(cancelled[i].expires<Date.now())cancelled.splice(i,1);
  let job=key(owner,req.operationId)||cancelled.find(j=>j.owner===owner&&j.id===req.operationId);if(job)return job;
  if(jobs.size>=32)throw Error('导入任务过多，请等待当前任务结束');
  job={id:req.operationId,owner,controller:new AbortController(),phase:'queued',last:0};jobs.set(job,job);Promise.resolve(progress(owner,{operationId:job.id,phase:'排队'})).catch(()=>{});return job;
 };
 const get=(owner,id)=>key(owner,id)||cancelled.find(j=>j.owner===owner&&j.id===id);
 const report=(job,value)=>{if(!job)return;job.phase=value.phase;if(Date.now()-job.last<250&&(value.processedSeconds!==undefined||value.processedBytes!==undefined))return;job.last=Date.now();Promise.resolve(progress(job.owner,{operationId:job.id,...value})).catch(()=>{});};
 const cancel=(owner,id)=>{const job=key(owner,id);if(!job)return {cancelAccepted:false,message:'任务已经结束，未取消其他操作。'};if(job.phase==='committing')return {cancelAccepted:false,message:'正在完成保存，请等待提交结束。'};job.controller.abort(importCancelled());return {cancelAccepted:true,message:'已请求取消，正在清理本次临时产物。'};};
 const end=job=>{if(!job)return;jobs.delete(job);if(job.controller.signal.aborted&&!cancelled.includes(job)){job.expires=Date.now()+300000;cancelled.push(job);while(cancelled.length>64)cancelled.shift();}};
 return {begin,get,report,cancel,end,ownerJobs:owner=>[...jobs.values()].filter(j=>j.owner===owner)};
}
