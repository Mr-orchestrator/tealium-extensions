'use strict';
const { loadMetadata } = require('../scripts/lib/load-policy');
const { buildGraph } = require('../scripts/lib/graph');

describe('impact graph', () => {
  const profile = loadMetadata();
  const graph = buildGraph(profile);

  test('identity resolver impacts the GA4 mapping + tag', () => {
    const idr = profile.extensions.find(e => e.name === 'Identity Resolver');
    const impact = graph.impactOfExtension(idr);
    expect(impact.tags).toContain('GA4');
    expect(impact.extensions.map(e => e.name)).toEqual(
      expect.arrayContaining(['GA4 Ecommerce Mapping'])
    );
  });

  test('customer_id dependents include the GA4 mapping', () => {
    const dep = graph.dependentsOfVariable('customer_id');
    expect(dep.tags).toContain('GA4');
  });

  test('a leaf extension has no downstream dependents', () => {
    const cleanup = profile.extensions.find(e => e.name === 'Cleanup & Diagnostics');
    const impact = graph.impactOfExtension(cleanup);
    expect(impact.extensions.length).toBe(0);
  });
});
