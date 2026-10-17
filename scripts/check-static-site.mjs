// Dependency-free check of the deployed GitHub Pages entry point and its local assets.
// Run: node scripts/check-static-site.mjs
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(projectRoot, 'index.html');
const visited = new Set();
const errors = [];
let checkedJavaScript = 0;
let checkedStylesheets = 0;

function localAsset(source, candidate) {
  if (!candidate || /^(?:https?:|data:|blob:|\/\/|#)/i.test(candidate)) return null;
  const clean = candidate.split(/[?#]/, 1)[0].trim();
  if (!clean) return null;
  const absolute = resolve(clean.startsWith('/') ? projectRoot : dirname(source), clean.replace(/^\//, ''));
  const pathFromRoot = relative(projectRoot, absolute);
  if (pathFromRoot === '..' || pathFromRoot.startsWith('../') || pathFromRoot.startsWith('..\\')) {
    errors.push('Asset outside repository: ' + candidate + ' referenced by ' + relative(projectRoot, source));
    return null;
  }
  return absolute;
}

function checkFile(file, source) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    errors.push('Missing asset: ' + relative(projectRoot, file) + ' referenced by ' + relative(projectRoot, source));
    return;
  }
  if (visited.has(file)) return;
  visited.add(file);
  const text = readFileSync(file, 'utf8');
  if (extname(file) === '.js') {
    checkedJavaScript++;
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: text, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024
    });
    if (result.status !== 0 || result.error) {
      errors.push('Invalid JavaScript in ' + relative(projectRoot, file) + ': ' +
        (result.stderr || result.error?.message || 'syntax check failed').trim());
    }
    // Imports can carry URL cache versions, e.g. './phase4-pos.js?v=20261017'.
    for (const regex of [
      /\bfrom\s*(['"])(\.{1,2}\/[^'"]+)\1/g,
      /\bimport\s*\(\s*(['"])(\.{1,2}\/[^'"]+)\1/g,
      /\bimport\s*(['"])(\.{1,2}\/[^'"]+)\1/g
    ]) {
      for (const match of text.matchAll(regex)) {
        const asset = localAsset(file, match[2]);
        if (asset) checkFile(asset, file);
      }
    }
  }
  if (extname(file) === '.css') {
    checkedStylesheets++;
    for (const match of text.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g)) {
      const asset = localAsset(file, match[1]);
      if (asset) checkFile(asset, file);
    }
  }
}

if (!existsSync(entry)) throw new Error('Missing GitHub Pages index.html');
const html = readFileSync(entry, 'utf8');
const scripts = [];
for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
  const tag = match[0];
  const attr = tag.match(/\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/i);
  if (!attr || !/\.(?:js|css)(?:[?#]|$)/i.test(attr[1])) continue;
  const asset = localAsset(entry, attr[1]);
  if (asset) {
    if (match[1].toLowerCase() === 'script') scripts.push(relative(projectRoot, asset));
    checkFile(asset, entry);
  }
}
if (!scripts.includes('app-pos-upgrade.js')) errors.push('Active POS entry point is not included in index.html');
if (scripts.some(path => /^app(?:-receipt-v\d+)?\.js$/.test(path))) {
  errors.push('index.html must not load a legacy POS entry point alongside app-pos-upgrade.js');
}

if (errors.length) {
  console.error('Static site verification failed:\n' + errors.map(x => '  - ' + x).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Static site verification passed: ' + checkedJavaScript +
    ' active JS modules and ' + checkedStylesheets + ' stylesheets; all local asset paths exist.');
  console.log('Note: live Supabase checkout, permissions, and browser behavior still need manual testing.');
}
