'use strict';
/**
 * Impact Agent — for each changed extension, computes the downstream blast radius
 * (affected variables, extensions, tags) from the dependency graph, and assigns a
 * risk level (manifest risk promoted by blast radius per policy/risk-score.yaml).
 * Emits a Markdown report suitable for posting as a PR comment.
 *
 * Usage:
 *   node scripts/impact-agent.js --changed extensions/10-before-load-rules/02-identity-resolver.js
 *   (CI: derives changed files from the PR diff)
 */
const { loadPolicy, loadMetadata } = require('./lib/load-policy');
const { buildGraph } = require('./lib/graph');
const { changedExtensionFiles } = require('./lib/pr-diff');

function run() {
  const policy = loadPolicy();
  const profile = loadMetadata();
  const graph = buildGraph(profile);
  const order = policy.risk.risk.levels_order;
  const br = policy.risk.risk.blast_radius;

  let changed = changedExtensionFiles(process.argv);
  if (!changed.length) changed = profile.extensions.map(e => e.file); // default: analyse all

  const reports = changed.map(file => {
    const ext = profile.extensions.find(e => e.file === file);
    if (!ext) return { file, missing: true };
    const impact = graph.impactOfExtension(ext);
    const dependents = impact.extensions.length + impact.tags.length;
    let level = ext.risk;
    if (dependents >= br.critical_if_dependents_gte) level = 'critical';
    else if (dependents >= br.high_if_dependents_gte) level = max(level, 'high', order);
    else if (dependents >= br.medium_if_dependents_gte) level = max(level, 'medium', order);
    if (ext.protected) level = max(level, 'high', order);
    return { file, ext, impact, dependents, level };
  });

  const overall = reports.filter(r => !r.missing).reduce((m, r) => max(m, r.level, order), 'low');
  const blocked = order.indexOf(overall) >= order.indexOf(policy.risk.risk.require_architect_at);

  console.log(render(reports, overall, blocked));
  // Impact is advisory (Validation Agent blocks); never fail the build here.
  process.exit(0);
}

function max(a, b, order) { return order.indexOf(b) > order.indexOf(a) ? b : a; }

function render(reports, overall, blocked) {
  const icon = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
  let out = `## 🔍 Impact Analysis — overall risk: ${icon[overall]} **${overall.toUpperCase()}**\n`;
  if (blocked) out += `\n> ⚠️ Risk ≥ architect threshold — **architect approval required** (CODEOWNERS).\n`;
  reports.forEach(r => {
    if (r.missing) { out += `\n### \`${r.file}\`\n- ℹ️ Not an indexed extension (no manifest) — skipped.\n`; return; }
    out += `\n### ${icon[r.level]} ${r.ext.name} \`${r.file}\`\n`;
    out += `- **Risk:** ${r.level}${r.ext.protected ? ' (protected)' : ''} · **Dependents:** ${r.dependents}\n`;
    if (r.impact.variables.length) out += `- **Variables produced:** ${r.impact.variables.join(', ')}\n`;
    if (r.impact.extensions.length) out += `- **Downstream extensions:** ${r.impact.extensions.map(e => e.name).join(', ')}\n`;
    if (r.impact.tags.length) out += `- **Affected tags:** ${r.impact.tags.join(', ')}\n`;
    if (!r.impact.extensions.length && !r.impact.tags.length) out += `- No downstream dependents found.\n`;
  });
  return out;
}

if (require.main === module) run();
module.exports = { run };
