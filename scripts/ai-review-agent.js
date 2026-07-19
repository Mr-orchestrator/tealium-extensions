'use strict';
/**
 * AI Review Agent — LLM-assisted PR review layered on the DETERMINISTIC agents.
 * It is fed only STRUCTURED FACTS (validation violations, impact graph, policy, and the
 * diff) so it reasons over data, not free text — it cannot invent policy or variables.
 * Advisory only: it posts a Markdown review and NEVER fails the build (validation blocks).
 *
 * Enable by setting the `ANTHROPIC_API_KEY` repo secret. Without it, the agent no-ops.
 *
 * Usage: node scripts/ai-review-agent.js [--changed <file>...]
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadPolicy, loadMetadata, ROOT } = require('./lib/load-policy');
const { buildGraph } = require('./lib/graph');
const { validate } = require('./validation-agent');
const { changedExtensionFiles } = require('./lib/pr-diff');

const MODEL = process.env.AI_REVIEW_MODEL || 'claude-sonnet-5';

async function run() {
  const policy = loadPolicy();
  const profile = loadMetadata();
  const graph = buildGraph(profile);

  const facts = {
    validation_violations: validate(policy, profile),
    changed_extensions: changedExtensionFiles(process.argv).map(f => {
      const e = profile.extensions.find(x => x.file === f);
      if (!e) return { file: f, note: 'no manifest / not indexed' };
      const impact = graph.impactOfExtension(e);
      return {
        name: e.name, file: e.file, scope: e.scope, order: e.order, risk: e.risk,
        protected: !!e.protected, creates: e.creates, uses: e.uses, feedsTag: e.feedsTag || null,
        downstream_extensions: impact.extensions.map(x => x.name),
        affected_tags: impact.tags
      };
    }),
    protected_variables: policy.protected.protected_variables,
    consent_policy: policy.consent.consent,
    load_order: policy.loadOrder.load_order.scope_sequence
  };

  const diff = safeDiff();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return emit('_Skipped — set the `ANTHROPIC_API_KEY` repo secret to enable LLM-assisted review. The deterministic Validation + Impact agents already ran._');
  }

  let raw;
  try { raw = await callClaude(apiKey, facts, diff); }
  catch (e) { return emit(`_AI review unavailable (${e.message}). Deterministic checks are authoritative._`); }

  let parsed;
  try {
    const text = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    parsed = JSON.parse(text);
  } catch (e) {
    return emit(raw); // fallback: output raw if not valid JSON
  }
  // Write machine-readable JSON for the inline-comment step in the workflow
  fs.writeFileSync(path.join(ROOT, 'ai-review.json'), JSON.stringify(parsed, null, 2));
  emit(renderFindings(parsed));
}

function safeDiff() {
  const base = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}...HEAD` : 'HEAD~1';
  try { return execSync(`git diff ${base} -- extensions/ policy/`, { cwd: ROOT, encoding: 'utf8' }).slice(0, 12000); }
  catch (e) { return '(diff unavailable)'; }
}

function callClaude(apiKey, facts, diff) {
  const system =
    'You are a Tealium iQ governance reviewer for the F1 Racing Store. ' +
    'Review the PR using ONLY the structured facts and diff — never invent rules, variables, or tags.\n\n' +
    'Return a JSON object with this exact shape:\n' +
    '{\n' +
    '  "verdict": "pass" | "warn" | "block",\n' +
    '  "summary": "<one sentence, ≤20 words>",\n' +
    '  "findings": [\n' +
    '    {\n' +
    '      "severity": "CRITICAL" | "ERROR" | "WARNING" | "INFO",\n' +
    '      "file": "<path relative to repo root>",\n' +
    '      "line": <integer or null>,\n' +
    '      "rule": "<rule ID e.g. ORDER-001, CONSENT-001, or a short slug>",\n' +
    '      "summary": "<one sentence>",\n' +
    '      "suggestion": "<one sentence fix>"\n' +
    '    }\n' +
    '  ]\n' +
    '}\n\n' +
    'Rules: CRITICAL/ERROR findings → verdict=block. WARNING findings → verdict=warn. ' +
    'No findings or INFO only → verdict=pass. Return ONLY valid JSON, no markdown fences.';

  const user =
    'STRUCTURED FACTS (authoritative):\n```json\n' + JSON.stringify(facts, null, 2) + '\n```\n\n' +
    'DIFF (extensions/ + policy/):\n```diff\n' + diff + '\n```';

  const body = JSON.stringify({
    model: MODEL, max_tokens: 1024, system,
    messages: [{ role: 'user', content: user }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
          'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`API ${res.statusCode}`));
          try { resolve(JSON.parse(data).content.map(c => c.text || '').join('').trim()); }
          catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function renderFindings(result) {
  const icons = { block: '🚫', warn: '⚠️', pass: '✅' };
  const sev = { CRITICAL: '🔴', ERROR: '🟠', WARNING: '🟡', INFO: 'ℹ️' };
  const verdict = result.verdict || 'pass';
  let md = `${icons[verdict] || '✅'} **${verdict.toUpperCase()}** — ${result.summary || ''}\n`;

  const findings = result.findings || [];
  if (findings.length) {
    md += '\n| Severity | File | Line | Rule | Finding | Suggestion |\n';
    md += '|---|---|---|---|---|---|\n';
    findings.forEach(f => {
      const lineRef = f.line ? `L${f.line}` : '—';
      const fileLink = f.file ? `\`${f.file}\`` : '—';
      md += `| ${sev[f.severity] || ''} ${f.severity} | ${fileLink} | ${lineRef} | \`${f.rule || '—'}\` | ${f.summary} | ${f.suggestion || '—'} |\n`;
    });
  } else {
    md += '\nNo findings — all checks passed.\n';
  }
  return md;
}

function emit(review) {
  const out = '## 🤖 AI Review Agent\n\n' + review + '\n';
  fs.writeFileSync(path.join(ROOT, 'ai-review.md'), out);
  console.log(out);
}

if (require.main === module) run();
module.exports = { run };
