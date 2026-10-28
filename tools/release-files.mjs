import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {reviewedImages} from './release-images.mjs';
export const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const canonical=buffer=>buffer.toString('utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
export const digest=text=>createHash('sha256').update(text,'utf8').digest('hex');
export async function releaseFiles(directory=repoRoot,prefix=''){
 const files=[];for(const item of await readdir(directory,{withFileTypes:true})){if(['.git','node_modules'].includes(item.name))continue;const relative=(prefix?prefix+'/':'')+item.name;if(item.isSymbolicLink())throw Error('Links are not allowed in a release: '+relative);if(item.isDirectory())files.push(...await releaseFiles(path.join(directory,item.name),relative));else if(item.isFile())files.push(relative)}return files.sort();
}
export async function manifestEntries(){const entries=[];for(const file of await releaseFiles()){if(file==='release-manifest.json')continue;const bytes=await readFile(path.join(repoRoot,file));if(reviewedImages.has(file))entries.push({path:file,hashMode:'raw-bytes',bytes:bytes.length,sha256:digest(bytes)});else{const text=canonical(bytes);entries.push({path:file,utf8Bytes:Buffer.byteLength(text),sha256:digest(text)})}}return entries}
