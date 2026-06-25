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
 *   renaming/removing them breaks GA4 + Adobe mappings and downstream stitching.
 *
 * Tealium scope: Before Load Rules (after enrichment, before tag mappings).
 */
(function (a, b) {
  var gb = (b && b.gridbox_data) || window.gridbox_data || {};
  var user = (gb.user && gb.user[0]) || gb.user || {};

  // Persistent anonymous id (always present)
  b.visitor_id = String(user.visitorId || gb.visitor_id || b.visitor_id || '');

  // Authenticated identity (only when logged in)
  if (user.id || user.email) {
    b.customer_id = String(user.id || '');
    b.customer_email = String(user.email || '');
    b.customer_tier = String(user.tier || user.customerTier || 'standard');
    b.login_status = 'true';
  } else {
    b.login_status = 'false';
  }
})(a, b);
