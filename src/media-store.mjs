import {realpath,unlink,rename} from 'node:fs/promises';
import path from 'node:path';
function references(root,settings,file){const absolute=path.resolve(root,file).toLowerCase();return settings.library.some(e=>[e.file,e.sourceFile,e.sourcePath,e.staticFile].filter(Boolean).some(p=>path.resolve(root,p).toLowerCase()===absolute))}
export async function removeManagedFile(root,settings,file){
 if(!file||references(root,settings,file))return false;
 const absolute=path.resolve(root,file),relative=path.relative(root,absolute);
 if(!/^(media|staging)[\\/][^\\/]+\.(mp4|webm|webp|png|jpg|jpeg|gif)$/i.test(relative))return false;
 let resolved;try{resolved=await realpath(absolute)}catch(e){if(e.code==='ENOENT')return false;throw e}
 const boundary=(await realpath(root))+path.sep;if(!resolved.toLowerCase().startsWith(boundary.toLowerCase()))throw Error('缓存路径越界，未删除');
 await unlink(absolute);return true;
}
export async function commitConverted(root,settings,entry,converted,previous,apply,save){
 const {destination,...media}=converted;Object.assign(entry,media);
 try{await apply();if(destination){await rename(path.join(root,entry.file),path.join(root,destination));entry.file=destination}await save(root,settings)}
 catch(error){for(const key of Object.keys(entry))delete entry[key];Object.assign(entry,previous);await apply().catch(()=>{});await removeManagedFile(root,settings,media.file).catch(()=>{});throw error}
 if(previous.file&&previous.file!==entry.file)await removeManagedFile(root,settings,previous.file);
}
