# Developer Guide

## Add or change an extension

1. Put the file in the correct **load-order folder** (`extensions/<scope>/NN-name.js`).
2. Start it with a complete `@tealium-extension` **manifest header** — this is the source of
   truth the agents read. Required: `id, name, scope, order, loadRule, risk`. Declare
   `@creates` / `@uses` accurately (the dependency graph and load-order checks depend on them).
   If it feeds a vendor tag, add `@feedsTag` + `@tagCategory` (Analytics/Marketing gate on consent).
3. Run locally before pushing:
   ```bash
   npm run lint && npm run build:metadata && npm run validate && npm run docs && npm test
   ```
4. Commit regenerated `docs/` and `metadata/` (CI fails if `docs/` are stale).
5. Open a PR. CI runs the agents and posts an impact-analysis comment. Protected areas
   (`policy/`, consent/identity extensions) require architect review via CODEOWNERS.

## Manifest header reference

```js
/**
 * @tealium-extension
 * @id 11                         // unique integer
 * @name Identity Resolver        // must match Tealium extension name (drift check)
 * @scope Before Load Rules       // Pre Loader | Before Load Rules | After Load Rules | DOM Ready | After Tags
 * @order 2                       // unique within scope
 * @loadRule all                  // "all" or comma list of load-rule ids
 * @creates customer_id, ...      // variables this extension produces
 * @uses gridbox_data, ...        // variables/inputs it consumes
 * @protected true                // optional — blocks rename/remove
 * @risk high                     // low | medium | high | critical
 * @feedsTag GA4                  // optional — vendor tag this feeds
 * @tagCategory Analytics         // optional — gates on consent if Analytics/Marketing
 */
```

## Policy as code (`policy/`)

- `protected.yaml` — variables/extensions that may not be renamed/removed without approval.
- `consent-rules.yaml` — Analytics/Marketing tag-feeders must gate on a consent flag, and the
  Consent Manager must run first (Pre Loader).
- `load-order-rules.yaml` — no backward (later-scope) dependencies; unique scope/order.
- `risk-score.yaml` — change-type levels + blast-radius promotion + architect threshold.

## AI agents — how to enable

The four core agents (Knowledge / Validation / Impact / Documentation) are **deterministic**
Node scripts — they read structured facts and never hallucinate. Two layers add genuine AI:

### 1. AI Review Agent (LLM-assisted PR review) — `scripts/ai-review-agent.js`
Layers on top of the deterministic agents: it is fed only their structured output
(violations, impact graph, policy, diff) and asks an LLM for a concise natural-language review,
posted as a PR comment. **Advisory only — it never blocks** (the Validation Agent blocks).

**Enable it:**
1. Get an Anthropic API key (https://console.anthropic.com).
2. Repo → **Settings → Secrets and variables → Actions → New repository secret**:
   `ANTHROPIC_API_KEY = sk-ant-...`
3. That's it — the `AI Review Agent` CI step activates on the next PR. Optional: set repo
   variable `AI_REVIEW_MODEL` (default `claude-sonnet-4-6`).
Without the secret the agent **no-ops** (prints a "skipped" note) so CI stays green.

Run locally: `ANTHROPIC_API_KEY=sk-ant-... npm run ai:review -- --changed extensions/...`

### 2. GitHub Copilot (authoring + optional auto-review)
- **Copilot in the IDE:** org admin → **Settings → Copilot** → enable for licensed devs /
  allowed models. Copilot may assist writing extension JS but must comply with policy (it must
  not suggest renaming a protected variable or moving a tag ahead of consent). CI is the
  enforcement boundary, not Copilot.
- **Copilot code review (optional):** repo → **Settings → Code review** → enable "Request
  Copilot review automatically" so Copilot also comments on PRs.

The deterministic agents are authoritative; the LLM/Copilot layers are assistive.

## Connecting Tealium (publish + drift)

Add secrets `TEALIUM_ACCOUNT / TEALIUM_PROFILE / TEALIUM_API_TOKEN`. `npm run knowledge:pull`
diffs repo vs live profile. Publishing to Tealium still uses **Save As** (never Overwrite) so
prior versions remain for rollback.
