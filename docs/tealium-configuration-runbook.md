# Tealium Configuration Runbook — AI-Crawler Events

**Precise, per-click steps** to receive the F1 site's server-side AI-crawler events into your
Tealium profile. Follow top to bottom. Every step tells you exactly what to click, what to type,
and how to verify.

**Prereqs (already done — don't repeat)**
- Vercel Edge middleware live on `racing-f1-rho.vercel.app` (commit `577d415`)
- 44/44 Playwright tests pass; `X-Bot-Track-Sent: true` proven on every crawler UA
- Middleware currently POSTs to `/api/bot-collect` on the same origin (audit log). You will
  either **swap** the target to Tealium in Step 7, or **fork** so both receive.

**Your identifiers**
- Account: `cognizant-sandbox`
- Profile: `f1racing`
- Environment: publish to `qa` first, `prod` after Trace passes

**JSON payload the middleware sends** (already agreed schema)
```json
{
  "tealium_account": "cognizant-sandbox",
  "tealium_profile": "f1racing",
  "tealium_event":   "ai_crawler_visit",
  "bot_detected":    "true",
  "bot_name":        "GPTBot",
  "bot_vendor":      "OpenAI",
  "bot_class":       "crawler",
  "page_url":        "https://racing-f1-rho.vercel.app/tickets",
  "page_path":       "/tickets",
  "referrer":        "",
  "user_agent":      "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  "ip":              "1.2.3.4",
  "timestamp_iso":   "2026-07-01T02:48:00.000Z"
}
```

---

## Step 1 — Data Layer variables (11 to create)

**Where:** iQ Tag Management (left nav) → **Data Layer** → click **+ Add Variable**.
For each row, choose **UDO Variable**, paste the exact variable name, set the type/description
shown below, then click **Save & Add Another** until the last one, where you click **Save**.

Reference: [Manage variables](https://docs.tealium.com/iq-tag-management/data-layer/manage-variables/) · [Variable types](https://docs.tealium.com/iq-tag-management/data-layer/data-layer-variables/).

| # | Variable Name (exact) | Data Type | Description |
|---|---|---|---|
| 1 | `bot_detected` | String | `"true"` when middleware matched an AI crawler UA |
| 2 | `bot_name` | String | e.g. `GPTBot`, `ClaudeBot`, `PerplexityBot` |
| 3 | `bot_vendor` | String | e.g. `OpenAI`, `Anthropic`, `Google` |
| 4 | `bot_class` | String | `crawler` or `agent` |
| 5 | `user_agent` | String | Full request User-Agent header |
| 6 | `page_url` | String | Full request URL |
| 7 | `page_path` | String | Request pathname |
| 8 | `referrer` | String | HTTP `Referer` header |
| 9 | `ip` | String | Client IP (from `x-forwarded-for`) |
| 10 | `timestamp_iso` | String | ISO-8601 timestamp when middleware detected |
| 11 | `tealium_datasource` | String | (Only if you do Step 4B) — the data source key |

`tealium_event` already exists (system variable); do **not** re-create it.

**Verify:** the Data Layer page now lists all 11 rows.

---

## Step 2 — Load Rule "AI Crawler Traffic"

**Where:** iQ Tag Management (left nav) → **Load Rules** → **+ Add Load Rule**.

Fill in:

| Field | Value |
|---|---|
| **Name** | `AI Crawler Traffic` |
| **Description** | `Fires only on server-side AI crawler visits` |
| **Match** | `All conditions` (AND) |
| **Condition 1** | Variable: `tealium_event` · Operator: **Equals** · Value: `ai_crawler_visit` |

Click **Save**.

Reference: [Manage Load Rules](https://docs.tealium.com/iq-tag-management/load-rules/manage/).

---

## Step 3 — Exclude bots from every existing HUMAN tag (do this or your GA4/Meta gets polluted)

For **each** existing tag (GA4, Meta Pixel, and any other client-side analytics tag):

**Where:** iQ Tag Management → **Tags** → click the tag → **Load Rules** tab → **Edit** the tag's load rules.

Add this condition to the existing rule (or create a new negative rule and combine):

| Field | Value |
|---|---|
| Variable | `bot_detected` |
| Operator | **Does Not Equal** |
| Value | `true` |

Click **Save** on the tag.

Repeat for every human-facing tag.

**Verify:** the tag's Load Rules panel shows the extra `bot_detected != true` condition.

---

## Step 4 — Route the AI-crawler events (pick ONE, or combine)

### 4A — Audit-only (simplest, do this first)

Do nothing extra. Every `ai_crawler_visit` event lands on your profile and is visible in **Live
Events** (iQ Tag Management → **Live Events** or **EventStream → Live Events**). Enough for weekly bot-traffic audits.

### 4B — Route to a warehouse / Slack / webhook via EventStream (recommended for retention)

**Where:** left nav → **EventStream** → **Sources** → **Data Sources** → **+ Add Data Source**.

- **Categories** side panel → **Developer Languages** → **HTTP API** → **Continue**.
- **Name:** `AI Crawler Server-Side`
- **Save & Continue**.
- The next screen shows a **Data Source Key** (looks like `abc123-def456`). **Copy it.**

Reference: [Add a data source](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/add-data-source/).

Now add the feed:
**Where:** left nav → **EventStream** → **Event Feeds** → **+ Add Feed**.

| Field | Value |
|---|---|
| **Name** | `AI Crawler Visits` |
| **Data Source** | select `AI Crawler Server-Side` |
| **Condition** | `tealium_event` **Equals** `ai_crawler_visit` |

Click **Save**.

Reference: [Add an Event Feed](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/add-feed/).

Now add the destination:
**Where:** left nav → **Server-Side** → **Connectors** → **+ New Connector** (or **Marketplace**).

- Pick a connector: **Slack** (alerts) / **AWS S3** (audit log) / **Google BigQuery** (analytics) /
  **Webhook** (any endpoint) / etc.
- **Feed:** select `AI Crawler Visits`.
- Configure the vendor-side fields (Slack channel URL, S3 bucket, BQ project, …).
- **Save**.

Reference: [Add a connector](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/add-connector/).

### 4C — Mirror to GA4 as an `ai_crawler_visit` event (only if you want AI traffic in GA4)

**Where:** iQ Tag Management → **Tags** → **+ Add Tag** → search **Google Analytics 4**.

- Add a **SECOND** GA4 tag (do not modify the existing one).
- **Load Rules** tab → select `AI Crawler Traffic` (from Step 2) — this tag now fires **only**
  on bot traffic.
- **Data Mappings** tab: map `bot_name` → event parameter `bot_name`, `bot_vendor` → `bot_vendor`,
  `page_path` → `page_location`, `page_url` → `page_referrer`, etc.
- Set the tag's **Event Name** to `ai_crawler_visit`.
- **Save**.

---

## Step 5 — Test end-to-end with Trace (before publishing)

1. **Start a trace.** iQ Tag Management → **Trace** (left nav) → **+ New Trace** → **Start** →
   copy the **Trace ID** (looks like `abc-123-def-456`).
   Reference: [Test with Trace](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/test-trace/).

2. **Fire a manual event** with that Trace ID. Paste this into your terminal (replace `<PASTE_TRACE_ID>`):
   ```bash
   curl -X POST https://collect.tealiumiq.com/event \
     -H "Content-Type: application/json" \
     -d '{
       "tealium_account":"cognizant-sandbox",
       "tealium_profile":"f1racing",
       "tealium_event":"ai_crawler_visit",
       "bot_detected":"true","bot_name":"GPTBot","bot_vendor":"OpenAI","bot_class":"crawler",
       "page_url":"https://racing-f1-rho.vercel.app/tickets","page_path":"/tickets",
       "user_agent":"Mozilla/5.0 (compatible; GPTBot/1.2)","ip":"127.0.0.1",
       "timestamp_iso":"2026-07-01T02:50:00Z",
       "cp.trace_id":"<PASTE_TRACE_ID>"
     }'
   ```
   You should get `{"success":true,...}` back.

3. **Watch the Trace panel** (refresh if needed). You should see:
   - Event received ✓
   - Extensions ran ✓
   - Load Rule `AI Crawler Traffic` **matched** ✓
   - Whatever tags/feeds/connectors you configured **triggered** ✓
   - **No** human tags (GA4/Meta) fired (Step 3 exclusion works) ✓

If any row shows **skipped** or **error**, the Trace panel tells you why (unmatched variable name, wrong operator, missing consent category, etc.). Fix and re-run.

---

## Step 6 — Publish

**Where:** top-right → **Save/Publish**.
- First publish to **qa**. Re-run Step 5 against the qa profile if you use a separate one.
- Then publish to **prod**.

Reference: [Save & Publish workflow](https://docs.tealium.com/iq-tag-management/save-publish/).

---

## Step 7 — Point the middleware at Tealium

Right now, the middleware POSTs to `/api/bot-collect` (self-hosted audit log). Choose:

**Option 7A — Replace: send only to Tealium**
```bash
cd racing-f1
vercel env rm TEALIUM_COLLECT_URL production
vercel env add TEALIUM_COLLECT_URL production
# Value: https://collect.tealiumiq.com/event
vercel --prod --yes
```

**Option 7B — Fork: keep local audit + also send to Tealium**
```bash
cd racing-f1
# Leave TEALIUM_COLLECT_URL = /api/bot-collect (unchanged)
vercel env add TEALIUM_COLLECT_FORWARD_URL production
# Value: https://collect.tealiumiq.com/event
vercel --prod --yes
```
(`/api/bot-collect` reads `TEALIUM_COLLECT_FORWARD_URL` and forwards every event it receives to real Tealium.)

**Verify** (either option): fire a real crawler-UA hit and watch Tealium **Live Events**:
```bash
curl -A "Mozilla/5.0 (compatible; GPTBot/1.2)" https://racing-f1-rho.vercel.app/tickets
```
Live Events should show one `ai_crawler_visit` within a few seconds.

---

## Step 8 — Regression: prove the exclusion works

After Step 3 + Step 6, human tags must NOT see crawler traffic. Verify in Trace:

1. Start a new Trace.
2. Fire an event with a HUMAN UA and no `bot_detected`:
   ```bash
   curl -A "Mozilla/5.0 (Windows NT 10.0) Chrome/126" https://racing-f1-rho.vercel.app/tickets
   ```
3. Trace should show GA4/Meta tags fired (as normal).
4. Fire an event with a crawler UA:
   ```bash
   curl -A "GPTBot/1.2" https://racing-f1-rho.vercel.app/tickets
   ```
5. Trace should show **GA4/Meta skipped** (`bot_detected != true` load rule blocked them) and
   only the `AI Crawler Traffic` load rule matched.

---

## Troubleshooting matrix

| Symptom | Likely cause | Fix |
|---|---|---|
| Trace shows event received but no Load Rule matched | Variable name typo (case-sensitive) | Recheck Step 1 — must be `bot_detected`, not `BotDetected` |
| Live Events shows the event with values missing | Variable not created in Data Layer | Add the missing variable, re-publish |
| `curl` to Collect returns 4xx | Wrong `tealium_account` / `tealium_profile` | Confirm both in the payload |
| Middleware sending events but nothing in Live Events | `TEALIUM_COLLECT_URL` still points at `/api/bot-collect` | Do Step 7A or 7B |
| GA4 also firing on crawler hits | Step 3 not applied to that tag | Add the negative load rule to that tag, publish |
| Trace ID never populates | `cp.trace_id` missing or malformed | Ensure it's inside the JSON payload, exactly as `cp.trace_id` |

---

## Reference (all Tealium docs used above)

- [Data Layer — Manage variables](https://docs.tealium.com/iq-tag-management/data-layer/manage-variables/) · [Variable types](https://docs.tealium.com/iq-tag-management/data-layer/data-layer-variables/)
- [Load Rules — Manage](https://docs.tealium.com/iq-tag-management/load-rules/manage/)
- [EventStream — Add a data source](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/add-data-source/)
- [EventStream — Add an Event Feed](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/add-feed/)
- [EventStream — Add a connector](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/add-connector/)
- [Trace — Test with Trace](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/test-trace/)
- [Trace (EventStream)](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/trace/)
- [Collect HTTP API v1 — Endpoint](https://docs.tealium.com/platforms/http-api/endpoint/)
- [Validate and troubleshoot tags](https://docs.tealium.com/iq-tag-management/troubleshooting/validate-tags/)
