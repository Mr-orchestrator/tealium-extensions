/**
 * @tealium-extension
 * @id 22
 * @name Meta Pixel Mapping
 * @scope After Load Rules
 * @order 2
 * @loadRule all
 * @creates meta_event_name, meta_content_ids, meta_value, meta_currency
 * @uses consent_marketing, product_id, product_price, order_total, order_currency, tealium_event
 * @tagCategory Marketing
 * @feedsTag MetaPixel
 * @risk medium
 * @description Maps the flat UDO to Meta (Facebook) Pixel standard events. GATED on
 *   `consent_marketing` — no marketing data is produced without marketing consent
 *   (policy/consent-rules.yaml). Runs After Load Rules so enrichment + identity are present.
 *   Completes the consent story alongside the analytics gate (GA4).
 *
 * Tealium scope: After Load Rules. Feeds tag: Meta Pixel (Marketing).
 */
(function (a, b) {
  if (b.consent_marketing !== '1') return; // marketing consent gate

  var map = {
    ProductView: 'ViewContent',
    AddToCart: 'AddToCart',
    BeginCheckout: 'InitiateCheckout',
    Purchase: 'Purchase'
  };
  b.meta_event_name = map[b.tealium_event] || 'PageView';
  b.meta_currency = b.order_currency || 'USD';
  if (b.product_id) b.meta_content_ids = [b.product_id];
  b.meta_value = parseFloat(b.order_total || b.product_price || '0');
})(a, b);
