/**
 * @tealium-extension
 * @id 20
 * @name GA4 Ecommerce Mapping
 * @scope After Load Rules
 * @order 1
 * @loadRule all
 * @creates ga4_event_name, ga4_items, ga4_value, ga4_currency, ga4_user_id
 * @uses consent_analytics, customer_id, product_id, product_name, product_price, cart_total, order_id, order_total, order_currency, tealium_event
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

  var map = {
    ProductView: 'view_item',
    AddToCart: 'add_to_cart',
    RemoveFromCart: 'remove_from_cart',
    BeginCheckout: 'begin_checkout',
    Purchase: 'purchase'
  };
  b.ga4_event_name = map[b.tealium_event] || 'page_view';
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
