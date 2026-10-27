import {realpath,unlink,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {rememberConversion} from './conversion-cache.mjs';
function references(root,settings,file){const absolute=path.resolve(root,file).toLowerCase();return settings.library.some(e=>[e.file,e.sourceFile,e.sourcePath,e.staticFile,e.customDisplay?.file].filter(Boolean).some(p=>path.resolve(root,p).toLowerCase()===absolute))}
export async function removeManagedFile(root,settings,file){
 if(!file||references(root,settings,file))return false;
 const absolute=path.resolve(root,file),relative=path.relative(root,absolute);
 if(!/^(media|staging)[\\/][^\\/]+\.(mp4|webm|webp|png|jpg|jpeg|gif)$/i.test(relative))return false;
 let resolved;try{resolved=await realpath(absolute)}catch(e){if(e.code==='ENOENT')return false;throw e}
 const boundary=(await realpath(root))+path.sep;if(!resolved.toLowerCase().startsWith(boundary.toLowerCase()))throw Error('缓存路径越界，未删除');
 await unlink(absolute);return true;
}
export async function commitConverted(root,settings,entry,converted,previous,apply,save){
 const {destination,cacheKey,...media}=converted;
 // Every commit owns a new final file. Never overwrite bytes used by a rollback
 // or a saved custom tier, including when an older converter supplies a stable name.
 const final=destination?'media/wallpaper-'+randomUUID()+path.extname(destination):media.file;
 let moved=false;
 try{if(destination){await rename(path.join(root,media.file),path.join(root,final));moved=true;}Object.assign(entry,media,{file:final});await apply();await save(root,settings)}
 catch(error){for(const key of Object.keys(entry))delete entry[key];Object.assign(entry,previous);await apply().catch(()=>{});await removeManagedFile(root,settings,moved?final:media.file).catch(()=>{});throw error}
 // Saving is the commit point. A cleanup failure cannot roll back persisted state.
 await rememberConversion(root,cacheKey,entry.file).catch(()=>{});
 if(previous.file&&previous.file!==entry.file)await removeManagedFile(root,settings,previous.file).catch(()=>{});
}
