// Fetch only the browser runtime and original license, never install package scripts.
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {getDataRoot} from '../src/runtime-paths.mjs';
const integrity='If5DUW3hHeWOyyhvswHkycWm0U5mWJUpKb4ws/J+jrwK3gUbmpoyyACfezKClrcpMB8u2UNyl/ni3M0Z2gjjww==';
const response=await fetch('https://registry.npmjs.org/webwallgl/-/webwallgl-3.0.0.tgz',{signal:AbortSignal.timeout(45000)});
if(!response.ok)throw Error('WebWallGL download failed: '+response.status);
const archive=Buffer.from(await response.arrayBuffer());
if(createHash('sha512').update(archive).digest('base64')!==integrity)throw Error('WebWallGL package integrity mismatch');
const tar=gunzipSync(archive),files=new Map();
for(let offset=0;offset+512<=tar.length;){const header=tar.subarray(offset,offset+512),name=header.subarray(0,100).toString().replace(/\0.*$/s,''),size=parseInt(header.subarray(124,136).toString().replace(/\0.*$/s,'').trim(),8)||0;if(!name)break;if(['package/webwallgl.global.min.js','package/LICENSE','package/package.json'].includes(name))files.set(path.basename(name),tar.subarray(offset+512,offset+512+size));offset+=512+Math.ceil(size/512)*512;}
if(files.size!==3||JSON.parse(files.get('package.json')).version!=='3.0.0')throw Error('Unexpected WebWallGL package layout');
const directory=path.join(getDataRoot(),'engines','webwallgl-3.0.0');await mkdir(directory,{recursive:true});
for(const [name,bytes]of files){await writeFile(path.join(directory,name+'.next'),bytes);await rename(path.join(directory,name+'.next'),path.join(directory,name));}
console.log(JSON.stringify({prepared:true,version:'3.0.0',directory,integrity:'sha512-'+integrity}));
