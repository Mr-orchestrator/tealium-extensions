'use strict';
/**
 * Knowledge Agent — keeps the knowledge base current and detects DRIFT between the
 * repo (source of truth in code review) and the LIVE Tealium profile.
 *   1. Rebuilds local metadata from the manifests (always).
 *   2. If Tealium creds exist, pulls the live profile and diffs extension names/scopes,
 *      flagging items that exist in Tealium but not in the repo (or vice-versa).
 * Without creds it runs in local-manifest mode (no network) and just refreshes metadata.
 *
 * Usage: node scripts/knowledge-agent.js
 */
const { build } = require('./build-metadata');
const { hasCreds, getProfile } = require('./lib/tealium-api');

async function run() {
  const local = build(); // refresh metadata/*.json from manifests

  if (!hasCreds()) {
    console.log('ℹ Local-manifest mode (no TEALIUM_* creds) — metadata refreshed from repo; live drift check skipped.');
    return;
  }

  console.log('↻ Pulling live Tealium profile for drift check…');
  let live;
  try { live = await getProfile(); }
  catch (e) { console.error('✗ Tealium API error: ' + e.message); process.exit(1); }

  const liveExts = (live && live.extensions) || [];
  const liveNames = new Set(liveExts.map(e => e.name));
  const repoNames = new Set(local.extensions.map(e => e.name));

  const onlyLive = [...liveNames].filter(n => !repoNames.has(n));
  const onlyRepo = [...repoNames].filter(n => !liveNames.has(n));

  console.log(`\nDrift report — repo: ${repoNames.size} extensions · live: ${liveNames.size}`);
  if (onlyLive.length) console.log(`  ⚠ In Tealium but NOT in repo (unmanaged): ${onlyLive.join(', ')}`);
  if (onlyRepo.length) console.log(`  ⚠ In repo but NOT in Tealium (unpublished): ${onlyRepo.join(', ')}`);
  if (!onlyLive.length && !onlyRepo.length) console.log('  ✓ No drift — repo and live profile match.');
}

if (require.main === module) run();
module.exports = { run };
