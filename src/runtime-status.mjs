import {rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

export function createRuntimeStatusWriter(root,{onFailure=()=>{},replace=rename,pause=delay}={}){
 const temporary=path.join(root,'runtime-status.next.json');
 const destination=path.join(root,'runtime-status.json');
 let pending=null,writing=null,retries=0,failures=0,error=null;

 async function publish(value){
  await writeFile(temporary,value);
  // The reader or another Windows process can briefly hold the old snapshot.
  for(const wait of [0,25,75]){
   if(wait)await pause(wait);
   try{await replace(temporary,destination);return;}
   catch(failure){
    if(process.platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(failure.code)||wait===75)throw failure;
    retries++;
   }
  }
 }

 async function drain(){
  try{
   while(pending!==null){
    const value=pending;
    pending=null;
    try{await publish(value);error=null;}
    catch(failure){
     failures++;
     const detail=String(failure?.message||failure);
     if(error===null)onFailure(detail);
     error=detail;
    }
   }
  }finally{writing=null;}
 }

 return {
  save(value){pending=value;return writing??=drain();},
  get retries(){return retries;},
  get failures(){return failures;},
  get error(){return error;}
 };
}
