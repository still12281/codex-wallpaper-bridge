import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';

// A per-project capability. Never accept arbitrary filesystem paths from a wallpaper.
export async function createProjectReader(projectRoot){
 const root=await realpath(projectRoot);let transferred=0;const charged=new Set();
 const resolve=async name=>{
  if(typeof name!=='string'||name.length>1024||/[\0:]/.test(name)||path.isAbsolute(name)||name.replace(/\\/g,'/').split('/').some(s=>s==='..'||s==='.'))throw Error('壁纸请求了无效资源路径');
  let file;try{file=await realpath(path.join(root,name));}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))return null;throw error;}
  const relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('壁纸资源越过项目目录');
  const info=await stat(file);if(!info.isFile())return null;const charge=charged.has(file)?0:info.size;if(info.size>512*1024*1024||transferred+charge>768*1024*1024)throw Error('壁纸资源超过实时渲染预算');
  return {file,info,charge};
 };
 const charge=asset=>{transferred+=asset.charge;charged.add(asset.file);};
 const read=async name=>{const asset=await resolve(name);if(!asset)return null;charge(asset);return readFile(asset.file);};
 // Host-only capability: the sandbox still receives bytes, never this path or a File.
 const localFile=async name=>{const asset=await resolve(name);if(!asset)return null;charge(asset);return {path:asset.file,size:asset.info.size,modified:asset.info.mtimeMs};};
 const metadata=async name=>{const asset=await resolve(name);return asset?{size:asset.info.size,etag:'"'+asset.info.size.toString(16)+'-'+asset.info.mtimeMs.toString(16)+'-'+asset.info.ctimeMs.toString(16)+'"'}:null;};
 const metadataPath=await realpath(path.join(root,'project.json')),relative=path.relative(root,metadataPath);if(relative.startsWith('..')||path.isAbsolute(relative)||(await stat(metadataPath)).size>1024*1024)throw Error('壁纸元数据路径或大小无效');
 const project=JSON.parse(await read('project.json'));if(!['scene','web'].includes(String(project.type).toLowerCase()))throw Error('WebWallGL 仅支持场景与网页项目');
 return {root,project,read,metadata,localFile,get bytes(){return transferred}};
}
