# Consent Configuration — Tealium iQ (F1 Racing Store · GA4 + Meta)

End-to-end consent setup: how the banner sends values to Tealium, which extensions run in
what order, which variables to create, what to map on the tags, and how Tealium gates GA4 +
Meta by consent. (Adobe is **not** here — it is collected via Adobe Data Collection / Web SDK.)

---

## 1. The consent flow (banner → Tealium → tags)

```
┌──────────────┐  user choice   ┌─────────────────────────────┐
│ Consent      │ ─────────────▶ │ Tealium consent state        │
│ banner       │                │ utag.gdpr (cookie)           │
└──────────────┘                └─────────────┬───────────────┘
                                               │ read in Pre Loader
                                               ▼
                         ┌───────────────────────────────────────┐
                         │ Consent Manager extension (order 1)    │
                         │  → consent_analytics / consent_marketing│
                         └─────────────┬─────────────────────────┘
                                       ▼
   Before Load Rules → After Load Rules mapping extensions (gate on the flags)
                                       ▼
                 Tealium gates each TAG by its consent category (native)
                 analytics → GA4   ·   marketing → Meta Pixel
```

Two layers of protection: **Tealium gates the tag by category** (the real enforcement) **and**
the mapping extension returns early if its consent flag is `0` (defence in depth).

---

## 2. Extensions to keep + load order

Keep all **9**, in this scope/order. Consent-relevant ones are ⭐.

| # | Scope | Order | Extension | Role |
|---|---|---|---|---|
| 1 | Pre Loader | 1 | ⭐ **Consent Manager** | reads consent → sets `consent_analytics/marketing` |
| 2 | Pre Loader | 2 | GridBox Data Layer Bridge | gridbox_data → UDO + `tealium_event` |
| 3 | Before Load Rules | 1 | Data Layer Enrichment | product/cart/order/search vars |
| 4 | Before Load Rules | 2 | Identity Resolver | `customer_id/email/tier/visitor_id` |
| 5 | Before Load Rules | 3 | Page Data | `page_name/type/category` |
| 6 | After Load Rules | 1 | ⭐ **GA4 Ecommerce Mapping** | gated on `consent_analytics` → `ga4_*` |
| 7 | After Load Rules | 2 | ⭐ **Meta Pixel Mapping** | gated on `consent_marketing` → `meta_*` |
| 8 | DOM Ready | 1 | Scroll & Click Tracking | engagement events |
| 9 | After Tags | 1 | Cleanup & Diagnostics | post-tag log + scratch cleanup |

The Consent Manager **must stay first in Pre Loader** so no tag fires ahead of the decision
(enforced by `policy/load-order-rules.yaml` + `policy/consent-rules.yaml`).

---

## 3. Variables to create in Tealium (Data Layer)

Tealium iQ → **Data Layer → + Add Variable**. Create as **UDO Variable** (the extensions
populate them on `utag_data`/`b`). These are the variables referenced by the tags + the
consent gates.

**Consent (set by Consent Manager):**
| Variable | Values | Purpose |
|---|---|---|
| `consent_status` | granted / partial / denied | overall, reporting |
| `consent_analytics` | `1` / `0` | gate for GA4 |
| `consent_marketing` | `1` / `0` | gate for Meta |

**Identity & page (set by Identity Resolver / Page Data):**
`customer_id`, `customer_email`, `customer_tier`, `visitor_id`, `login_status`,
`page_name`, `page_type`, `page_category`, `site_section`

**Commerce (set by Data Layer Enrichment):**
`product_id`, `product_name`, `product_category`, `product_brand`, `product_price`,
`cart_total`, `cart_item_count`, `order_id`, `order_total`, `order_currency`, `search_term`

**GA4 output (set by GA4 Ecommerce Mapping):**
`ga4_event_name`, `ga4_items`, `ga4_value`, `ga4_currency`, `ga4_user_id`

**Meta output (set by Meta Pixel Mapping):**
`meta_event_name`, `meta_content_ids`, `meta_value`, `meta_currency`

> `tealium_event` and `gridbox_data` already exist (system / site). You only need to map the
> variables a tag actually consumes — the lists above cover GA4 + Meta + the consent gates.

---

## 4. Configure Consent Management (the native gate)

Tealium iQ → **Client-Side Tools → Consent Management → Get Started**.

