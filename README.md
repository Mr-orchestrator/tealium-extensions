# tealium-extensions — Governed Tealium iQ for the F1 Racing Store

A version-controlled, **load-order-organized** Tealium iQ implementation with an automated
**governance platform**: a policy engine + four agents that validate every change in CI
before it reaches Tealium. The Tealium profile is the source of truth; agents read
**structured facts** (manifest headers + parsed profile metadata), never free text.

## Load-order model

Tealium runs extensions/tags by **scope**, then **order** within scope. Code is organized to mirror it:

| Folder | Tealium scope | F1 extensions |
|---|---|---|
| `extensions/00-pre-loader/` | **Pre Loader** | Consent Manager 🔒 |
| `extensions/10-before-load-rules/` | **Before Load Rules** | Data Layer Enrichment, Identity Resolver 🔒, Page Data |
| `extensions/20-after-load-rules/` | **After Load Rules** | GA4 Ecommerce Mapping, Adobe Data Mapping |
| `extensions/30-dom-ready/` | **DOM Ready** | Scroll & Click Tracking |
| `extensions/40-after-tags/` | **After Tags** | Cleanup & Diagnostics |

Numeric folder/file prefixes encode order; the authoritative facts live in each file's
`@tealium-extension` **manifest header** (`scope`, `order`, `creates`, `uses`, `protected`, `risk`, `feedsTag`).

## Architecture

```
manifest headers ──► build-metadata.js ──► metadata/*.json (knowledge base)
                                                  │
        policy/*.yaml ──────────────┐             ├──► validation-agent  (blocks PR)
                                     ├── agents ──►├──► impact-agent      (PR comment)
   live Tealium API (optional) ─────┘             ├──► doc-agent         (docs/)
                                                  └──► knowledge-agent   (drift check)
```

## Commands

```bash
npm install
npm run build:metadata   # manifests -> metadata/ knowledge base
npm run validate         # enforce policy (exit 1 on violation)  ← CI gate
npm run impact -- --changed extensions/10-before-load-rules/02-identity-resolver.js
npm run docs             # regenerate docs/execution-flow.md + dependency-map.md
npm run knowledge:pull   # refresh metadata (+ live-profile drift check if creds set)
npm test                 # jest: policy + validation + impact
npm run lint             # eslint extensions + scripts
```

## Governance in CI

`.github/workflows/validate.yml` runs on every PR: **lint → knowledge → validate → impact (auto-comment) → docs-freshness**. A policy violation fails the check and blocks merge. `.github/CODEOWNERS` requires architect review on `policy/`, the consent/identity extensions, `schema/`, and `.github/`.

## Connecting the live Tealium profile

Set repo secrets `TEALIUM_ACCOUNT`, `TEALIUM_PROFILE`, `TEALIUM_API_TOKEN`. The Knowledge
Agent then reconciles the repo against the live profile and reports drift. Without them the
platform runs in **local-manifest mode** (no network) — fully usable for development and CI.

See [`docs/dev-guide.md`](docs/dev-guide.md) and [`docs/best-practices.md`](docs/best-practices.md).
