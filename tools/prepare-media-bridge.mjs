import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {getDataRoot} from '../src/runtime-paths.mjs';
import {stereoMediaDirectory} from '../src/system-media.mjs';

const version='0.5.0';
const asset='media-bridge-stereo-win32-x64.exe';
const bytesExpected=2991104;
const sha256='8ca658fc1b9381716b61ea5f51835ba0ddb54d358604c746231e22313cf7a46e';
const valid=bytes=>bytes.length===bytesExpected&&createHash('sha256').update(bytes).digest('hex')===sha256;
if(process.platform!=='win32'||process.arch!=='x64')throw Error('Stereo media preparation requires Windows x64.');
const directory=path.join(getDataRoot(),'engines',stereoMediaDirectory);
const binary=path.join(directory,'media-bridge.exe');
const license=await readFile(new URL('./media-bridge.LICENSE',import.meta.url));
const installed=await readFile(binary).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
const reused=!!installed&&valid(installed);
if(!reused){
 const local=process.env.CODEX_WALLPAPER_MEDIA_ASSET;
 let bytes;
 if(local)bytes=await readFile(local);
 else{
  const url='https://github.com/still12281/codex-wallpaper-bridge/releases/download/v'+version+'/'+asset;
  const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw Error('Stereo media download failed: '+response.status);
  bytes=Buffer.from(await response.arrayBuffer());
 }
 if(!valid(bytes))throw Error('Stereo media SHA-256 mismatch.');
 await mkdir(directory,{recursive:true});
 const staged=binary+'.'+randomUUID()+'.next';
 await writeFile(staged,bytes,{flag:'wx'});
 await rename(staged,binary);
}
await writeFile(path.join(directory,'LICENSE'),license);
console.log(JSON.stringify({prepared:true,version:'0.1.5-stereo',directory,sha256,reused}));
