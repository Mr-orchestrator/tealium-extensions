/**
 * @tealium-extension
 * @id 3
 * @name GridBox Event Bridge
 * @scope Pre Loader
 * @order 3
 * @loadRule all
 * @creates none
 * @uses tealium_event
 * @risk medium
 * @description Forwards the F1 GridBox event stream into Tealium. The page VIEW fires
 *   automatically via utag.js; this bridges every post-load INTERACTION (utag.link).
 *   The site (racing-f1/analytics.js) routes EVERY fired event through one chokepoint —
 *   pushToAdobeDataLayer() — onto window.adobeDataLayer, with shape
 *   `{ event, eventInfo:{eventName,key,category}, attributes:{...flat} }`. Element/`data-track`
 *   clicks arrive as the site's gb_<category>_<action>_<label> contract and carry flat
 *   `eventCategory/eventAction/eventLabel` in attributes. We wrap push ONCE, forward every
 *   GridBox-shaped event (identified by `eventInfo`) to utag.link, set `tealium_event` to the
 *   stable key (or event name), and spread the attributes onto the data layer. Idempotent.
 *
 * Tealium scope: Pre Loader (wrap set up early; utag.link fires once utag is ready).
 *   NOTE: Pre Loader code is NOT wrapped in function(a,b) — this is a no-arg IIFE and works
 *   only off window/utag (it never touches the data layer `b`, which does not exist yet).
 */
(function () {
  if (window._f1_event_bridge) return;
  window._f1_event_bridge = true;

  var dl = window.adobeDataLayer = window.adobeDataLayer || [];
  var origPush = dl.push;
  dl.push = function () {
    var ret = origPush.apply(this, arguments);
    for (var i = 0; i < arguments.length; i++) forward(arguments[i]);
    return ret;
  };
  // forward anything already queued before the wrap
  for (var j = 0; j < dl.length; j++) forward(dl[j]);

  function forward(p) {
    if (!p || typeof p !== 'object' || !p.eventInfo) return; // only GridBox-shaped events
    if (!(window.utag && typeof utag.link === 'function')) return; // utag not ready yet
    var info = p.eventInfo;
    var attrs = p.attributes || p.data || {};
    // Stable identifier: eventInfo.key (e.g. AddToCart / gb_cart_add_label) → eventName → event.
    var data = { tealium_event: info.key || info.eventName || p.event };
    if (info.category && !attrs.eventCategory) data.event_primary_category = info.category;
    for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) data[k] = attrs[k]; }
    utag.link(data);
  }
})();
