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

## GitHub Copilot (org policy)

Copilot may assist writing extension JS but must comply with policy — e.g. it must not
suggest renaming a protected variable or moving a tag ahead of consent. Configure Copilot at
the org level (licensed devs, allowed models); CI is the enforcement boundary, not Copilot.

## Connecting Tealium (publish + drift)

Add secrets `TEALIUM_ACCOUNT / TEALIUM_PROFILE / TEALIUM_API_TOKEN`. `npm run knowledge:pull`
diffs repo vs live profile. Publishing to Tealium still uses **Save As** (never Overwrite) so
prior versions remain for rollback.
