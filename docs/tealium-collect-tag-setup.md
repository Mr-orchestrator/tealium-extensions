# Tealium Collect — Precise Setup Guide

> You said "I have not enabled the Collect tag" — this walks you through **exactly** what to
> enable, in what order, and what to expect at each step. Includes the important distinction
> between two things Tealium calls "Collect".

## First, the naming trap (this matters)

Two different things share the name "Collect":

| Name | What it is | Where it runs | Auth | Use case |
|---|---|---|---|---|
| **Tealium Collect HTTP API** | An HTTPS endpoint at `https://collect.tealiumiq.com/event` | Server → Tealium | None (v1) / API key (v3) | Server-side events (**your crawler detection**) |
| **Tealium Collect Tag** | A client-side tag installed via iQ Tag Management | Browser (utag.js) → Tealium | Uses your profile config | Send site UDO events from utag.js into EventStream |

**For AI-crawler detection you do NOT need the client-side Collect Tag.** The middleware POSTs
directly to the HTTP API endpoint. You only need the client-side tag if you also want your
regular site traffic (page views, add-to-carts, etc.) flowing into EventStream — that's a
separate, additive step.

Reference: [Tealium Collect HTTP API v1](https://docs.tealium.com/platforms/http-api/) · [Tealium Collect Tag](https://docs.tealium.com/client-side-tags/tealium-collect-tag/).

---

## Step 0 — Precheck: is EventStream provisioned on your account?

The Collect HTTP API endpoint **always accepts POSTs** (returns HTTP 200) — but if EventStream
is not provisioned on `cognizant-sandbox`, the events never appear anywhere. That's a common
gotcha and it looks like your setup is doing something wrong when actually the plumbing works.

**Check:** log into [my.tealiumiq.com](https://my.tealiumiq.com), open profile `f1racing`,
look at the left navigation:

| You see… | Meaning | Do this |
|---|---|---|
| `EventStream`, `Server-Side`, `DataAccess`, `Live Events`, `Sources`, `Connectors` in the left nav | **EventStream is provisioned** — proceed to Step 1 | ✓ ready |
| Only iQ / Data Layer / Load Rules / Tags — nothing else | **EventStream not provisioned** | Contact your Tealium account team to enable EventStream (it's a paid module) — or use the self-hosted `/api/bot-collect` receiver as an audit log until you have it |

If EventStream isn't provisioned, **the crawler detection still works** — you just can't route
the events through the Tealium UI. The middleware's `/api/bot-collect` self-hosted receiver is
already logging every hit via `vercel logs`, so nothing is lost while you sort out provisioning.

---

## Step 1 — Enable the HTTP API endpoint by creating a Data Source (required for EventStream)

The Collect HTTP API endpoint is public, but Tealium routes events to your profile only when it
recognises them as coming from a **registered data source**. Creating one gives you a
`data_source_key` you'll add to the middleware payload for attribution.

**Where:** left nav → **Sources** → **Data Sources** → **+ Add Data Source**

- **Categories** side panel → **Developer Languages** → **HTTP API** → click **Continue**
- **Data Source Name:** `AI Crawler Server-Side`
- **Data Source Description:** `Server-side AI crawler visits from Vercel Edge middleware`
- Click **Save & Continue**
- The next screen shows a **Data Source Key** (looks like `abc123-def456`). **Copy it.**
- Click **Save**.

Reference: [Add a data source](https://docs.tealium.com/server-side/getting-started/eventstream-api-hub/add-data-source/).

**After this**, `POST` events with `tealium_datasource: "<the key>"` in the JSON will be
attributed to this source and become visible in Live Events. Without it, events land in the
"unregistered / anonymous" bucket that most Tealium accounts don't route.

**Update the middleware to include it (one env var):**
```bash
cd racing-f1
vercel env add TEALIUM_DATA_SOURCE_KEY production
# value: <paste the Data Source Key>
vercel --prod --yes
```
(The middleware already reads `TEALIUM_DATA_SOURCE_KEY` and includes it in the payload — see
`lib/bot-detection.js → buildCollectEvent` after this session's update.)

---

## Step 2 — (Optional) Enable the CLIENT-SIDE Tealium Collect Tag

**Only do this if you also want your regular site traffic to flow into EventStream** (not
required for crawler detection).

**Where:** iQ Tag Management → **Tags** → **+ Add Tag** → search **"Tealium Collect"**
→ select **Tealium Collect Tag** → click **Continue**.

Fill in the config:

| Field | Value |
|---|---|
| **Title** | `Tealium Collect — site traffic` |
| **Account** | `cognizant-sandbox` (auto-filled) |
| **Profile** | `f1racing` (auto-filled) |
| **Environment** | `qa` first, then `prod` |
| **Data Source Key** | *(create a second data source for the site's client-side traffic — do NOT reuse the crawler one; they should be separately auditable)* |
| **Load Rules** | Attach `All Pages` (or your existing "human traffic" load rule) |

Click **Save**.

Reference: [Tealium Collect Tag Setup Guide](https://docs.tealium.com/client-side-tags/tealium-collect-tag/).

**After this**, every `utag.view` / `utag.link` on the F1 site also becomes an EventStream event
alongside the crawler events. Separate data source keys let you filter one from the other.

---

## Step 3 — Verify the endpoint is receiving

Two ways.

**A. Live Events UI (fastest)**
- Left nav → **EventStream** → **Live Events** (or **Sources → your source → Live Events**).
- Fire a test event from your terminal (below).
- The event should appear within ~5 seconds.

**B. Terminal test with a real POST**
```bash
curl -X POST https://collect.tealiumiq.com/event \
  -H "Content-Type: application/json" \
  -d '{
    "tealium_account": "cognizant-sandbox",
    "tealium_profile": "f1racing",
    "tealium_datasource": "<PASTE_KEY>",
    "tealium_event": "ai_crawler_visit",
    "bot_detected": "true",
    "bot_name": "GPTBot",
    "bot_vendor": "OpenAI",
    "bot_class": "crawler",
    "page_url": "https://racing-f1-rho.vercel.app/tickets",
    "page_path": "/tickets",
    "user_agent": "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "timestamp_iso": "2026-07-01T02:50:00Z"
  }'
```
Expected response: `{"success":true, ...}` or HTTP 200 with an empty body.

If Live Events shows nothing, the data source key is missing or wrong — re-check Step 1.

Reference: [Endpoint Specification](https://docs.tealium.com/platforms/http-api/endpoint/) · [Validate & troubleshoot](https://docs.tealium.com/iq-tag-management/troubleshooting/validate-tags/).

---

## Step 4 — Flip the middleware to Tealium (Step 7 in the main runbook)

```bash
cd racing-f1
vercel env rm TEALIUM_COLLECT_URL production
vercel env add TEALIUM_COLLECT_URL production
# value: https://collect.tealiumiq.com/event
vercel --prod --yes
```

Or keep the local audit AND forward to Tealium:
```bash
vercel env add TEALIUM_COLLECT_FORWARD_URL production
# value: https://collect.tealiumiq.com/event
vercel --prod --yes
```

Fire a real crawler UA:
```bash
curl -A "Mozilla/5.0 (compatible; GPTBot/1.2)" https://racing-f1-rho.vercel.app/tickets
```
→ Watch **Live Events** in Tealium. Should show one `ai_crawler_visit` within ~5 seconds.

---

## What to do if you don't have EventStream

Everything up to this point still works — the middleware detects, logs to Vercel, and
`/api/bot-collect` echoes. Two options:

1. **Contact Tealium** and add EventStream/DataAccess to `cognizant-sandbox`. Then re-do Steps 1–4.
2. **Stay self-hosted**: leave `TEALIUM_COLLECT_URL=/api/bot-collect`, use `vercel logs` for
   audit. If you later need durable storage, route `api/bot-collect.js` to an S3/BigQuery/Slack
   webhook directly (no Tealium needed for the pipe).
