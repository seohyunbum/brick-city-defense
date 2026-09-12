// Only approved runtime files enter the public distribution; development files stay outside.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const out = join(root, '_site');
if (resolve(out) !== join(root, '_site') || (existsSync(out) && lstatSync(out).isSymbolicLink())) {
  throw new Error('Unsafe public distribution directory');
}
const files = ["index.html", "manifest.webmanifest", "THIRD_PARTY_NOTICES.md"];
const dirs = ["src", "vendor", "assets/icons"];
if (existsSync(join(root, 'assets/external'))) dirs.push('assets/external');
for (const relative of [...files, ...dirs]) {
  const source = join(root, relative);
  if (!existsSync(source) || lstatSync(source).isSymbolicLink()) {
    throw new Error('Missing or linked runtime entry: ' + relative);
  }
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const relative of [...files, ...dirs]) {
  const dest = join(out, relative);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(root, relative), dest, { recursive: true, dereference: false });
}
const commit = process.env.SOURCE_COMMIT ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('Source commit must be a full Git SHA');
writeFileSync(join(out, 'build-info.json'), JSON.stringify({ commit, built_at: new Date().toISOString() }) + String.fromCharCode(10));
writeFileSync(join(out, '.nojekyll'), '');
console.log('Public runtime assembled: ' + out);

execFileSync(process.execPath, [join(root, 'scripts/hbsy-release.mjs'), 'seal'], { cwd: root, stdio: 'inherit' });
