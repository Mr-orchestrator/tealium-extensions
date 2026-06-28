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
 *   automatically via utag.js; this bridges every post-load INTERACTION (utag.link). It wraps
 *   window.adobeDataLayer.push ONCE and, for each tracked event — ProductView, AddToCart,
 *   RemoveFromCart, BeginCheckout, Purchase, User logged in/out, Search — and each element
 *   event from the site's `data-track` attribute (action_type "rf1_*"), maps the event's
 *   attributes onto the data layer and calls utag.link(). Idempotent (guards re-wrapping on
 *   every utag call). This is what makes SPA events + element/click tracking reach the tags.
 *
 * Tealium scope: Pre Loader (wrap set up early; utag.link fires once utag is ready).
 *   NOTE: Pre Loader code is NOT wrapped in function(a,b) — this is a no-arg IIFE and works
 *   only off window/utag (it never touches the data layer `b`, which does not exist yet).
 */
(function () {
  if (window._f1_event_bridge) return;
  window._f1_event_bridge = true;

  var TRACKED = {
    'ProductView': 1, 'AddToCart': 1, 'RemoveFromCart': 1, 'BeginCheckout': 1,
    'Purchase': 1, 'User logged in': 1, 'User logged out': 1, 'Search performed': 1
  };

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
    if (!p || typeof p !== 'object') return;
    var ev = p.event;
    if (!ev) return;
    // named interaction events OR data-track element events ("rf1_*")
    if (!(TRACKED[ev] || /^rf1_/.test(ev))) return;
    if (!(window.utag && typeof utag.link === 'function')) return; // utag not ready yet
    var data = { tealium_event: ev };
    var attrs = p.attributes || p.data || {};
    for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) data[k] = attrs[k]; }
    utag.link(data);
  }
})();
