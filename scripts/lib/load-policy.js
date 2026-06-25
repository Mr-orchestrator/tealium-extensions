'use strict';
/** Load the YAML policy engine + the generated metadata knowledge base. */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');

function loadYaml(rel) {
  return yaml.load(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function loadJson(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

function loadPolicy() {
  return {
    protected: loadYaml('policy/protected.yaml'),
    consent: loadYaml('policy/consent-rules.yaml'),
    loadOrder: loadYaml('policy/load-order-rules.yaml'),
    risk: loadYaml('policy/risk-score.yaml')
  };
}

function loadMetadata() {
  const profile = loadJson('metadata/profile.json');
  if (!profile) {
    throw new Error('metadata/profile.json not found — run `npm run build:metadata` first.');
  }
  return profile;
}

module.exports = { loadPolicy, loadMetadata, ROOT };
