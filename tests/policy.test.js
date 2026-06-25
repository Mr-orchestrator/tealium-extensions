'use strict';
const { loadPolicy } = require('../scripts/lib/load-policy');

describe('policy engine', () => {
  const policy = loadPolicy();

  test('protects the core person keys', () => {
    expect(policy.protected.protected_variables).toEqual(
      expect.arrayContaining(['tealium_event', 'customer_id', 'customer_email', 'visitor_id'])
    );
  });

  test('requires consent for Analytics and Marketing tags', () => {
    expect(policy.consent.consent.require_consent_for).toEqual(
      expect.arrayContaining(['Analytics', 'Marketing'])
    );
    expect(policy.consent.consent.provider_scope).toBe('Pre Loader');
  });

  test('risk has 4 ordered levels and an architect threshold', () => {
    expect(policy.risk.risk.levels_order).toEqual(['low', 'medium', 'high', 'critical']);
    expect(['low', 'medium', 'high', 'critical']).toContain(policy.risk.risk.require_architect_at);
  });
});
