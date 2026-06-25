/**
 * @tealium-extension
 * @id 1
 * @name Consent Manager
 * @scope Pre Loader
 * @order 1
 * @loadRule all
 * @creates consent_status, consent_analytics, consent_marketing
 * @uses gridbox_data, tealium_event
 * @protected true
 * @risk critical
 * @description Reads the visitor consent state BEFORE utag loads and exposes a
 *   normalised consent object. Analytics / Marketing tags must gate on these
 *   flags (enforced by policy/consent-rules.yaml). Runs first in Pre Loader so
 *   no tag can fire ahead of the consent decision.
 *
 * Tealium scope: Pre Loader.  Variables in scope: a = event type, b = data layer (utag_data).
 */
(function (a, b) {
  // F1 Racing Store exposes consent on the GridBox data layer (CMP-agnostic).
  var gb = (b && b.gridbox_data) || (window.gridbox_data) || {};
  var cmp = gb.consent || {};

  // Normalise to explicit booleans — default to DENIED until the CMP says otherwise (GDPR-safe).
  var analytics = cmp.analytics === true || cmp.analytics === 'granted';
  var marketing = cmp.marketing === true || cmp.marketing === 'granted';

  b.consent_status = analytics || marketing ? 'partial' : 'denied';
  if (analytics && marketing) b.consent_status = 'granted';
  b.consent_analytics = analytics ? '1' : '0';
  b.consent_marketing = marketing ? '1' : '0';

  // Expose to later scopes / tag templates.
  window._f1_consent = { analytics: analytics, marketing: marketing, status: b.consent_status };
})(a, b);
