// Fetch only the browser runtime and original license, never install package scripts.
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {getDataRoot} from '../src/runtime-paths.mjs';
const integrity='If5DUW3hHeWOyyhvswHkycWm0U5mWJUpKb4ws/J+jrwK3gUbmpoyyACfezKClrcpMB8u2UNyl/ni3M0Z2gjjww==';
const directory=path.join(getDataRoot(),'engines','webwallgl-3.0.0');
const expected=new Map([
 ['LICENSE','857432ca4f48930e6079aca25164c27b791576ee2a7d3e3c9d6a92a089fe4948'],
 ['package.json','0f5c66347c0a873e27b7d13364cfbaf98404efd1f9d2525af993f2ee76383a32'],
 ['webwallgl.global.min.js','2f86ab955f3377e2fa2cfd5ffa72f5813fe8f6e4a272295fed36f4c1e626b1e5']
]);
const valid=(name,bytes)=>createHash('sha256').update(bytes).digest('hex')===expected.get(name);
const cached=await Promise.all([...expected.keys()].map(async name=>{
 try{return valid(name,await readFile(path.join(directory,name)));}
 catch(error){if(error.code==='ENOENT')return false;throw error;}
}));
if(cached.every(Boolean)){
 console.log(JSON.stringify({prepared:true,version:'3.0.0',directory,reused:true}));
}else{
 const response=await fetch('https://registry.npmjs.org/webwallgl/-/webwallgl-3.0.0.tgz',{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('WebWallGL download failed: '+response.status);
 const archive=Buffer.from(await response.arrayBuffer());
 if(createHash('sha512').update(archive).digest('base64')!==integrity)throw Error('WebWallGL package integrity mismatch');
 const tar=gunzipSync(archive),files=new Map();
 for(let offset=0;offset+512<=tar.length;){const header=tar.subarray(offset,offset+512),name=header.subarray(0,100).toString().replace(/\0.*$/s,''),size=parseInt(header.subarray(124,136).toString().replace(/\0.*$/s,'').trim(),8)||0;if(!name)break;if(['package/webwallgl.global.min.js','package/LICENSE','package/package.json'].includes(name))files.set(path.basename(name),tar.subarray(offset+512,offset+512+size));offset+=512+Math.ceil(size/512)*512;}
 if(files.size!==expected.size||![...files].every(([name,bytes])=>valid(name,bytes)))throw Error('Unexpected WebWallGL package layout');
 await mkdir(directory,{recursive:true});
 for(const [name,bytes]of files){await writeFile(path.join(directory,name+'.next'),bytes);await rename(path.join(directory,name+'.next'),path.join(directory,name));}
 console.log(JSON.stringify({prepared:true,version:'3.0.0',directory,integrity:'sha512-'+integrity,reused:false}));
}
