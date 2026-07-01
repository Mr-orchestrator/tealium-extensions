# Configuring Tealium to Receive Server-Side AI-Crawler Events

This is the doc-referenced runbook for wiring the F1 site's Vercel Edge middleware
(`racing-f1/middleware.js`) into your Tealium profile so `ai_crawler_visit` events land in
Tealium the same way client-side `utag.link` calls do — but originated server-side.

**Prerequisite (already done):** middleware is deployed on `racing-f1-rho.vercel.app`, sets
`x-bot-*` headers, and is ready to POST to Tealium — gated on the `TEALIUM_COLLECT_URL` env var
(currently unset, so the POST is safely disabled).

The middleware sends this JSON (schema in `racing-f1/lib/bot-detection.js → buildCollectEvent`):

```json
{
  "tealium_account": "cognizant-sandbox",
  "tealium_profile": "f1racing",
  "tealium_event":   "ai_crawler_visit",
  "bot_detected":    "true",
  "bot_name":        "GPTBot",
  "bot_vendor":      "OpenAI",
  "bot_class":       "crawler",
  "page_url":        "https://racing-f1-rho.vercel.app/tickets.html",
  "page_path":       "/tickets.html",
  "referrer":        "https://chat.openai.com/",
  "user_agent":      "Mozilla/5.0 ... GPTBot/1.2 ...",
  "ip":              "1.2.3.4",
  "timestamp_iso":   "2026-06-29T12:34:56.789Z"
}
```

---

## Step 1 — Confirm which endpoint you'll POST to

Two options, both documented:

| Endpoint | URL | Auth | When to use |
|---|---|---|---|
| **Tealium Collect HTTP API v1** | `https://collect.tealiumiq.com/event` | None | Simplest; matches the middleware default |
| **Tealium Collect HTTP API v3** | (per-region, authenticated) | API key | Preferred for regulated data |

