import {readFile,writeFile,mkdir,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical,digest,repoRoot} from './release-files.mjs';

const within=(parent,child)=>{const relative=path.relative(parent,child);return !relative||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep))};
async function resolveCreationPath(directory){
 const tail=[];let current=directory;
 for(;;){try{return path.join(await realpath(current),...tail)}catch(error){if(error.code!=='ENOENT')throw error;const parent=path.dirname(current);if(parent===current)throw error;tail.unshift(path.basename(current));current=parent;}}
}
async function safeDirectory(directory){
 const parsed=path.parse(directory);let current=parsed.root;
 for(const part of directory.slice(parsed.root.length).split(path.sep).filter(Boolean)){
  current=path.join(current,part);try{await mkdir(current)}catch(error){if(error.code!=='EEXIST')throw error;}
  const entry=await lstat(current);if(!entry.isDirectory()||entry.isSymbolicLink())throw Error('Installation directory contains a link or non-directory');
 }
}
export async function installSource(sourceRoot,dataRoot){
 if(!path.isAbsolute(dataRoot)||path.parse(dataRoot).root===path.resolve(dataRoot))throw Error('Use an absolute, non-root data directory');
 sourceRoot=await realpath(sourceRoot);dataRoot=await resolveCreationPath(path.resolve(dataRoot));
 if(within(sourceRoot,dataRoot)||within(dataRoot,sourceRoot))throw Error('Data directory and source checkout must be separate');
 const manifestBytes=await readFile(path.join(sourceRoot,'release-manifest.json')),manifest=JSON.parse(manifestBytes.toString('utf8'));
 const checked=[],seen=new Set();
 for(const record of manifest.files){
  if(typeof record.path!=='string'||record.path.includes('\\')||record.path.split('/').some(p=>!p||p==='.'||p==='..')||path.isAbsolute(record.path)||record.path.includes(':')||seen.has(record.path)||record.path==='release-manifest.json')throw Error('Unsafe or duplicate manifest path');
  seen.add(record.path);
  const file=path.join(sourceRoot,record.path),resolved=await realpath(file);
  if(!within(sourceRoot,resolved)||(await lstat(file)).isSymbolicLink())throw Error('Source file escapes the checkout');
  const bytes=await readFile(file),input=record.hashMode==='raw-bytes'?bytes:canonical(bytes),size=record.hashMode==='raw-bytes'?bytes.length:Buffer.byteLength(input);
  if(digest(input)!==record.sha256||size!==(record.hashMode==='raw-bytes'?record.bytes:record.utf8Bytes))throw Error('Source checksum mismatch: '+record.path);
  checked.push({record,bytes});
 }
 const directory=path.join(dataRoot,'versions','release-'+digest(manifestBytes).slice(0,16));
 await safeDirectory(directory);
 for(const {record,bytes}of [...checked,{record:{path:'release-manifest.json'},bytes:manifestBytes}]){
  const target=path.join(directory,record.path);await safeDirectory(path.dirname(target));
  try{await writeFile(target,bytes,{flag:'wx'})}catch(error){
   if(error.code!=='EEXIST')throw error;
   const existing=await lstat(target);if(existing.isSymbolicLink()||!existing.isFile()||!(await readFile(target)).equals(bytes))throw Error('Installed version was modified; preserving it: '+record.path);
  }
 }
 return {directory,files:checked.length+1};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const index=process.argv.indexOf('--data-dir');if(index<0||!process.argv[index+1])throw Error('Use --data-dir <absolute directory>');
 console.log(JSON.stringify(await installSource(repoRoot,process.argv[index+1])));
}
