'use strict';
/**
 * Validation Agent — enforces the YAML policy engine against the metadata knowledge
 * base. Deterministic checks only (no LLM): load-order, consent gating, protected
 * components, unique scope/order. Exit 1 on any violation so CI fails the PR.
 *
 * Usage: node scripts/validation-agent.js   (reads metadata/profile.json)
 */
const { loadPolicy, loadMetadata } = require('./lib/load-policy');

/** Pure policy check — returns an array of {id, msg} violations (no I/O, testable). */
function validate(policy, profile) {
  const exts = profile.extensions;
  const vars = profile.variables;
  const violations = [];
  const fail = (id, msg) => violations.push({ id, msg });

  const byRank = [...exts].sort((a, b) => a.loadRank - b.loadRank);
  const creatorRank = {}; // variable -> earliest loadRank that creates it
  exts.forEach(e => e.creates.forEach(v => {
    if (creatorRank[v] === undefined || e.loadRank < creatorRank[v]) creatorRank[v] = e.loadRank;
  }));

  // ── ORDER-001: no backward dependency ──────────────────────────────────────
  // Ignore externally-provided inputs (not created by any extension), e.g. gridbox_data, tealium_event.
  exts.forEach(e => e.uses.forEach(v => {
    if (creatorRank[v] !== undefined && creatorRank[v] > e.loadRank) {
      const producer = exts.find(x => x.creates.includes(v) && x.loadRank === creatorRank[v]);
      fail('ORDER-001', `'${e.name}' (${e.scope}) uses '${v}', created later by '${producer.name}' (${producer.scope}).`);
    }
  }));

  // ── ORDER-003: unique order within a scope ─────────────────────────────────
  const seen = {};
  byRank.forEach(e => {
    const key = e.scope + '#' + e.order;
    if (seen[key]) fail('ORDER-003', `Duplicate order ${e.order} in scope '${e.scope}': ${seen[key]} and ${e.name}.`);
    else seen[key] = e.name;
  });

  // ── Consent: gated tags need a consent flag + provider must run first ───────
  const c = policy.consent.consent;
  const provider = exts.find(e => e.name === c.provider_extension);
  exts.filter(e => e.feedsTag && c.require_consent_for.includes(e.tagCategory)).forEach(e => {
    const flag = c.flags.analytics; // both analytics+marketing share the gate in this profile
    const gates = e.uses.includes(c.flags.analytics) || e.uses.includes(c.flags.marketing);
    if (!gates) fail('CONSENT-001', `'${e.name}' feeds a ${e.tagCategory} tag but does not gate on a consent flag (${flag}).`);
    if (provider && provider.loadRank >= e.loadRank) {
      fail('CONSENT-002', `Consent provider '${provider.name}' must run before '${e.name}' (${e.scope}).`);
    }
  });
  if (!provider) fail('CONSENT-003', `Consent provider '${c.provider_extension}' is missing from the profile.`);

  // ── Protected: protected vars must still be produced; protected exts present ─
  policy.protected.protected_variables.forEach(v => {
    const externalInputs = ['tealium_event']; // system var, not produced by an extension
    if (externalInputs.includes(v)) return;
    if (!vars[v] || vars[v].created_by.length === 0) {
      fail('PROT-001', `Protected variable '${v}' is no longer produced by any extension (renamed/removed?).`);
    }
  });
  policy.protected.protected_extensions.forEach(name => {
    if (!exts.find(e => e.name === name)) fail('PROT-002', `Protected extension '${name}' is missing.`);
  });

  return violations;
}

function run() {
  const policy = loadPolicy();
  const profile = loadMetadata();
  const violations = validate(policy, profile);
  print(profile, violations);
  process.exit(violations.length ? 1 : 0);
}

function print(profile, violations) {
  console.log(`\nValidation Agent — ${profile.counts.extensions} extensions, ${profile.counts.variables} variables`);
  if (!violations.length) {
    console.log('✓ PASSED — load-order, consent, protected, and ordering rules satisfied.\n');
    return;
  }
  console.log(`\n🚫 ${violations.length} violation(s):`);
  violations.forEach(v => console.log(`  [${v.id}] ${v.msg}`));
  console.log('');
}

if (require.main === module) run();
module.exports = { run, validate };
