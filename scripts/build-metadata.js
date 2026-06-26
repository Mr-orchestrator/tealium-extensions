'use strict';
/**
 * build-metadata.js — the LOCAL profile "parser".
 * Globs extensions/**, parses each manifest header, validates it against
 * schema/extension.schema.json, and writes the deterministic knowledge base under
 * metadata/. This is what every agent (validation/impact/doc) reads. When real
 * Tealium API creds exist, knowledge-agent.js reconciles this with the live profile.
 */
const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');
const Ajv = require('ajv');
const { readManifest, loadRank } = require('./lib/manifest');

const ROOT = path.resolve(__dirname, '..');
const META = path.join(ROOT, 'metadata');

function build() {
  const files = fg.sync('extensions/**/*.js', { cwd: ROOT }).sort();
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema/extension.schema.json'), 'utf8'));
  const validate = ajv.compile(schema);

  const extensions = [];
  const errors = [];

  for (const rel of files) {
    let m;
    try { m = readManifest(path.join(ROOT, rel)); }
    catch (e) { errors.push(e.message); continue; }
    m.file = rel.replace(/\\/g, '/');
    if (!validate(m)) {
      errors.push(`${rel}: ${ajv.errorsText(validate.errors)}`);
      continue;
    }
    m.loadRank = loadRank(m);
    extensions.push(m);
  }

  if (errors.length) {
    console.error('✗ Metadata build failed:\n  - ' + errors.join('\n  - '));
    process.exit(1);
  }

  extensions.sort((a, b) => a.loadRank - b.loadRank);

  // ── Variables knowledge base: where each var is created vs used ──────────────
  const variables = {};
  const ref = v => (variables[v] = variables[v] || { name: v, created_by: [], used_by: [], usedIn: { extensions: [], tags: [] } });
  for (const e of extensions) {
    const tag = { id: e.id, name: e.name, scope: e.scope, file: e.file };
    e.creates.forEach(v => ref(v).created_by.push(tag));
    e.uses.forEach(v => {
      const r = ref(v);
      r.used_by.push(Object.assign({ feedsTag: e.feedsTag || null }, tag));
      r.usedIn.extensions.push(e.id);
      if (e.feedsTag) r.usedIn.tags.push(e.feedsTag);
    });
  }
  Object.values(variables).forEach(v => { v.usedIn.tags = [...new Set(v.usedIn.tags)]; });

  // ── Load rules + tags rollups ────────────────────────────────────────────────
  const loadRules = {};
  extensions.forEach(e => {
    const lr = Array.isArray(e.loadRule) ? e.loadRule.join(',') : e.loadRule;
    (loadRules[lr] = loadRules[lr] || []).push(e.id);
  });
  const tags = {};
  extensions.filter(e => e.feedsTag).forEach(e => {
    (tags[e.feedsTag] = tags[e.feedsTag] || { name: e.feedsTag, category: e.tagCategory || 'Utility', fedBy: [] }).fedBy.push(e.id);
  });

  const profile = {
    source: 'local-manifest',
    counts: { extensions: extensions.length, variables: Object.keys(variables).length, tags: Object.keys(tags).length },
    extensions, variables, loadRules, tags
  };

  fs.mkdirSync(META, { recursive: true });
  write('extensions.json', extensions);
  write('variables.json', variables);
  write('loadRules.json', loadRules);
  write('tags.json', tags);
  write('profile.json', profile);

  console.log(`✓ Metadata built: ${extensions.length} extensions, ${Object.keys(variables).length} variables, ${Object.keys(tags).length} tags`);
  return profile;
}

function write(name, obj) {
  fs.writeFileSync(path.join(META, name), JSON.stringify(obj, null, 2) + '\n');
}

if (require.main === module) build();
module.exports = { build };
