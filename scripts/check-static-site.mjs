// Dependency-free check of the deployed GitHub Pages entry point and its local assets.
// Run: node scripts/check-static-site.mjs
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

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
// Check embedded bootstrap scripts too; external module parsing alone misses errors here.
let checkedInlineScripts = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
  checkedInlineScripts++;
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: match[2], encoding: 'utf8', maxBuffer: 2 * 1024 * 1024
  });
  if (result.status !== 0 || result.error) {
    errors.push('Invalid embedded JavaScript block #' + checkedInlineScripts + ': ' +
      (result.stderr || result.error?.message || 'syntax check failed').trim());
  }
}
// Repeated element IDs break getElementById and accessibility label targets.
const usedIds = new Set();
for (const match of html.matchAll(/\bid=["']([^"']+)["']/gi)) {
  if (usedIds.has(match[1])) errors.push('Duplicate element ID in index.html: ' + match[1]);
  usedIds.add(match[1]);
}
// Catch typos such as ?v=revision?v=another-revision that defeat asset caching.
for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
  const url = match[1];
  if (/\.(?:js|css)\?[^"']*\?/.test(url)) {
    errors.push('Repeated query separator in asset URL: ' + url);
  }
}
if (!orderedUiStyles(html)) errors.push('ui-polish.css must load after other runtime stylesheets');
function orderedUiStyles(markup) {
  const styles = [...markup.matchAll(/<link\b[^>]*href=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi)]
    .map(match => match[1].split('?', 1)[0]);
  return styles.at(-1) === 'ui-polish.css';
}

if (!scripts.includes('app-pos-upgrade.js')) errors.push('Active POS entry point is not included in index.html');
if (scripts.some(path => /^app(?:-receipt-v\d+)?\.js$/.test(path))) {
  errors.push('index.html must not load a legacy POS entry point alongside app-pos-upgrade.js');
}


// The original monolithic theme stylesheet was split without editing rules.
// Verify the concatenated bytes still equal its original Git blob and that the
// four stylesheets load next to each other in original cascade order.
const themeFiles = [
  'styles/theme/theme-foundation.css',
  'styles/theme/theme-header.css',
  'styles/theme/theme-effects.css',
  'styles/theme/theme-features.css'
];
const orderedStyles = [...html.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
  .map(match => match[1].split('?', 1)[0]);
const firstThemeIndex = orderedStyles.indexOf(themeFiles[0]);
if (firstThemeIndex < 0 ||
  themeFiles.some((file, index) => orderedStyles[firstThemeIndex + index] !== file)) {
  errors.push('Theme stylesheets must load consecutively in their original cascade order');
}
if (orderedStyles.includes('themes-global.css')) {
  errors.push('The legacy monolithic theme CSS must not also load');
}
if (process.argv.includes('--verify-original-theme') && themeFiles.every(file => existsSync(resolve(projectRoot, file)))) {
  const original = Buffer.concat(themeFiles.map(file => readFileSync(resolve(projectRoot, file))));
  const blobHash = createHash('sha1')
    .update('blob ' + original.length)
    .update(Buffer.from([0]))
    .update(original)
    .digest('hex');
  if (blobHash !== 'cdb271771d6e3f12ccc8c52572a41bbcce7f0e36') {
    errors.push('Theme CSS no longer matches the exact original styles, possibly changing appearance');
  }
}

if (errors.length) {
  console.error('Static site verification failed:\n' + errors.map(x => '  - ' + x).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Static site verification passed: ' + checkedJavaScript +
    ' active JS modules and ' + checkedStylesheets + ' stylesheets; all local asset paths exist.');
  console.log('Checked ' + checkedInlineScripts + ' inline bootstrap scripts and ' + usedIds.size + ' unique element IDs.');
  console.log('Note: live Supabase checkout, permissions, and browser behavior still need manual testing.');
}
