import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {repoRoot,manifestEntries} from './release-files.mjs';
if(!process.argv.includes('--write'))throw Error('Use --write only after reviewing intended release files.');
const files=await manifestEntries();await writeFile(path.join(repoRoot,'release-manifest.json'),JSON.stringify({schemaVersion:1,hashFormat:'sha256 of UTF-8 text normalized to LF, no BOM',files},null,2)+'\n');console.log(JSON.stringify({manifestWritten:true,files:files.length}));