The middleware today points at v1. Reference: [Endpoint Specification — Tealium Collect HTTP API v1](https://docs.tealium.com/platforms/http-api/endpoint/) · [About v3](https://docs.tealium.com/api/v3/http-api/about/).

**Action:** none — keep v1 unless you have a policy reason to switch.

---

## Step 2 — Create the Data Layer variables

In **Tealium iQ → Data Layer → + Add Variable** (create each as **UDO Variable**, type
**String** unless noted). These names must match the JSON keys exactly:

| Variable | Type | Purpose |
|---|---|---|
| `tealium_event` | (system) | Already exists — event name (`ai_crawler_visit`) |
| `bot_detected` | String | `"true"` when the middleware matched a crawler |
| `bot_name` | String | e.g. `GPTBot`, `ClaudeBot`, `PerplexityBot` |
| `bot_vendor` | String | e.g. `OpenAI`, `Anthropic`, `Google` |
| `bot_class` | String | `crawler` or `agent` |
| `user_agent` | String | Full UA (already sent as `js_page.navigator.userAgent` for the client path) |
| `page_url` | String | Full request URL |
| `page_path` | String | Request pathname |
| `referrer` | String | HTTP `Referer` header |
| `ip` | String | `x-forwarded-for` |
| `timestamp_iso` | String | ISO-8601 timestamp of the hit |

Reference: [Manage data layer variables](https://docs.tealium.com/iq-tag-management/data-layer/manage-variables/).

---

## Step 3 — Add a Load Rule: `AI Crawler Traffic`

In **Tealium iQ → Load Rules → + Add Load Rule**, name it `AI Crawler Traffic` and set:

- **Condition:** `tealium_event` **equals** `ai_crawler_visit`

This is the gate you'll attach to any tag that should fire *only* for bot hits (e.g. an audit
tag) and negate on any tag that should fire *only* for humans (see Step 5).

---

## Step 4 — Route the events

Pick one (or more) of these, depending on what you want to do with the data.

### Option A (simplest) — audit-only, view in Live Events

Do nothing else. The events land on the profile and are visible in Tealium's Live Events UI in
near-real-time — enough for weekly bot-traffic audits. No tags fire, so no cost.

### Option B — send to a warehouse via EventStream

For long-term storage and analysis (recommended):

1. **EventStream → Sources → + Add Data Source → HTTP API (Advanced)** — this gives you a
   `data_source_key`. Include it in the middleware payload as `tealium_datasource` so incoming
   hits are attributed to this source. Reference:
   [HTTP API — Advanced incoming webhook setup guide](https://docs.tealium.com/server-side/data-sources/webhooks/http-api-advanced/).
2. **EventStream → Event Feeds → + Add Feed** — create a feed with the rule:
   `tealium_event equals "ai_crawler_visit"`.
3. **EventStream → Event Specs** — define the schema so downstream connectors know the fields
   (`bot_name`, `bot_vendor`, …).
4. **EventStream → Connectors** — add a connector to route the feed to your destination
   (BigQuery / S3 / Snowflake / Slack alert / webhook / etc.).

### Option C — mirror to GA4 as a custom event

If you want AI traffic visible in GA4 (separately from human traffic):
- **Tealium iQ → Tags → + Add Tag → Google Analytics 4** (a *second* GA4 tag distinct from your
  existing one) → **Consent Category:** leave un-gated (bots don't consent).
- **Load Rules:** attach `AI Crawler Traffic`.
- **Data Mappings:** `bot_name` → event param `bot_name`, `bot_vendor` → `bot_vendor`,
  `page_path` → `page_location`, etc. Set the GA4 event name to `ai_crawler_visit`.

---

## Step 5 — Exclude bots from human tags

This is the one you almost certainly want either way. For each existing human-facing tag (GA4,
Meta Pixel, etc.):

- **Tags → \<the tag\> → Load Rules** → add a NEGATIVE rule:
  `bot_detected` **does not equal** `true` (or **is not defined**).

Otherwise every crawler hit pollutes your human analytics.

Reference: [Manage Load Rules](https://docs.tealium.com/iq-tag-management/load-rules/manage/).

---

## Step 6 — Test end-to-end with Trace + Live Events

1. **Enable the middleware POST** (temporarily, on a preview deployment first):
   ```bash
   vercel env add TEALIUM_COLLECT_URL preview
   # value: https://collect.tealiumiq.com/event
   vercel --yes    # deploys a preview URL
   ```
2. **Get a Trace ID** in Tealium iQ → **Trace** → *Start New Trace* → copy the ID. Reference:
   [Trace: Test with Trace](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/test-trace/).
3. **Fire a test event** with the trace ID in the payload:
   ```bash
   curl -X POST https://collect.tealiumiq.com/event \
     -H "Content-Type: application/json" \
     -d '{
       "tealium_account":"cognizant-sandbox",
       "tealium_profile":"f1racing",
       "tealium_event":"ai_crawler_visit",
       "bot_detected":"true","bot_name":"GPTBot","bot_vendor":"OpenAI","bot_class":"crawler",
       "page_url":"https://racing-f1-rho.vercel.app/","page_path":"/",
       "user_agent":"Mozilla/5.0 ... GPTBot/1.2 ...",
       "cp.trace_id":"<PASTE_TRACE_ID>"
     }'
   ```
4. **Trace panel** in Tealium iQ shows the event landing, which extensions ran, which load
   rules matched, which tags fired. Reference:
   [Validate and troubleshoot tags](https://docs.tealium.com/iq-tag-management/troubleshooting/validate-tags/).
5. **Live Events** (EventStream) — the event appears with all attributes. Confirm `bot_name` +
   `bot_vendor` + `bot_class` are populated as expected.

You can also drive real traffic with the existing Playwright suite:
```bash
BASE_URL_MW=https://racing-f1-rho.vercel.app \
  npx playwright test racing-f1/tests/ai-crawler-detection.spec.js --project=chromium
```
Every spoofed UA in the suite will trigger a real Collect POST once the env var is set.

---

## Step 7 — Turn it on for prod

Once Trace + Live Events show clean events:

```bash
vercel env add TEALIUM_COLLECT_URL production
# value: https://collect.tealiumiq.com/event
vercel --prod --yes
```

That's it. Every real GPTBot/ClaudeBot/PerplexityBot/etc. hit on prod fires an
`ai_crawler_visit` server-side event into your Tealium profile.

---

## Step 8 — Publish to qa, then prod

In Tealium iQ → **Save / Publish** → **qa** first, verify with Trace, then publish to **prod**.
Any new Data Layer variables, Load Rules, or Tags only take effect after publishing.

---

## Reference — the full docs used in this runbook

- [Tealium Collect HTTP API v1 — Endpoint Specification](https://docs.tealium.com/platforms/http-api/endpoint/)
- [About the Tealium Collect HTTP API v3](https://docs.tealium.com/api/v3/http-api/about/)
- [HTTP API — Advanced incoming webhook setup guide](https://docs.tealium.com/server-side/data-sources/webhooks/http-api-advanced/)
- [Manage data layer variables](https://docs.tealium.com/iq-tag-management/data-layer/manage-variables/)
- [Manage Load Rules](https://docs.tealium.com/iq-tag-management/load-rules/manage/)
- [Validate and troubleshoot tags](https://docs.tealium.com/iq-tag-management/troubleshooting/validate-tags/)
- [Trace: Test with Trace](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/test-trace/)
- [Trace (EventStream)](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/trace/)
- [Universal Tag Debugger (client-side companion)](https://docs.tealium.com/iq-tag-management/tealium-tools/utag-debugger/)
