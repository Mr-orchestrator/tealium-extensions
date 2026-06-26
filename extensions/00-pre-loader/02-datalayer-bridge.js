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
 * Tealium scope: Pre Loader.
 */
(function (a, b) {
  var gb = (b && b.gridbox_data) || window.gridbox_data ||
           (window.gridboxLayer && window.gridboxLayer.gridbox_data) || {};
  b.gridbox_data = gb; // make the raw object available to enrichment extensions

  // Normalise event name: GridBox `event` -> Tealium `tealium_event` (do not overwrite if set)
  if (gb.event && !b.tealium_event) b.tealium_event = String(gb.event);

  // Environment context
  b.page_url = (window.location && window.location.href) || '';
  b.referrer = (document && document.referrer) || '';
  b.browser_language = (navigator && (navigator.language || navigator.userLanguage)) || '';
})(a, b);
