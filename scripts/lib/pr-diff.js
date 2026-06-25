'use strict';
/**
 * Determine which extension files a PR touched. In CI we diff against the base ref;
 * locally you can pass --changed <file> [<file>...]. Falls back to "all extensions".
 */
const { execSync } = require('child_process');
const path = require('path');
const { ROOT } = require('./load-policy');

function fromArgs(argv) {
  const i = argv.indexOf('--changed');
  if (i === -1) return null;
  const files = [];
  for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) files.push(argv[j]);
  return files.length ? files : null;
}

function fromGit(base) {
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD`, { cwd: ROOT, encoding: 'utf8' });
    return out.split('\n').map(s => s.trim()).filter(Boolean);
  } catch (e) {
    return null;
  }
}

/** Returns array of changed extension file paths (relative, forward slashes). */
function changedExtensionFiles(argv) {
  const base = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'HEAD~1';
  let files = fromArgs(argv) || fromGit(base) || [];
  files = files
    .map(f => path.relative(ROOT, path.resolve(ROOT, f)).replace(/\\/g, '/'))
    .filter(f => f.startsWith('extensions/') && f.endsWith('.js'));
  return [...new Set(files)];
}

module.exports = { changedExtensionFiles };
