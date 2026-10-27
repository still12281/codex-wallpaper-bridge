import {mkdir,stat,lstat,realpath,readdir,link,copyFile,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
const access=new Map(),pattern=/^conversion-[a-f0-9]{64}\.(mp4|png|jpg|webp)$/;
const target=(root,key,ext)=>{if(!/^[a-f0-9]{64}$/.test(key)||!/^\.(mp4|png|jpg|webp)$/.test(ext))throw Error('转换缓存标识无效');return path.join(root,'staging','conversion-'+key+ext);};
async function boundary(root){const base=(await realpath(root))+path.sep,directory=await realpath(path.join(root,'staging'));if(!directory.toLowerCase().startsWith(base.toLowerCase()))throw Error('转换缓存路径越界');}
export async function cachedConversion(root,key,ext){
 const file=target(root,key,ext);try{await boundary(root);const info=await lstat(file);if(!info.isFile()||!info.size)return null;access.delete(file);access.set(file,Date.now());while(access.size>32)access.delete(access.keys().next().value);return file;}catch{return null;}
}
export async function rememberConversion(root,key,file){
 if(!key)return;const ext=path.extname(file),destination=target(root,key,ext),directory=path.dirname(destination);await mkdir(directory,{recursive:true});
 if((await stat(path.join(root,file))).size>256*1024*1024)return;
 await boundary(root);access.set(destination,Date.now());while(access.size>32)access.delete(access.keys().next().value);
 try{await link(path.join(root,file),destination);}catch(error){if(error.code!=='EEXIST')await copyFile(path.join(root,file),destination,constants.COPYFILE_EXCL).catch(e=>{if(e.code!=='EEXIST')throw e;});}
 const files=[];for(const item of await readdir(directory,{withFileTypes:true})){if(!item.isFile()||!pattern.test(item.name))continue;const absolute=path.join(directory,item.name),info=await stat(absolute);files.push({absolute,size:info.size,last:access.get(absolute)||info.mtimeMs});}
 files.sort((a,b)=>b.last-a.last);let bytes=0;for(const [index,item]of files.entries()){bytes+=item.size;if(index>=16||bytes>256*1024*1024){await unlink(item.absolute);access.delete(item.absolute);}}
}
export async function clearConversionCache(root){
 try{await boundary(root);}catch(error){if(error.code==='ENOENT')return 0;throw error;}
 const directory=path.join(root,'staging');let count=0;for(const item of await readdir(directory,{withFileTypes:true}))if(item.isFile()&&pattern.test(item.name)){const file=path.join(directory,item.name);await unlink(file);access.delete(file);count++;}return count;
}
