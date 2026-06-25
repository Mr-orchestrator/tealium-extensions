/**
 * @tealium-extension
 * @id 30
 * @name Scroll & Click Tracking
 * @scope DOM Ready
 * @order 1
 * @loadRule all
 * @creates scroll_depth, outbound_link, cta_clicked
 * @uses page_name, tealium_event
 * @risk low
 * @description Binds DOM interaction listeners once the DOM is ready: scroll-depth
 *   milestones (25/50/75/100) and outbound / CTA clicks, each firing a utag.link
 *   engagement event. Runs in DOM Ready so the document is available; uses a guard
 *   flag so listeners bind only once per page.
 *
 * Tealium scope: DOM Ready.
 */
(function (a, b) {
  if (window._f1_dom_bound) return;
  window._f1_dom_bound = true;

  var seen = {};
  function onScroll() {
    var h = document.documentElement;
    var pct = Math.round(((h.scrollTop + window.innerHeight) / h.scrollHeight) * 100);
    [25, 50, 75, 100].forEach(function (m) {
      if (pct >= m && !seen[m]) {
        seen[m] = true;
        if (window.utag && utag.link) utag.link({ tealium_event: 'scroll', scroll_depth: m, page_name: b.page_name });
      }
    });
  }
  window.addEventListener('scroll', throttle(onScroll, 250), { passive: true });

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a, button');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var isOutbound = /^https?:\/\//.test(href) && href.indexOf(window.location.host) === -1;
    if (window.utag && utag.link) {
      utag.link({
        tealium_event: 'click',
        outbound_link: isOutbound ? href : '',
        cta_clicked: (el.textContent || '').trim().slice(0, 60),
        page_name: b.page_name
      });
    }
  });

  function throttle(fn, ms) {
    var t = 0;
    return function () { var n = Date.now(); if (n - t > ms) { t = n; fn(); } };
  }
})(a, b);
