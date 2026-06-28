/**
 * @tealium-extension
 * @id 2
 * @name GridBox Data Layer Bridge
 * @scope Pre Loader
 * @order 2
 * @loadRule all
 * @creates page_url, referrer, browser_language
 * @uses gridbox_data, tealium_event
 * @risk medium
 * @description Bridges the F1 Racing Store GridBox / adobeDataLayer into the Tealium UDO
 *   so load rules and every downstream extension/tag read one consistent data layer.
 *   Normalises the GridBox event name into `tealium_event` and seeds environment context.
 *   Runs in Pre Loader after Consent Manager (consent reads gridbox_data directly, so the
 *   decision is already available). gridbox_data itself is an external input (set by the site).
 *
 * Tealium scope: Pre Loader. NOTE: Pre Loader code is NOT wrapped in function(a,b) and `b`
 *   does not exist yet (see docs.tealium.com). This MUST run here so window.utag_data is
 *   populated before Tealium assembles the data layer; it writes the bridged values onto
 *   window.utag_data, which Tealium then merges into `b`.
 */
(function () {
  var utag_data = window.utag_data = window.utag_data || {};
  var gb = window.gridbox_data ||
           (window.gridboxLayer && window.gridboxLayer.gridbox_data) || {};
  utag_data.gridbox_data = gb; // make the raw object available to enrichment extensions

  // Normalise event name: GridBox `event` -> Tealium `tealium_event` (do not overwrite if set)
  if (gb.event && !utag_data.tealium_event) utag_data.tealium_event = String(gb.event);

  // Environment context
  utag_data.page_url = (window.location && window.location.href) || '';
  utag_data.referrer = (document && document.referrer) || '';
  utag_data.browser_language = (navigator && (navigator.language || navigator.userLanguage)) || '';
})();
