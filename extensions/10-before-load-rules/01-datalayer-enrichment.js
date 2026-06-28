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

  // Two shapes feed this extension:
  //  • page VIEW  → nested gridbox_data.{product,cart,transaction} (from the Bridge)
  //  • INTERACTION (utag.link) → FLAT event attributes already on `b` (from the Event Bridge)
  // Flat values take precedence: an event attribute describes the current action, the page
  // object describes the page. `pick(flat, nested)` keeps existing `b.*` if already set.
  function pick(flat, nested) { return flat != null && flat !== '' ? flat : nested; }

  // Product context (product / cart events)
  var pid = pick(b.product_id, prod.id);
  if (pid != null) b.product_id = String(pid);
  var pname = pick(b.product_name, prod.name);
  if (pname != null) b.product_name = String(pname);
  var pcat = pick(b.product_category, prod.category);
  if (pcat != null) b.product_category = String(pcat);
  var pbrand = pick(b.product_brand, prod.brand);
  if (pbrand != null) b.product_brand = String(pbrand);
  var pprice = pick(b.product_price, prod.price);
  if (pprice != null) b.product_price = String(pprice);

  // Cart context
  var ctotal = pick(b.cart_total, cart.total);
  if (ctotal != null) b.cart_total = String(ctotal);
  var ccount = pick(b.cart_item_count, cart.itemCount);
  if (ccount != null) b.cart_item_count = String(ccount);

  // Transaction context (purchase)
  var oid = pick(b.order_id, txn.id);
  if (oid != null) b.order_id = String(oid);
  var ototal = pick(b.order_total, txn.total);
  if (ototal != null) b.order_total = String(ototal);
  b.order_currency = String(b.order_currency || txn.currency || gb.currency || 'USD');

  // Search context
  var term = pick(b.search_term, gb.search_term);
  if (term != null) b.search_term = String(term);
})(a, b);
