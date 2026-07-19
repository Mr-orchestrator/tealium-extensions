# Tealium iQ Governance — Claude Code Schema

This repository is a Tealium iQ extension profile for the F1 Racing Store.
Claude Code is the intelligence layer. The agents in `.claude/agents/` replace all Python and JS review code.
The `wiki/` directory is the persistent knowledge base — it compounds with every review.

## Repository layout

```
extensions/          raw source (JS files, immutable during review)
  00-pre-loader/
  10-before-load-rules/
  20-after-load-rules/
  30-dom-ready/
  40-after-tags/
policy/              YAML governance rules (immutable during review)
schema/
  datalayer-schema.json   variables the site provides (not extension-created)
wiki/
  index.md           catalog of all wiki pages
  log.md             append-only audit log (never delete entries)
  graph-state.md     latest execution graph snapshot
  variables.md       variable map: provider → consumers
  findings/          one .md per review session
.claude/
  CLAUDE.md          this file — the schema
  agents/            agent definitions (you are reading one now)
```

## Tealium iQ execution phases (strict order — upstream runs first)

| Phase folder | Order | Purpose |
|---|---|---|
| 00-pre-loader | 1 | Consent, data layer bootstrap |
| 10-before-load-rules | 2 | Enrichment, identity resolution |
| 20-after-load-rules | 3 | Tag data mapping |
| 30-dom-ready | 4 | DOM-triggered tracking |
| 40-after-tags | 5 | Cleanup, diagnostics |

A variable WRITTEN in phase 3 and READ in phase 2 is an ORDER violation.
A variable READ but never written by any extension is a broken chain (check `schema/datalayer-schema.json` first — it may be site-provided).

## Site-provided variables (not extension-created — never flag as broken chain)

Load `schema/datalayer-schema.json` → `.site_provided` array before any dependency check.
Current set: gridbox_data, tealium_event, eventCategory, eventAction, user_id, user_email, tier, consent_analytics, consent_marketing, consent_status.

## How to invoke agents

```
/graph-builder       build or refresh the execution graph → updates wiki/graph-state.md
/developer           JS quality review of changed files
/load-order          phase violation check
/dependency          variable cross-reference check
/privacy             GDPR/consent/PII check
/consensus           score all findings from a review session → verdict
/healer              auto-fix BLOCK findings (prompts before writing)
/loop                run the full agentic review loop (graph → all agents → consensus → optional heal)
```

Or spawn any agent via the Agent tool.

## Wiki operations

**Ingest a review:** After `/loop` completes, consensus writes a findings page to `wiki/findings/YYYY-MM-DD-<file>.md`, updates `wiki/index.md` and appends to `wiki/log.md`.

**Query:** Ask Claude Code about the wiki — "what findings have we had on load-order violations?" — it reads `wiki/index.md` first, then drills into relevant pages.

**Lint:** Periodically run "lint the wiki" — Claude Code checks for stale findings (file changed since finding), orphan pages, contradictions between pages.

## Output format — all agents must follow

```json
{
  "verdict": "PASS" | "WARN" | "BLOCK",
  "summary": "<one sentence, ≤20 words>",
  "findings": [
    {
      "severity": "CRITICAL" | "ERROR" | "WARNING" | "INFO",
      "file": "<path relative to repo root>",
      "line": <integer or null>,
      "rule": "<rule ID>",
      "summary": "<one sentence>",
      "suggestion": "<one sentence fix>"
    }
  ]
}
```

CRITICAL or ERROR findings → verdict BLOCK.
WARNING findings → verdict WARN.
No findings or INFO only → verdict PASS.

## Security constraints (non-negotiable)

- Never write outside `extensions/` and `wiki/` directories.
- Never write to `.github/`, `scripts/`, `policy/`, `schema/` unless the user explicitly asks.
- Never emit API keys, tokens, or credentials in any wiki page or finding.
- Healer must show the proposed change and ask for confirmation before writing.
- Loop agent: hard stop at 3 iterations regardless of findings.
- Log entries are append-only — never delete or rewrite `wiki/log.md` entries.