1. **Consent model:** choose **Explicit** (opt-in / GDPR) — tags wait until the user accepts.
2. **Categories tab → create two categories** (name them lowercase so they match the extension):
   - `analytics`
   - `marketing`
3. **Assign tags to categories:**
   | Category | Tag |
   |---|---|
   | `analytics` | Google Analytics 4 |
   | `marketing` | Meta Pixel |
4. **Prompt:** enable the built-in **Explicit Consent Prompt** (or **Consent Preferences Dialog**
   for granular toggles) — this is the banner; **no separate CMP is required**.
5. **Save As → Publish to qa.**

At runtime Tealium now blocks each tag until its category is consented, and exposes the state
via `utag.gdpr.getConsentState()` (`1` full · `-1` declined · `0` none · or a per-category
array `[{name, ct}]`). The Consent Manager extension reads exactly this.

---

## 5. Tag mappings (Data Mappings)

For each tag: **Tags → (the tag) → Data Mappings → + Add Mapping** (UDO variable → tag field),
and set the tag's **Consent Category** (step 4) + Measurement/Pixel ID.

### Google Analytics 4 tag (category: `analytics`, ID `G-XXXXXXXXXX`)
| UDO variable | → GA4 field |
|---|---|
| `ga4_event_name` | event name |
| `ga4_items` | items (array) |
| `ga4_value` | value |
| `ga4_currency` | currency |
| `ga4_user_id` | user_id |
| `customer_tier` | user property `tier` (optional) |

### Meta Pixel tag (category: `marketing`, Pixel ID `<numeric>`)
| UDO variable | → Meta field |
|---|---|
| `meta_event_name` | event name (ViewContent / AddToCart / Purchase…) |
| `meta_content_ids` | content_ids |
| `meta_value` | value |
| `meta_currency` | currency |

The extensions already build these `ga4_*` / `meta_*` values; mapping just forwards them.

---

## 6. How the consent banner sends values to Tealium

**Option A — Tealium native prompt (recommended).** The banner IS Tealium (step 4). On Accept,
Tealium writes its consent cookie and `utag.gdpr` state, then fires the queued tags in the
consented categories. Nothing else to wire — the Consent Manager extension reads `utag.gdpr`.

**Option B — external CMP (e.g. CookieConsent) → Tealium.** If you keep a site banner, its
accept callback must push the choice to Tealium and re-run tags. Either:
```js
// In the CMP's onConsent / onChange callback:
utag.gdpr.setPreferencesValues([            // tell Tealium the per-category decision
  { id: 'analytics', value: CookieConsent.acceptedCategory('analytics') ? 1 : 0 },
  { id: 'marketing', value: CookieConsent.acceptedCategory('ads')       ? 1 : 0 }
]);
utag.view(window.utag_data || {});          // re-evaluate tags with the new consent
```
…or simply set `window.googleConsent = {analytics_storage, ad_storage}` and call
`utag.view(...)` — the Consent Manager extension reads that too. **Do not run both banners**
(Tealium's prompt *and* a site CMP) or users see two dialogs.

---

## 7. Step-by-step checklist

1. **Data Layer** — create the variables in §3.
2. **Extensions** — add the 9 via **Add GitHub File** (URLs in `tealium-deployment.md`), each in
   its scope/order from §2.
3. **Tags** — add **GA4** (paste `G-XXXX`) and **Meta** (paste Pixel ID); add the Data Mappings in §5.
4. **Consent Management** — enable, create `analytics` + `marketing`, assign GA4→analytics,
   Meta→marketing, turn on the Explicit Consent Prompt (§4).
5. **Save As → Publish to qa.**
6. **Validate** (§8).

---

## 8. Validate inside Tealium

1. **Before consent:** load the site → the consent prompt shows → confirm **GA4 + Meta do NOT
   fire** (Trace shows them blocked / queued; `consent_analytics`=`0`).
2. **Accept analytics only:** GA4 fires, Meta still blocked (`consent_analytics`=`1`,
   `consent_marketing`=`0`).
3. **Accept all:** both fire.
4. **Trace** (Tealium iQ → Trace) shows the order: Consent Manager → … → GA4/Meta, with the
   consent flags and the tag gating.
5. **Console:** `utag.cfg.utagdb=true` → Cleanup & Diagnostics logs `[F1] event=… consent=…
   ga4=… meta=…`.
6. **GA4 DebugView** (GA4 → Admin → DebugView) confirms hits land after consent.
