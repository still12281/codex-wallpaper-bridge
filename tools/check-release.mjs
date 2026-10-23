import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {repoRoot,releaseFiles,manifestEntries,canonical,digest} from './release-files.mjs';
const issues=[];
const manifest=JSON.parse(await readFile(path.join(repoRoot,'release-manifest.json'),'utf8'));
const expected=new Map(manifest.files.map(f=>[f.path,f]));
const actual=await releaseFiles();
const denied=/(?:^|\/)(?:media|staging|backups|runtime|\.local|codex-cdp-profile|test-runtime|test-catalog)(?:\/|$)|(?:\.exe|\.dll|\.lnk|\.ico|\.zip|\.png|\.jpe?g|\.webp|\.gif|\.mp4|\.webm|\.log)$/i;
for(const file of actual){
 if(file==='release-manifest.json')continue;
 if(denied.test(file)||/^(?:settings|settings.next)\.json$/i.test(path.basename(file)))issues.push({file,issue:'runtime data, media or binary file'});
 if(!expected.has(file))issues.push({file,issue:'not present in reviewed release allowlist'});
 const text=canonical(await readFile(path.join(repoRoot,file)));
 if(/\b[A-Z]:[\\/]Users[\\/][^\s/\\"'<>]+/i.test(text))issues.push({file,issue:'literal user profile path'});
 if(/\b(?:sk-(?:proj-)?[a-z0-9_-]{20,}|gh[pousr]_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,})\b/i.test(text))issues.push({file,issue:'credential-like token'});
 const emails=text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig)||[];
 if(emails.length&&file!=='vendor/webwallgl/LICENSE')issues.push({file,issue:'email address outside original third-party license'});
 if(file.startsWith('src/')&&text.includes('Page.captureScreenshot'))issues.push({file,issue:'automatic capture API in runtime'});
 const record=expected.get(file);if(record&&(record.sha256!==digest(text)||record.utf8Bytes!==Buffer.byteLength(text)))issues.push({file,issue:'reviewed checksum changed'});
}
for(const file of expected.keys())if(!actual.includes(file))issues.push({file,issue:'reviewed file missing'});
const upstream=JSON.parse(await readFile(path.join(repoRoot,'docs/UPSTREAM-SOURCES.json'),'utf8'));
for(const item of upstream.files){const text=canonical(await readFile(path.join(repoRoot,item.vendoredPath)));if(digest(text)!==item.canonicalSha256)issues.push({file:item.vendoredPath,issue:'third-party source changed'})}
console.log(JSON.stringify({passed:issues.length===0,filesChecked:actual.length,allowlistEntries:expected.size,issues},null,2));if(issues.length)process.exitCode=1;
