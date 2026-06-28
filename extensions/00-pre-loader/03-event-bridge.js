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
 *   SOURCE = window.gridboxLayer.event[] — the site's OWN canonical event array
 *   (racing-f1/analytics.js). We deliberately do NOT touch window.adobeDataLayer: that stream
 *   belongs to Adobe Launch (separate use-case). Every fired GridBox event (commerce classes +
 *   gb_<category>_<action>_<label> element/`data-track` clicks via the event callback) lands in
 *   gridboxLayer.event[] as a W3C record
 *   `{ category:{primaryCategory}, eventInfo:{key,eventName}, attributes:[{key,value}…] }`.
 *   We wrap event.push ONCE, flatten the attributes array, set `tealium_event` to the stable
 *   `eventInfo.key`, and call utag.link(). PageView records are skipped (utag.js owns the view).
 *
 * Tealium scope: Pre Loader. NOTE: Pre Loader code is NOT wrapped in function(a,b) — this is a
 *   no-arg IIFE off window/utag (it never touches the data layer `b`, which does not exist yet).
 *   We NEVER create window.gridboxLayer ourselves — doing so would short-circuit the site's own
 *   `window.gridboxLayer = window.gridboxLayer || {…}` init. We wait until the site defines it.
 */
(function () {
  if (window._f1_event_bridge) return;

  // Wrap as soon as the site's gridboxLayer.event array exists; poll briefly otherwise.
  if (!tryWrap()) {
    var n = 0;
    var t = setInterval(function () { if (tryWrap() || ++n > 100) clearInterval(t); }, 50);
  }

  function tryWrap() {
    if (window._f1_event_bridge) return true;
    var gl = window.gridboxLayer;
    if (!gl || !Array.isArray(gl.event)) return false; // site hasn't initialised yet
    window._f1_event_bridge = true;
    var arr = gl.event;
    var origPush = arr.push;
    arr.push = function () {
      var ret = origPush.apply(this, arguments);
      for (var i = 0; i < arguments.length; i++) forward(arguments[i]);
      return ret;
    };
    // forward anything already queued before the wrap
    for (var j = 0; j < arr.length; j++) forward(arr[j]);
    return true;
  }

  function forward(ev) {
    if (!ev || typeof ev !== 'object' || !ev.eventInfo) return; // only GridBox event records
    if (!(window.utag && typeof utag.link === 'function')) return; // utag not ready yet
    var cat = ev.category && ev.category.primaryCategory;
    if (cat === 'PageView') return; // the page view is fired by utag.js, not as a link event

    // Stable identifier: eventInfo.key (AddToCart / gb_cart_add_label) → eventName.
    var data = { tealium_event: ev.eventInfo.key || ev.eventInfo.eventName };
    if (cat) data.event_primary_category = cat;

    // Flatten the W3C attributes array [{key,value}] onto the flat data layer.
    var attrs = ev.attributes;
    if (Array.isArray(attrs)) {
      for (var i = 0; i < attrs.length; i++) {
        var a = attrs[i];
        if (a && a.key != null) data[a.key] = a.value;
      }
    } else if (attrs && typeof attrs === 'object') {
      for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) data[k] = attrs[k]; }
    }
    utag.link(data);
  }
})();
