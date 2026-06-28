'use strict';
// Verifies the GA4 Ecommerce Mapping extension turns the GridBox event stream (as the Event
// Bridge sets it on the data layer) into the correct GA4 event names + ecommerce params.
// Runs the ACTUAL extension file (not a copy) against mock data layers `b`.
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'extensions', '20-after-load-rules', '01-ga4-ecommerce-mapping.js'),
  'utf8'
);

// Execute the extension's IIFE with a given event type `a` and data layer `b`.
function runGA4(b, a) {
  a = a || 'link';
  // eslint-disable-next-line no-eval
  eval(SRC); // the file is `(function (a, b) { ... })(a, b);` — picks up local a, b
  return b;
}

describe('GA4 Ecommerce Mapping', () => {
  test('consent gate: no analytics consent → no GA4 params produced', () => {
    const b = runGA4({ consent_analytics: '0', tealium_event: 'AddToCart', product_id: 'TSHIRT-1' });
    expect(b.ga4_event_name).toBeUndefined();
    expect(b.ga4_items).toBeUndefined();
  });

  // Commerce funnel — keyed on the stable GridBox eventInfo.key the Event Bridge forwards.
  const commerce = {
    ProductView: 'view_item',
    AddToCart: 'add_to_cart',
    TicketAddedToCart: 'add_to_cart',
    MerchandiseAddedToCart: 'add_to_cart',
    RemoveFromCart: 'remove_from_cart',
    BeginCheckout: 'begin_checkout',
    gb_checkout_begin: 'begin_checkout', // site's public beginCheckout() uses a gb_ key
    Purchase: 'purchase',
    gb_purchase_complete: 'purchase'     // site's public purchase() uses a gb_ key
  };
  Object.keys(commerce).forEach((key) => {
    test(`commerce key '${key}' → ga4_event_name '${commerce[key]}'`, () => {
      const b = runGA4({ consent_analytics: '1', tealium_event: key });
      expect(b.ga4_event_name).toBe(commerce[key]);
    });
  });

  test('commerce by human event name also maps (adobeDataLayer fallback id)', () => {
    expect(runGA4({ consent_analytics: '1', tealium_event: 'Add to cart' }).ga4_event_name).toBe('add_to_cart');
    expect(runGA4({ consent_analytics: '1', tealium_event: 'Purchase completed' }).ga4_event_name).toBe('purchase');
  });

  test('generic gb_ element event → dynamic ga4_<category>_<action> (auto-mapping)', () => {
    const b = runGA4({
      consent_analytics: '1',
      tealium_event: 'gb_navigation-main_click_teams',
      eventCategory: 'navigation main', // site normalises '-' → ' '
      eventAction: 'click'
    });
    expect(b.ga4_event_name).toBe('ga4_navigation_main_click');
  });

  test('unknown event with no category falls back to page_view', () => {
    expect(runGA4({ consent_analytics: '1', tealium_event: 'SomethingNew' }).ga4_event_name).toBe('page_view');
  });

  test('product + order params build GA4 items and value', () => {
    const b = runGA4({
      consent_analytics: '1', tealium_event: 'Purchase',
      product_id: 'TKT-VIP', product_name: 'VIP Ticket', product_brand: 'F1',
      product_category: 'tickets', product_price: '450', order_total: '900',
      order_currency: 'EUR', customer_id: 'cust-42'
    });
    expect(b.ga4_event_name).toBe('purchase');
    expect(b.ga4_currency).toBe('EUR');
    expect(b.ga4_user_id).toBe('cust-42');
    expect(b.ga4_value).toBe(900);
    expect(Array.isArray(b.ga4_items)).toBe(true);
    expect(b.ga4_items[0]).toMatchObject({ item_id: 'TKT-VIP', item_name: 'VIP Ticket', price: 450 });
  });
});
