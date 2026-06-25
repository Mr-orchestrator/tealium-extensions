/**
 * @tealium-extension
 * @id 12
 * @name Page Data
 * @scope Before Load Rules
 * @order 3
 * @loadRule all
 * @creates page_name, page_type, page_category, site_section
 * @uses gridbox_data, tealium_event
 * @risk low
 * @description Derives page-level context (name / type / category / section) for the
 *   F1 Racing Store from the GridBox page object, with a URL-path fallback so server
 *   or SPA navigations still classify correctly.
 *
 * Tealium scope: Before Load Rules.
 */
(function (a, b) {
  var gb = (b && b.gridbox_data) || window.gridbox_data || {};
  var page = gb.page || {};
  var path = (window.location && window.location.pathname) || '/';

  b.page_name = String(page.name || document.title || path);
  b.page_type = String(page.type || classify(path));
  b.page_category = String(page.category || '');
  b.site_section = String(path.split('/')[1] || 'home');

  function classify(p) {
    if (/merchandise|product/.test(p)) return 'product';
    if (/cart/.test(p)) return 'cart';
    if (/checkout/.test(p)) return 'checkout';
    if (/confirmation/.test(p)) return 'purchase';
    if (p === '/' || /index/.test(p)) return 'home';
    return 'content';
  }
})(a, b);
