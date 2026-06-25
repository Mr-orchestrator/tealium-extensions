/**
 * @tealium-extension
 * @id 40
 * @name Cleanup & Diagnostics
 * @scope After Tags
 * @order 1
 * @loadRule all
 * @creates none
 * @uses consent_status, customer_id, ga4_event_name, adobe_events, tealium_event
 * @risk low
 * @description Runs After all tags have fired: emits a single diagnostic summary (when
 *   utag debug is on) and clears per-event scratch keys so they do not leak into the
 *   next utag.link call in a SPA session. Must stay in After Tags — moving it earlier
 *   would wipe variables the tags still need (enforced by policy/load-order-rules.yaml).
 *
 * Tealium scope: After Tags.
 */
(function (a, b) {
  // Diagnostics (only when Tealium debug is enabled)
  try {
    if (window.utag && utag.cfg && utag.cfg.utagdb) {
      utag.DB('[F1] event=' + b.tealium_event +
        ' consent=' + b.consent_status +
        ' user=' + (b.customer_id || 'anon') +
        ' ga4=' + (b.ga4_event_name || '-') +
        ' adobe=' + (b.adobe_events || '-'));
    }
  } catch (e) { /* never break tag flow */ }

  // Clear per-event scratch keys so SPA link events start clean
  ['ga4_items', 'ga4_value', 'adobe_products', 'product_id', 'product_name', 'product_price', 'search_term']
    .forEach(function (k) { try { delete b[k]; } catch (e) {} });
})(a, b);
