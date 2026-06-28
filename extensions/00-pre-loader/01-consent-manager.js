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
 *   PRIMARY source is Tealium's native Consent Management (utag.gdpr) — when you enable
 *   Consent Management in the profile and assign tags to categories, Tealium gates tags
 *   natively and this extension mirrors that decision into the data layer (defence in depth).
 *   Falls back, in order, to other FREE sources so the same code works in any setup:
 *     1. Tealium native — utag.gdpr.getConsentState()
 *     2. orestbida CookieConsent (free OSS CMP) — CookieConsent.acceptedCategory()
 *     3. Google Consent Mode v2 — window.googleConsent {analytics_storage, ad_storage}
 *     4. GridBox data layer — gridbox_data.consent {analytics, marketing}
 *     5. Default — window.F1_CONSENT_DEFAULT ('granted' for QA before consent is live;
 *        'denied' in production for GDPR/CCPA safety).
 *   Analytics/Marketing tags gate on these flags (policy/consent-rules.yaml). Runs first in
 *   Pre Loader so no tag fires ahead of the consent decision.
 *
 * Tealium scope: Pre Loader. NOTE: Pre Loader code is NOT wrapped in function(a,b) and the
 *   data layer `b` does not exist yet (see docs.tealium.com). So this runs as a no-arg IIFE,
 *   reads consent from window-level sources, and writes the flags onto `window.utag_data` —
 *   Tealium merges utag_data into the data layer, so the flags reach `b` for every downstream
 *   extension and the native tag gates.
 */
(function () {
  var utag_data = window.utag_data = window.utag_data || {};
  var gb = window.gridbox_data || {};
  var c = fromTealium() || fromCookieConsent() || fromConsentMode() || fromGridbox(gb) || fromDefault();

  utag_data.consent_analytics = c.analytics ? '1' : '0';
  utag_data.consent_marketing = c.marketing ? '1' : '0';
  utag_data.consent_status = (c.analytics && c.marketing) ? 'granted' : (c.analytics || c.marketing) ? 'partial' : 'denied';
  window._f1_consent = { analytics: c.analytics, marketing: c.marketing, status: utag_data.consent_status, source: c.source };

  // 1. Tealium native Consent Management
  function fromTealium() {
    if (!(window.utag && utag.gdpr && typeof utag.gdpr.getConsentState === 'function')) return null;
    var st = utag.gdpr.getConsentState();
    if (st === 1) return { analytics: true, marketing: true, source: 'tealium' };
    if (st === -1 || st === 0) return { analytics: false, marketing: false, source: 'tealium' };
    if (Array.isArray(st)) {
      var on = function (n) { var x = st.filter(function (o) { return o.name === n; })[0]; return !!(x && (x.ct === '1' || x.ct === 1)); };
      return { analytics: on('analytics'), marketing: on('marketing') || on('ads') || on('display_ads'), source: 'tealium' };
    }
    return null;
  }
  // 2. orestbida CookieConsent (free CMP)
  function fromCookieConsent() {
    if (!(window.CookieConsent && typeof window.CookieConsent.acceptedCategory === 'function')) return null;
    return {
      analytics: window.CookieConsent.acceptedCategory('analytics'),
      marketing: window.CookieConsent.acceptedCategory('ads') || window.CookieConsent.acceptedCategory('marketing'),
      source: 'cookieconsent'
    };
  }
  // 3. Google Consent Mode v2 bridge
  function fromConsentMode() {
    if (!window.googleConsent) return null;
    return { analytics: window.googleConsent.analytics_storage === 'granted', marketing: window.googleConsent.ad_storage === 'granted', source: 'consent-mode' };
  }
  // 4. GridBox data layer
  function fromGridbox(g) {
    if (!g.consent) return null;
    return {
      analytics: g.consent.analytics === true || g.consent.analytics === 'granted',
      marketing: g.consent.marketing === true || g.consent.marketing === 'granted',
      source: 'gridbox'
    };
  }
  // 5. Default (no CMP yet)
  function fromDefault() {
    var granted = (window.F1_CONSENT_DEFAULT || 'denied') === 'granted';
    return { analytics: granted, marketing: granted, source: 'default' };
  }
})();
