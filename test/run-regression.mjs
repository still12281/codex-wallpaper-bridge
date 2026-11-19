import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {getPowerShell} from '../src/runtime-paths.mjs';

const cwd=path.resolve(import.meta.dirname,'..');
const unitFiles=(await readdir(import.meta.dirname)).filter(file=>file.endsWith('.test.mjs')).sort();
const tests={
 unit:[['node','--test','--test-concurrency=1',...unitFiles.map(file=>'test/'+file)],['node','tools/check-release.mjs']],
 ui:['panel-entry','panel-controls','automatic-surfaces','theme-contrast','code-reading','style-invalidation'].map(integration),
 render:['integration.mjs','import-host-integration.mjs','lifetime-integration.mjs','rotation-host-integration.mjs',
  'resource-cache-integration.mjs','webwallgl-integration.mjs','browser-web-integration.mjs'].map(file=>['node','test/'+file]),
 startup:[...['startup-priority','startup-transition'].map(integration),
  ...['clean-process','client-window','client-window-binding','launch-policy','process-snapshot','root-revalidation',
   'tcp-listeners','startup-support','host-handoff','cdp-endpoint','startup-shutdown','startup-health',
   'login-startup','entry-queue','entry-window-dispatch'].map(powershell)],
 install:['install-options','install-upgrade','install-dependencies','uninstall-shortcuts','update-reconnect',
  'update-runner','bridge-update-runner','remote-bootstrap','install-runtime'].map(powershell),
 audio:[['node','test/system-audio-integration.mjs']],
 recovery:[['node','--test','test/media-power.test.mjs','test/system-media.test.mjs'],
  ...['lifetime','webwallgl','panel-controls'].map(integration),powershell('entry-window-dispatch')],
 desktop:[['node','test/foreground-interaction.mjs']]
};
function integration(name){return ['node','test/'+name+'-integration.mjs'];}
function powershell(name){return ['pwsh','test/'+name+'.ps1'];}
const groups=process.argv.slice(2);
const offline=['unit','ui','render','startup','install'];
if(groups.includes('--list')){
 for(const [group,cases]of Object.entries(tests))console.log(group+': '+cases.map(args=>args[1]).join(', '));
 process.exit(0);
}
const selected=[...new Set((groups.length?groups:['unit']).flatMap(group=>group==='offline'?offline:[group]))];
if(selected.some(group=>!Object.hasOwn(tests,group)))throw Error('Use --list for available regression groups.');
const work=process.env.CODEX_WALLPAPER_TEST_WORK||os.tmpdir();
await mkdir(work,{recursive:true});
const scratch=await mkdtemp(path.join(work,'cwb-regression-'));
const results=[];
for(const group of selected){
 for(const [kind,...args]of tests[group]){
  const id=args[0]==='--test'?(group==='unit'?'unit tests':'media recovery unit tests'):args[0];
  console.log('\n['+group+'] '+id);
  const started=performance.now();
  if(id==='test/install-runtime.ps1')args.push('-ScratchDirectory',path.join(scratch,'runtime'));
  if(id==='test/foreground-interaction.mjs')args.push(path.join(scratch,'foreground.json'));
  const command=kind==='node'?process.execPath:getPowerShell();
  const commandArgs=kind==='node'?args:['-NoProfile','-ExecutionPolicy','Bypass','-File',...args];
  const child=spawn(command,commandArgs,{cwd,stdio:'inherit',windowsHide:true});
  const timer=setTimeout(()=>child.kill(),180000);
  const execution=await new Promise(resolve=>{
   child.once('error',error=>resolve({code:null,error:error.message}));
   child.once('close',(code,signal)=>resolve({code,signal}));
  });
  clearTimeout(timer);
  results.push({group,id,...execution,seconds:Number(((performance.now()-started)/1000).toFixed(2))});
 }
}
const report=path.join(scratch,'results.json');
await writeFile(report,JSON.stringify(results,null,2)+'\n');
const failures=results.filter(run=>run.code!==0);
console.log(JSON.stringify({passed:results.length-failures.length,failed:failures.length,report}));
if(failures.length)process.exitCode=1;
