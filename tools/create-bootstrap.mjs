import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function createBootstrap({archive,output,version}){
 if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))throw Error('Invalid release version');
 if(path.basename(archive)!==`CodexWallpaperBridge-${version}.zip`)throw Error('Archive filename must match the release version');
 const bytes=await readFile(archive);
 if(bytes.length<4||!bytes.subarray(0,4).equals(Buffer.from([80,75,3,4])))throw Error('Expected a ZIP archive');
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const template=await readFile(new URL('./install-bootstrap.ps1',import.meta.url),'utf8');
 const rendered=template.replaceAll('__CWB_VERSION__',version).replaceAll('__CWB_ARCHIVE_SHA256__',sha256);
 if(/__CWB_/.test(rendered))throw Error('Unresolved bootstrap placeholder');
 await writeFile(output,rendered,{flag:'wx'});
 const bootstrapSha256=createHash('sha256').update(rendered).digest('hex');
 await writeFile(output+'.sha256',bootstrapSha256+'  '+path.basename(output)+'\n',{flag:'wx'});
 return {version,archiveSha256:sha256,bootstrapSha256};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const argument=name=>{const index=process.argv.indexOf(name);if(index<0||!process.argv[index+1])throw Error('Required: '+name);return process.argv[index+1]};
 const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 console.log(JSON.stringify(await createBootstrap({archive:argument('--archive'),output:argument('--output'),version})));
}
