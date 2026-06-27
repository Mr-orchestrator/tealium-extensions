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
 * @description Resolves visitor consent BEFORE utag loads and exposes normalised flags.
 *   Reads, in priority order, from any of these FREE consent sources:
 *     1. orestbida CookieConsent (free OSS CMP) — window.CookieConsent.acceptedCategory()
 *     2. Google Consent Mode v2 bridge — window.googleConsent {analytics_storage, ad_storage}
 *     3. GridBox data layer — gridbox_data.consent {analytics, marketing}
 *     4. Fallback default — window.F1_CONSENT_DEFAULT ('granted' for QA testing before a CMP
 *        is live; set to 'denied' in production for GDPR/CCPA safety).
 *   Analytics/Marketing tags gate on these flags (policy/consent-rules.yaml). Runs first in
 *   Pre Loader so no tag fires ahead of the consent decision.
 *
 * Tealium scope: Pre Loader.  a = event type, b = data layer (utag_data).
 */
(function (a, b) {
  var gb = (b && b.gridbox_data) || window.gridbox_data || {};
  var analytics, marketing;

  if (window.CookieConsent && typeof window.CookieConsent.acceptedCategory === 'function') {
    analytics = window.CookieConsent.acceptedCategory('analytics');
    marketing = window.CookieConsent.acceptedCategory('ads') || window.CookieConsent.acceptedCategory('marketing');
  } else if (window.googleConsent) {
    analytics = window.googleConsent.analytics_storage === 'granted';
    marketing = window.googleConsent.ad_storage === 'granted';
  } else if (gb.consent) {
    analytics = gb.consent.analytics === true || gb.consent.analytics === 'granted';
    marketing = gb.consent.marketing === true || gb.consent.marketing === 'granted';
  } else {
    var granted = (window.F1_CONSENT_DEFAULT || 'denied') === 'granted';
    analytics = granted;
    marketing = granted;
  }

  b.consent_analytics = analytics ? '1' : '0';
  b.consent_marketing = marketing ? '1' : '0';
  b.consent_status = (analytics && marketing) ? 'granted' : (analytics || marketing) ? 'partial' : 'denied';
  window._f1_consent = { analytics: analytics, marketing: marketing, status: b.consent_status };
})(a, b);
