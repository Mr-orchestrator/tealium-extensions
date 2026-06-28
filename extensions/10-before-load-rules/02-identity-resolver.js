/**
 * @tealium-extension
 * @id 11
 * @name Identity Resolver
 * @scope Before Load Rules
 * @order 2
 * @loadRule all
 * @creates customer_id, customer_email, customer_tier, visitor_id, login_status
 * @uses gridbox_data, tealium_event
 * @protected true
 * @risk high
 * @description Resolves the authenticated identity from the GridBox user object and
 *   exposes the canonical person keys consumed by every analytics/marketing tag.
 *   `customer_id`, `customer_email`, `visitor_id` are PROTECTED (policy/protected.yaml) —
 *   renaming/removing them breaks GA4 + Meta mappings and downstream stitching.
 *
 * Tealium scope: Before Load Rules (after enrichment, before tag mappings).
 */
(function (a, b) {
  var gb = window.gridbox_data || {};

  // Persistent anonymous id (flat: event attr / gridbox / existing UDO).
  b.visitor_id = String(b.visitor_id || gb.anonymous_id || gb.visitor_id || '');

  // Authenticated identity arrives FLAT on the data layer — event attributes `user_id` /
  // `user_email` (forwarded by the Event Bridge) or a pre-set `customer_id` / `customer_email`.
  var id = b.customer_id || b.user_id || '';
  var email = b.customer_email || b.user_email || '';
  if (id || email) {
    b.customer_id = String(id);
    b.customer_email = String(email);
    b.customer_tier = String(b.customer_tier || b.tier || 'standard');
    b.login_status = 'true';
  } else {
    b.login_status = 'false';
  }
})(a, b);
