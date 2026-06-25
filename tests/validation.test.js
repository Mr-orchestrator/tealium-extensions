'use strict';
const { loadPolicy, loadMetadata } = require('../scripts/lib/load-policy');
const { validate } = require('../scripts/validation-agent');

const policy = loadPolicy();
const clone = o => JSON.parse(JSON.stringify(o));

describe('validation agent', () => {
  test('clean profile passes with zero violations', () => {
    expect(validate(policy, loadMetadata())).toEqual([]);
  });

  test('PROT-001 fires when a protected variable is renamed away', () => {
    const p = clone(loadMetadata());
    const idr = p.extensions.find(e => e.name === 'Identity Resolver');
    idr.creates = idr.creates.map(v => (v === 'customer_id' ? 'cust_id' : v));
    delete p.variables.customer_id;            // rebuild side-effect of rename
    const ids = validate(policy, p).map(v => v.id);
    expect(ids).toContain('PROT-001');
  });

  test('CONSENT-001 fires when an Analytics mapping drops its consent gate', () => {
    const p = clone(loadMetadata());
    const ga4 = p.extensions.find(e => e.name === 'GA4 Ecommerce Mapping');
    ga4.uses = ga4.uses.filter(v => v !== 'consent_analytics' && v !== 'consent_marketing');
    const ids = validate(policy, p).map(v => v.id);
    expect(ids).toContain('CONSENT-001');
  });

  test('ORDER-001 fires on a backward (later-scope) dependency', () => {
    const p = clone(loadMetadata());
    // Make a Before-Load-Rules ext consume a var produced in After Tags.
    const after = p.extensions.find(e => e.scope === 'After Tags');
    after.creates = ['late_var'];
    const early = p.extensions.find(e => e.scope === 'Before Load Rules');
    early.uses = [...early.uses, 'late_var'];
    const ids = validate(policy, p).map(v => v.id);
    expect(ids).toContain('ORDER-001');
  });
});
