/**
 * @tealium-extension
 * @id 20
 * @name GA4 Ecommerce Mapping
 * @scope After Load Rules
 * @order 1
 * @loadRule all
 * @creates ga4_event_name, ga4_items, ga4_value, ga4_currency, ga4_user_id
 * @uses consent_analytics, customer_id, product_id, product_name, product_price, cart_total, order_id, order_total, order_currency, tealium_event, eventCategory, eventAction
 * @tagCategory Analytics
 * @feedsTag GA4
 * @risk medium
 * @description Builds GA4 (gtag) recommended ecommerce parameters from the flat UDO.
 *   GATED on `consent_analytics` — if analytics consent is not granted the GA4 params
 *   are not produced, so the GA4 tag's load rule yields no data (policy/consent-rules.yaml).
 *   Runs After Load Rules so all enrichment + identity variables already exist.
 *
 * Tealium scope: After Load Rules. Feeds tag: Google Analytics 4 (Analytics).
 */
(function (a, b) {
  if (b.consent_analytics !== '1') return; // consent gate — no analytics without consent

  // Commerce funnel → GA4 recommended events. Keyed on the identifier the Event Bridge sets
  // as tealium_event — the GridBox stable key OR the human event name (racing-f1/analytics.js).
  // The site emits MIXED identifiers for the funnel: some stable (AddToCart), some gb_ keys
  // (gb_checkout_begin, gb_purchase_complete). Cover every form so none fall through to page_view.
  var COMMERCE = {
    ProductView: 'view_item', 'Product viewed': 'view_item',
    AddToCart: 'add_to_cart', 'Add to cart': 'add_to_cart',
    TicketAddedToCart: 'add_to_cart', 'Ticket added to cart': 'add_to_cart',
    MerchandiseAddedToCart: 'add_to_cart', 'Merchandise added to cart': 'add_to_cart',
    RemoveFromCart: 'remove_from_cart', 'Remove from cart': 'remove_from_cart',
    BeginCheckout: 'begin_checkout', 'Begin checkout': 'begin_checkout',
    gb_checkout_begin: 'begin_checkout',
    Purchase: 'purchase', 'Purchase completed': 'purchase',
    gb_purchase_complete: 'purchase'
  };
  if (COMMERCE[b.tealium_event]) {
    b.ga4_event_name = COMMERCE[b.tealium_event];
  } else if (b.eventCategory && b.eventAction) {
    // Dynamic GA4 name from the site's gb_<category>_<action> contract (auto-mapping, no map edit).
    var norm = function (s) { return String(s).trim().replace(/\s+/g, '_').toLowerCase(); };
    b.ga4_event_name = 'ga4_' + norm(b.eventCategory) + '_' + norm(b.eventAction);
  } else {
    b.ga4_event_name = 'page_view';
  }
  b.ga4_currency = b.order_currency || 'USD';
  b.ga4_user_id = b.customer_id || '';

  if (b.product_id) {
    b.ga4_items = [{
      item_id: b.product_id,
      item_name: b.product_name || '',
      item_brand: b.product_brand || '',
      item_category: b.product_category || '',
      price: parseFloat(b.product_price || '0')
    }];
  }
  b.ga4_value = parseFloat(b.order_total || b.cart_total || b.product_price || '0');
})(a, b);
