import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,readFile,writeFile,rename,realpath,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {getDataRoot} from '../src/runtime-paths.mjs';
import {standardMediaDirectory,highRateMediaDirectory} from '../src/system-media.mjs';
const hashes={x64:'61a7f6dd5d9b012aceebc4180d9b429b17cd519764c92ea217acf3e63407ee0c',arm64:'3cd69363ea3dd7d12a7036d36f7be048c55496b96fa1f14382fef6ef0a318cd4'};
if(process.platform!=='win32'||!hashes[process.arch])throw Error('This preparation target supports Windows x64/ARM64');
const args=process.argv.slice(2),run=promisify(execFile),engines=path.join(getDataRoot(),'engines');
if(!args.length)await downloadStandard();
else if(args[0]==='--high-rate'&&(args.length===1||(args.length===3&&args[1]==='--source')))await buildHighRate(args[2]);
else throw Error('Usage: npm run prepare:media -- [--high-rate [--source <upstream Git checkout>]]');

async function downloadStandard(){
 const directory=path.join(engines,standardMediaDirectory);await mkdir(directory,{recursive:true});const file=path.join(directory,'media-bridge.exe');
 await run('gh',['release','download','v0.1.5','--repo','oneincase/media-bridge','--pattern','media-bridge-win32-'+process.arch+'.exe','--output',file+'.next','--clobber'],{windowsHide:true,timeout:90000,maxBuffer:65536});
 if(createHash('sha256').update(await readFile(file+'.next')).digest('hex')!==hashes[process.arch])throw Error('Media bridge SHA-256 mismatch; existing runtime was not replaced');
 const license=JSON.parse((await run('gh',['api','repos/oneincase/media-bridge/git/blobs/d60d301a36267c42675e4def7272e411cfd06986'],{windowsHide:true,timeout:15000,maxBuffer:65536})).stdout);
 await writeFile(path.join(directory,'LICENSE'),Buffer.from(license.content.replace(/\s/g,''),'base64'));
 await rename(file+'.next',file);
 console.log(JSON.stringify({prepared:true,version:'0.1.5',directory,sha256:hashes[process.arch]}));
}

async function buildHighRate(localSource){
 const commit='a508378f4e5e654c8de60e1076d559dca258e825';
 await mkdir(engines,{recursive:true});
 const staging=await mkdtemp(path.join(engines,'.media-high-rate-'));
 const options={cwd:staging,windowsHide:true,timeout:120000,maxBuffer:1024*1024};
 try{
  const source=localSource?path.resolve(localSource):staging;
  if(!localSource){
   await run('git',['init','--quiet'],options);
   await run('git',['fetch','--quiet','--depth=1','https://github.com/oneincase/media-bridge.git',commit],options);
  }
  const archive=path.join(staging,'source.tar'),workspace=path.join(staging,'source');
  await run('git',['-C',source,'archive','--output='+archive,commit],options);
  await mkdir(workspace);await run('tar',['-xf',archive,'-C',workspace],options);
  // Keep the standard helper intact. The high-rate helper uses a shorter
  // WASAPI polling interval and a native sleep below Tokio's standard cadence.
  const patches=[
   ['ipc/mod.rs','unwrap_or(100).clamp(16, 5000)','unwrap_or(100).clamp(8, 5000)'],
   ['ipc/stdio.rs','tokio::time::sleep(std::time::Duration::from_millis(ms)).await;',`let delay = std::time::Duration::from_millis(ms);
                        if cfg!(windows) && ms < 16 {
                            let _ = tokio::task::spawn_blocking(move || std::thread::sleep(delay)).await;
                        } else {
                            tokio::time::sleep(delay).await;
                        }`],
   ['audio/windows.rs','std::thread::sleep(POLL_INTERVAL);',`let interval = if shared.config.fps > 60 { Duration::from_millis(4) } else { POLL_INTERVAL };
        std::thread::sleep(interval);`]
  ];
  for(const [name,before,after] of patches){
   const file=path.join(workspace,'crates/media-bridge/src',name),original=await readFile(file,'utf8');
   if(original.split(before).length!==2)throw Error('Unexpected pinned media-bridge source: '+name);
   await writeFile(file,original.replace(before,after));
  }
  const target=process.arch==='arm64'?'aarch64-pc-windows-msvc':'x86_64-pc-windows-msvc';
  await run('cargo',['build','--release','--locked','--target',target,'-p','media-bridge','--no-default-features','--features','audio'],{...options,cwd:workspace,timeout:600000});
  const binary=path.join(workspace,'target',target,'release','media-bridge.exe');
  const directory=path.join(engines,highRateMediaDirectory);await mkdir(directory,{recursive:true});
  const sha256=createHash('sha256').update(await readFile(binary)).digest('hex');
  await writeFile(path.join(directory,'LICENSE'),await readFile(path.join(workspace,'LICENSE')));
  await rename(binary,path.join(directory,'media-bridge.exe'));
  console.log(JSON.stringify({prepared:true,version:'0.1.5-high-rate',commit,directory,sha256}));
 }catch(error){throw Error('High-rate media component preparation failed. Install Rust and the C++ Build Tools for the Windows MSVC target. '+(error.stderr||error.message));}
 finally{
  const [actualStaging,actualEngines]=await Promise.all([realpath(staging),realpath(engines)]);
  if(path.dirname(actualStaging)===actualEngines&&path.basename(actualStaging).startsWith('.media-high-rate-'))await rm(actualStaging,{recursive:true,force:true,maxRetries:2});
 }
}
