/**
 * @tealium-extension
 * @id 10
 * @name Data Layer Enrichment
 * @scope Before Load Rules
 * @order 1
 * @loadRule all
 * @creates cart_total, cart_item_count, product_id, product_name, product_category, product_brand, product_price, order_id, order_total, order_currency, search_term
 * @uses gridbox_data, tealium_event
 * @risk medium
 * @description Flattens the F1 Racing Store GridBox data layer (gridbox_data ≈ utag_data —
 *   see racing-f1/DATALAYER-ARCHITECTURE.md) into first-class UDO variables so tag mappings
 *   in later scopes do not reach into nested objects. Runs before identity/page so all
 *   downstream extensions and tags read a stable, flat data layer.
 *
 * Tealium scope: Before Load Rules.
 */
(function (a, b) {
  var gb = (b && b.gridbox_data) || window.gridbox_data || {};
  var prod = (gb.product && gb.product[0]) || gb.product || {};
  var cart = gb.cart || {};
  var txn = gb.transaction || {};

  // Product context (product / cart events)
  if (prod.id) b.product_id = String(prod.id);
  if (prod.name) b.product_name = String(prod.name);
  if (prod.category) b.product_category = String(prod.category);
  if (prod.brand) b.product_brand = String(prod.brand);
  if (prod.price != null) b.product_price = String(prod.price);

  // Cart context
  if (cart.total != null) b.cart_total = String(cart.total);
  if (cart.itemCount != null) b.cart_item_count = String(cart.itemCount);

  // Transaction context (purchase)
  if (txn.id) b.order_id = String(txn.id);
  if (txn.total != null) b.order_total = String(txn.total);
  b.order_currency = String(txn.currency || gb.currency || 'USD');

  // Search context
  if (gb.search_term) b.search_term = String(gb.search_term);
})(a, b);
