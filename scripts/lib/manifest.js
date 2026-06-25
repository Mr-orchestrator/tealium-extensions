'use strict';
/**
 * Parse the `@tealium-extension` JSDoc manifest header from an extension file.
 * The header is the single source of structured facts every agent reads — code is
 * never interpreted by the AI, only these declared fields.
 */
const fs = require('fs');

const SCOPE_ORDER = ['Pre Loader', 'Before Load Rules', 'After Load Rules', 'DOM Ready', 'After Tags'];

// fields that are comma-separated lists in the header
const LIST_FIELDS = new Set(['creates', 'uses']);
const INT_FIELDS = new Set(['id', 'order']);
const BOOL_FIELDS = new Set(['protected']);

/** Extract the first /** ... *​/ block and pull @tag values out of it. */
function parseManifest(source, file) {
  const block = (source.match(/\/\*\*([\s\S]*?)\*\//) || [])[1];
  if (!block || block.indexOf('@tealium-extension') === -1) {
    throw new Error(`${file}: missing @tealium-extension manifest header`);
  }
  const m = { file };
  // match lines like:  * @scope Before Load Rules
  const re = /@(\w+)[ \t]*([^\n@]*)/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    const key = match[1];
    if (key === 'tealium' || key === 'tealium-extension') continue;
    let val = match[2].replace(/\s*\*\s*$/, '').trim();
    if (key === 'description') { m.description = val; continue; }
    if (LIST_FIELDS.has(key)) {
      m[key] = val && val.toLowerCase() !== 'none'
        ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
    } else if (INT_FIELDS.has(key)) {
      m[key] = parseInt(val, 10);
    } else if (BOOL_FIELDS.has(key)) {
      m[key] = /^(true|yes|1)$/i.test(val);
    } else {
      m[key] = val;
    }
  }
  if (m.protected === undefined) m.protected = false;
  if (!m.creates) m.creates = [];
  if (!m.uses) m.uses = [];
  return m;
}

function readManifest(file) {
  return parseManifest(fs.readFileSync(file, 'utf8'), file);
}

/** Numeric rank so we can compare load order across scope + order. */
function loadRank(manifest) {
  const scopeIdx = SCOPE_ORDER.indexOf(manifest.scope);
  return scopeIdx * 1000 + (manifest.order || 0);
}

module.exports = { parseManifest, readManifest, loadRank, SCOPE_ORDER };
