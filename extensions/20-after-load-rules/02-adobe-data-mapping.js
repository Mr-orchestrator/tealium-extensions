/**
 * @tealium-extension
 * @id 21
 * @name Adobe Data Mapping
 * @scope After Load Rules
 * @order 2
 * @loadRule all
 * @creates adobe_events, adobe_products, adobe_eVar_email, adobe_eVar_tier, adobe_pageName
 * @uses consent_analytics, customer_email, customer_tier, customer_id, product_id, product_name, product_price, page_name, order_id, order_total, tealium_event
 * @tagCategory Analytics
 * @feedsTag AdobeAnalytics
 * @risk medium
 * @description Maps the flat UDO to Adobe Analytics / AEP variables (events, products
 *   string, eVars). GATED on `consent_analytics`. Runs After Load Rules so identity +
 *   enrichment variables are present. Mirrors the Adobe XDM event model used by the
 *   F1 Racing Store Web SDK implementation.
 *
 * Tealium scope: After Load Rules. Feeds tag: Adobe Analytics (Analytics).
 */
(function (a, b) {
  if (b.consent_analytics !== '1') return; // consent gate

  var eventMap = {
    ProductView: 'prodView',
    AddToCart: 'scAdd',
    RemoveFromCart: 'scRemove',
    BeginCheckout: 'scCheckout',
    Purchase: 'purchase'
  };
  b.adobe_events = eventMap[b.tealium_event] || 'pageView';
  b.adobe_pageName = b.page_name || '';
  b.adobe_eVar_email = b.customer_email || '';
  b.adobe_eVar_tier = b.customer_tier || '';

  // Adobe "products" string: Category;Product;Quantity;Price
  if (b.product_id) {
    b.adobe_products =
      (b.product_category || '') + ';' + b.product_id + ';1;' + (b.product_price || '0');
  }
  if (b.tealium_event === 'Purchase' && b.order_id) {
    b.adobe_events += ',purchase';
  }
})(a, b);
