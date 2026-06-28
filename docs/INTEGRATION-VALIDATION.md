# GridBox ↔ Tealium Integration — What Was Done & How to Validate

This documents the F1 Racing Store ↔ Tealium integration work, the validation evidence,
and exactly how to review/approve, verify the GitHub agent, and deploy.

## 1. What changed (governance repo: `Mr-orchestrator/tealium-extensions`)

| Commit | Change | Why |
|---|---|---|
| `567a29a` | **Data Layer Enrichment** flat-aware (`pick(flat, nested)`) | interaction events arrive flat, not nested |
| `73425ea` | **Pre Loader extensions** fixed: no `function(a,b)` wrapper, write to `window.utag_data` | Pre Loader runs raw — no `b`, not wrapped (docs.tealium.com) |
| `b76b2ee` | **GA4 Mapping** dynamic `ga4_<category>_<action>` + commerce map | auto-map the site's `gb_` events with no map edits |
| `41e003d` | **Event Bridge** consumes `gridboxLayer.event[]`, **not** `adobeDataLayer` | Adobe Launch owns `adobeDataLayer` (separate use-case) |

### Stream separation (each tag manager on its own stream)
```
GridBox event fires ─┬─► window.adobeDataLayer  ──► Adobe Launch   (untouched, separate use-case)
                     ├─► window.dataLayer (GTM) ──► GTM            (untouched)
                     └─► window.gridboxLayer.event[] ──► Tealium Event Bridge ──► utag.link ──► GA4
```

## 2. The site contract (verified, no site changes required)

`racing-f1/analytics.js` already implements the full contract:
- **`data-track="<category>-<sub>_<action>_<label>"`** attributes site-wide (e.g. `navigation-main_click_teams`).
- **Event callback** (`eventPrefix:'gb_'`, `trackAttribute:'data-track'`) + a document-level delegated click listener.
- **`CD_WHITELIST`** — only allow-listed custom dimensions reach a tag (mirrors the enterprise `CDPermittedTable` pattern; complements `policy/protected.yaml`).
- **`gridboxLayer.event[]`** — canonical event array carrying the stable `eventInfo.key`; the Tealium Event Bridge wraps its `push` (deferred wrap that never creates `gridboxLayer`, so it can't break site init).

## 3. Validation evidence

**Governance pipeline** (`npm run lint && npm run validate && npm test`):
- lint: 0 · validate: **PASSED** (10 extensions, 42 variables, load-order/consent/protected OK).
- jest: **22/22**, including `tests/ga4-mapping.test.js` which runs the *real* GA4 extension file and asserts:
  commerce keys → GA4 recommended events, human-name fallback, dynamic `ga4_<cat>_<act>`, consent gate, items/value.

**Site E2E** (`tests/gridbox-tealium-bridge.spec.js`, chromium, local server):
- **18/18 passed.** All 15 pages init gridbox + have `data-track`; a `data-track` click yields a `gb_` event in
  `gridboxLayer.event[]`; a faithful inline copy of the Event Bridge + GA4 Mapping forwards it to `utag.link`
  with the correct `ga4_event_name` — without `adobeDataLayer`.

Run it yourself:
```bash
# governance repo
cd tealium-extensions && npm ci && npm run lint && npm run validate && npm test
# site repo (local files, not the deployed build)
cd racing-f1 && BASE_URL=http://localhost:3000 npx playwright test tests/gridbox-tealium-bridge.spec.js --project=chromium
```

## 4. How to review & approve the changes

1. Open a PR (or push to `main` if that's the agreed flow). CI (`.github/workflows/validate.yml`) runs
   **lint → knowledge → validate → impact (PR comment) → ai:review → docs-freshness**.
2. **Approve when:** the `validate` check is green, the **Impact** PR comment shows no unexpected blast radius,
   and the **AI Review** comment has no blocking findings.
3. `CODEOWNERS` requires architect review on `policy/`, the consent/identity extensions, `schema/`, `.github/`.

## 5. Verify the GitHub agent (the Claude key)

`gh` CLI is not installed locally, so verify in the browser:
1. **Repo → Settings → Secrets and variables → Actions** — confirm `ANTHROPIC_API_KEY` is present
   (and, for live drift checks, `TEALIUM_ACCOUNT` / `TEALIUM_PROFILE` / `TEALIUM_API_TOKEN`).
   These must be in the **Actions** secret store (not the Copilot-agent store).
2. **Repo → Actions** — open the latest `validate` run for this push. The **`ai:review`** step should post a
   review using `claude-sonnet-4-6`. If the key is missing the step **no-ops** (logs "no ANTHROPIC_API_KEY") and
   stays green — so a *populated* review in the log/PR comment is the proof the key works.

## 6. Deploy to Tealium + Trace

1. In Tealium iQ, update the 3 changed extensions via **Add GitHub File** (URLs in `docs/tealium-deployment.md`).
2. **Save As → Publish to qa.**
3. **Trace:** load the site, click a `data-track` button → confirm `gridboxLayer.event[]` → `utag.link`
   with `tealium_event` = the `gb_` key and `ga4_event_name` = `ga4_<category>_<action>` (consent-gated).

## 7. Open items
- **Push `racing-f1`** — its git remote is still the placeholder `YOUR_USERNAME/gridbox-analytics.git`.
  Provide the real repository URL to push the site (incl. the new Playwright spec).
- **Deploy** the 3 extensions to the qa profile, then Trace-validate (§6).
