import {mkdir,readFile,writeFile,readdir,access} from 'node:fs/promises';
import {accessSync,constants} from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function getDataRoot(){
 const configured=process.env.CODEX_WALLPAPER_DATA_DIR;
 if(configured&&!path.isAbsolute(configured))throw Error('CODEX_WALLPAPER_DATA_DIR must be absolute');
 return path.resolve(configured||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'CodexWallpaperBridge'));
}
export function findCommand(command){
 const names=process.platform==='win32'&&!path.extname(command)?[command+'.exe',command]:[command];
 for(const directory of (process.env.PATH||'').split(path.delimiter).filter(Boolean))for(const name of names){const file=path.join(directory.replace(/^"|"$/g,''),name);try{accessSync(file,constants.X_OK);return file}catch{}}
 return null;
}
export function getPowerShell(){
 return process.env.CODEX_WALLPAPER_PWSH||findCommand('pwsh')||path.join(process.env.ProgramFiles||'C:/Program Files','PowerShell','7','pwsh.exe');
}
export async function findFFmpeg(){
 if(process.env.CODEX_WALLPAPER_FFMPEG){await access(process.env.CODEX_WALLPAPER_FFMPEG);return process.env.CODEX_WALLPAPER_FFMPEG}
 const fromPath=findCommand('ffmpeg');if(fromPath)return fromPath;
 if(process.env.LOCALAPPDATA){const packages=path.join(process.env.LOCALAPPDATA,'Microsoft','WinGet','Packages');try{for(const entry of await readdir(packages,{withFileTypes:true})){if(!entry.isDirectory()||!entry.name.startsWith('Gyan.FFmpeg.'))continue;const root=path.join(packages,entry.name);for(const child of await readdir(root,{withFileTypes:true})){if(!child.isDirectory())continue;const candidate=path.join(root,child.name,'bin','ffmpeg.exe');try{await access(candidate);return candidate}catch{}}}}catch{}}
 throw Error('FFmpeg not found. Add it to PATH or set CODEX_WALLPAPER_FFMPEG.');
}
export function defaultSettings(){return {schemaVersion:1,library:[],selectedId:null,lightOverlay:.4,darkOverlay:.4,composerOverlay:.25,pauseOnBlur:true,palette:{r:20,g:22,b:28,dark:true},playback:{maxWidth:1280,fps:24},engineSearch:{scope:'global',kind:'engine',folder:''},surfaceSync:{composer:true,context:true,menus:false,settings:true,wallpaperPanel:true,navigation:true,panels:true,embedded:true}}}
export async function loadSettings(root=getDataRoot()){
 await mkdir(path.join(root,'media'),{recursive:true});await mkdir(path.join(root,'staging'),{recursive:true});
 try{return JSON.parse(await readFile(path.join(root,'settings.json'),'utf8'))}catch(error){if(error.code!=='ENOENT')throw error;const settings=defaultSettings();await writeFile(path.join(root,'settings.json'),JSON.stringify(settings,null,2),{flag:'wx'});return settings}
}
