// Optional synthetic integration. Never connects to an existing Codex session.
import {mkdtemp,mkdir,writeFile,readFile,readdir,access,stat} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:net';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {connectCdp} from '../src/cdp-client.mjs';
import {findFFmpeg,findCommand} from '../src/runtime-paths.mjs';

const run=promisify(execFile),repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(path.join(os.tmpdir(),'cwb-integration-'));
const fixtures=path.join(temp,'fixtures'),data=path.join(temp,'data');await mkdir(fixtures);await mkdir(data);
let browser,host,cdp;let hostErrors='';
const result={kind:'isolated-synthetic-chromium-not-native-codex'};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){try{const value=await fn();if(value)return value}catch{}await pause(100)}throw Error('Synthetic integration condition timed out')}
async function ui(code){return cdp.evaluate(`(()=>{const s=document.getElementById('codex-wallpaper-controls')?.shadowRoot;${code}})()`)}
async function idle(){return waitFor(async()=>await ui('return !!s&&!s.querySelector("#import").disabled'))}
async function chooseFile(file){const root=await cdp.call('DOM.getDocument',{depth:0,pierce:true});const panel=await cdp.call('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#codex-wallpaper-controls'});const described=await cdp.call('DOM.describeNode',{nodeId:panel.nodeId,depth:1,pierce:true});const input=await cdp.call('DOM.querySelector',{nodeId:described.node.shadowRoots[0].nodeId,selector:'#file'});await cdp.call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});await idle()}
try{
 const ffmpeg=await findFFmpeg();const movie=path.join(fixtures,'synthetic.mp4');
 await run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-f','lavfi','-i','testsrc2=size=64x64:rate=24','-t','1','-an','-c:v','libx264','-threads','2','-pix_fmt','yuv420p',movie],{windowsHide:true});
 const html=path.join(temp,'shell.html');await writeFile(html,'<!doctype html><html><head><title>Synthetic wallpaper test</title></head><body><div id="root" data-app-shell-page-surface><aside class="app-shell-left-panel">Synthetic sidebar</aside><main data-app-shell-main-surface>Generated test content only</main></div></body></html>');const url=pathToFileURL(html).href;
 let chrome=process.env.CODEX_WALLPAPER_TEST_CHROME||findCommand('chrome');
 if(!chrome){for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean)){const candidate=path.join(base,'Google','Chrome','Application','chrome.exe');try{await access(candidate);chrome=candidate;break}catch{}}}
 if(!chrome)throw Error('Chrome/Chromium not found. Set CODEX_WALLPAPER_TEST_CHROME.');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(temp,'browser-profile'),url],{windowsHide:true,stdio:'ignore'});
 const endpoint='http://127.0.0.1:'+port;const target=await waitFor(async()=>{const pages=await(await fetch(endpoint+'/json/list')).json();return pages.find(t=>t.url===url)});cdp=await connectCdp(target.webSocketDebuggerUrl);
 host=spawn(process.execPath,[path.join(repo,'src','video-cdp-host.mjs'),'--cdp-port',String(port),'--test-url',url],{env:{...process.env,CODEX_WALLPAPER_DATA_DIR:data},windowsHide:true,stdio:['ignore','ignore','pipe']});host.stderr.on('data',b=>hostErrors=(hostErrors+b).slice(-3000));
 await waitFor(()=>ui('return !!s?.querySelector("#toggle")'));assert.equal(await ui('return s.querySelector("#engine-kind").value'),'engine');assert.equal(await ui('return s.querySelector("#engine-scope").value'),'global');result.emptyStart=true;
 await ui('s.querySelector("#toggle").click();return true');await chooseFile(movie);assert(await cdp.evaluate('window.__codexWallpaperBridge.ready'));assert.equal(await cdp.evaluate('window.__codexWallpaperBridge.mime'),'video/mp4');result.videoImport=true;
 await ui('s.querySelector("#fps").value="12";s.querySelector("#resolution").value="960";s.querySelector("#apply").click();return true');await idle();let settings=JSON.parse(await readFile(path.join(data,'settings.json'),'utf8')),entry=settings.library[0];assert.equal(entry.limits.fps,12);const stable=entry.file;result.hotApply=true;
 const ffprobe=findCommand('ffprobe')||path.join(path.dirname(ffmpeg),'ffprobe.exe');const probe=JSON.parse((await run(ffprobe,['-v','error','-select_streams','v:0','-show_entries','stream=width,height,avg_frame_rate','-of','json',path.join(data,stable)],{windowsHide:true})).stdout);assert.equal(probe.streams[0].avg_frame_rate,'12/1');assert.equal(probe.streams[0].width,64);result.actualFps=12;
 const mtime=(await stat(path.join(data,stable))).mtimeMs;await ui('s.querySelector("#apply").click();return true');await idle();assert.equal((await stat(path.join(data,stable))).mtimeMs,mtime);assert((await readdir(path.join(data,'media'))).filter(f=>f.startsWith('wallpaper-')).length===1);assert(!(await readdir(path.join(data,'media'))).some(f=>f.startsWith('pending-')));result.noExtraPlaybackCopies=true;
 await ui(`s.querySelector('#engine-picker').hidden=false;s.querySelector('#engine-kind').value='media';s.querySelector('#engine-kind').dispatchEvent(new Event('change'));s.querySelector('#engine-folder').value=${JSON.stringify(fixtures)};s.querySelector('#engine-scan').click();return true`);await idle();assert.equal(await ui('return s.querySelector("#engine-library").options.length'),1);await ui('s.querySelector("#engine-import").click();return true');await idle();settings=JSON.parse(await readFile(path.join(data,'settings.json'),'utf8'));assert.equal(settings.library.length,2);result.syntheticFolderImport=true;
 while((await ui('return s.querySelector("#library").options.length'))>0){await ui('s.querySelector("#delete").click();return true');await idle()}await stat(movie);assert(await cdp.evaluate('window.__codexWallpaperBridge.disabled'));result.externalSourceRetained=true;
 await cdp.call('Page.reload');await waitFor(()=>ui('return !!s?.querySelector("#toggle")'));await ui('s.querySelector("#toggle").click();return true');await chooseFile(movie);assert(await cdp.evaluate('window.__codexWallpaperBridge.ready'));result.reloadBindingRestored=true;assert.equal(hostErrors,'');result.passed=true;
}catch(error){result.error=error.message;process.exitCode=1}finally{host?.kill();if(cdp){await cdp.call('Browser.close').catch(()=>{});cdp.close()}browser?.kill();console.log(JSON.stringify(result,null,2))}
