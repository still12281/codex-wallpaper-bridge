// Local, explicit maintenance. Backups contain private paths and media; never publish them.
import {readFile,writeFile,mkdir,realpath,stat,readdir,copyFile,rename} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {describeProject} from '../src/realtime-source.mjs';
import {hashMedia} from '../src/library-preview.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const absolute=p=>{if(!p||!path.isAbsolute(p))throw Error('Provide explicit absolute directories.');return path.resolve(p);};
const inside=(root,file)=>{const relative=path.relative(root,file);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);};
const owned=relative=>/^(media|staging)\/[A-Za-z0-9._/-]+$/.test(relative)&&!relative.split('/').includes('..');
async function emptyDestination(directory){try{if((await readdir(directory)).length)throw Error('Destination must be empty; existing data will not be overwritten.');}catch(e){if(e.code!=='ENOENT')throw e;}await mkdir(directory,{recursive:true});}
async function configAt(root){const bytes=await readFile(path.join(root,'settings.json'));const settings=JSON.parse(bytes.toString('utf8'));if(!Array.isArray(settings.library)||settings.library.length>3000)throw Error('Invalid wallpaper library.');return {bytes,settings};}
async function canonicalFile(root,relative){const candidate=await realpath(path.resolve(root,relative));if(!inside(root,candidate))throw Error('File escapes its directory: '+relative);return candidate;}
async function copyExclusive(from,to){await mkdir(path.dirname(to),{recursive:true});await copyFile(from,to,constants.COPYFILE_EXCL);}
async function backup(dataRoot,destination){
 dataRoot=await realpath(absolute(dataRoot));destination=absolute(destination);if(destination===dataRoot||inside(dataRoot,destination))throw Error('Backup must be outside the data directory.');
 const original=await configAt(dataRoot),settings=structuredClone(original.settings),files=new Map();
 for(const entry of settings.library)for(const holder of [entry,entry.customDisplay].filter(Boolean))for(const key of ['file','sourceFile','sourcePath','staticFile']){const value=holder[key];if(!value)continue;let resolved=path.resolve(dataRoot,value);try{resolved=await realpath(resolved);}catch(error){if(error.code!=='ENOENT'||!path.isAbsolute(value)||inside(dataRoot,resolved))throw error;}if(!inside(dataRoot,resolved)){if(!path.isAbsolute(value))throw Error('Invalid relative media reference.');continue;}const relative=path.relative(dataRoot,resolved).replaceAll('\\','/');if(!owned(relative))throw Error('Unsupported owned asset reference: '+relative);files.set(relative,await canonicalFile(dataRoot,relative));holder[key]=relative;}
 await emptyDestination(destination);const records=[];
 for(const [relative,source]of files){const info=await stat(source),sha256=await hashMedia(source),target=path.join(destination,relative);await copyExclusive(source,target);const after=await stat(source);if(after.size!==info.size||after.mtimeMs!==info.mtimeMs||after.ctimeMs!==info.ctimeMs||(await stat(target)).size!==info.size||await hashMedia(target)!==sha256)throw Error('Asset changed during backup: '+relative);records.push({path:relative,bytes:info.size,sha256});}
 if(hash((await configAt(dataRoot)).bytes)!==hash(original.bytes))throw Error('Settings changed during backup; this partial snapshot is not accepted. Retry into a new directory.');
 const bytes=Buffer.from(JSON.stringify(settings,null,2)+'\n');await writeFile(path.join(destination,'settings.json'),bytes,{flag:'wx'});records.push({path:'settings.json',bytes:bytes.length,sha256:hash(bytes)});
 await writeFile(path.join(destination,'backup-manifest.json'),JSON.stringify({format:'codex-wallpaper-backup',version:1,createdAt:new Date().toISOString(),externalProjects:'references-only',files:records},null,2),{flag:'wx'});
 return {backup:destination,files:records.length,externalProjects:'references-only'};
}
async function restore(snapshot,destination){
 snapshot=await realpath(absolute(snapshot));destination=absolute(destination);if(destination===snapshot||inside(snapshot,destination))throw Error('Restore must use a separate empty directory.');
 const manifest=JSON.parse(await readFile(path.join(snapshot,'backup-manifest.json'),'utf8'));if(manifest.format!=='codex-wallpaper-backup'||manifest.version!==1||!Array.isArray(manifest.files)||manifest.files.length>12001)throw Error('Unsupported backup.');
 const seen=new Set(),verified=[];
 for(const row of manifest.files){if(typeof row.path!=='string'||(row.path!=='settings.json'&&!owned(row.path))||seen.has(row.path))throw Error('Invalid or duplicate backup path.');seen.add(row.path);const source=await canonicalFile(snapshot,row.path);if((await stat(source)).size!==row.bytes||await hashMedia(source)!==row.sha256)throw Error('Backup checksum mismatch: '+row.path);verified.push({path:row.path,source});}
 if(!seen.has('settings.json'))throw Error('Backup has no settings.');const {settings}=await configAt(snapshot);
 for(const entry of settings.library)for(const holder of [entry,entry.customDisplay].filter(Boolean))for(const key of ['file','sourceFile','sourcePath','staticFile']){const value=holder[key];if(value&&!path.isAbsolute(value)&&!seen.has(value.replaceAll('\\','/')))throw Error('Backup omits referenced asset: '+value);}
 await emptyDestination(destination);for(const row of verified.filter(f=>f.path!=='settings.json')){const target=path.join(destination,row.path);await copyExclusive(row.source,target);if(await hashMedia(target)!==manifest.files.find(f=>f.path===row.path).sha256)throw Error('Asset changed during restore: '+row.path);}await copyExclusive(path.join(snapshot,'settings.json'),path.join(destination,'settings.json'));
 return {restored:destination,files:verified.length,activation:'Set CODEX_WALLPAPER_DATA_DIR and rebuild the launcher; current session was not changed.'};
}
async function diagnose(dataRoot){
 dataRoot=await realpath(absolute(dataRoot));const {settings}=await configAt(dataRoot),missing=[];
 for(const entry of settings.library)for(const holder of [entry,entry.customDisplay].filter(Boolean))for(const key of ['file','sourceFile','sourcePath','staticFile','projectRoot'])if(holder[key]){try{await stat(path.resolve(dataRoot,holder[key]));}catch(e){if(e.code!=='ENOENT')throw e;missing.push({id:entry.id,field:(holder===entry?'':'customDisplay.')+key,path:holder[key]});}}
 return {libraryCount:settings.library.length,selectedId:settings.selectedId,missing};
}
async function relocate(dataRoot,id,newRoot){
 dataRoot=await realpath(absolute(dataRoot));try{const runtime=JSON.parse(await readFile(path.join(dataRoot,'runtime-status.json'),'utf8'));if(Date.now()-Date.parse(runtime.updatedAt)<30000&&runtime.phase!=='stopped')throw Error('Stop the wallpaper host before changing references; do not close Codex.');}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;}
 const {settings}=await configAt(dataRoot),entry=settings.library.find(e=>e.id===id);if(!entry||!['realtime','webwallgl'].includes(entry.mode))throw Error('Select a saved native/WebGL project entry.');
 const project=await describeProject(absolute(newRoot));if(!['scene','web'].includes(project.type)||(entry.mode==='webwallgl'&&project.type!=='scene'))throw Error('Project type does not match this renderer.');
 entry.projectRoot=project.root;entry.sourceKey=project.sourceKey;entry.workshopId=project.workshopId;const file=path.join(dataRoot,'settings.json'),saved=file+'.before-relocate-'+randomUUID();await copyExclusive(file,saved);const temporary=file+'.maintenance-next';await writeFile(temporary,JSON.stringify(settings,null,2),{flag:'wx'});await rename(temporary,file);return {relocated:id,previousSettings:saved};
}
try{const [command,source,destination,newRoot]=process.argv.slice(2);let result;if(command==='backup')result=await backup(source,destination);else if(command==='restore')result=await restore(source,destination);else if(command==='diagnose')result=await diagnose(source);else if(command==='relocate')result=await relocate(source,destination,newRoot);else throw Error('Usage: library-maintenance.mjs backup <data-dir> <new-backup-dir> | restore <backup-dir> <empty-data-dir> | diagnose <data-dir> | relocate <offline-data-dir> <entry-id> <new-project-dir>');console.log(JSON.stringify(result,null,2));}catch(error){console.error(error.message);process.exitCode=1;}
