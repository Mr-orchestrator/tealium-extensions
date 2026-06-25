'use strict';
/**
 * In-memory dependency graph over the metadata knowledge base (the doc's recommended
 * hybrid — file-based facts, graph built in the agent process). Nodes: extensions,
 * variables, tags. Edges: extension --creates--> variable, extension --uses--> variable,
 * variable --feeds--> tag. Used by the Impact Agent for blast-radius queries.
 */
function buildGraph(profile) {
  const { extensions, variables, tags } = profile;
  const byId = {};
  extensions.forEach(e => { byId[e.id] = e; });

  /** Extensions affected if `varName` changes = every extension that uses it (+ their tags). */
  function dependentsOfVariable(varName) {
    const v = variables[varName];
    if (!v) return { extensions: [], tags: [] };
    const exts = [...new Set(v.used_by.map(u => u.id))].map(id => byId[id]).filter(Boolean);
    const tg = [...new Set(v.usedIn.tags)];
    return { extensions: exts, tags: tg };
  }

  /** Everything downstream of an extension: the variables it creates + who uses them. */
  function impactOfExtension(ext) {
    const affectedExtensions = new Set();
    const affectedTags = new Set();
    const affectedVariables = new Set();
    (ext.creates || []).forEach(vn => {
      affectedVariables.add(vn);
      const dep = dependentsOfVariable(vn);
      dep.extensions.forEach(e => { if (e.id !== ext.id) affectedExtensions.add(e); });
      dep.tags.forEach(t => affectedTags.add(t));
    });
    if (ext.feedsTag) affectedTags.add(ext.feedsTag);
    return {
      variables: [...affectedVariables],
      extensions: [...affectedExtensions],
      tags: [...affectedTags]
    };
  }

  return { byId, dependentsOfVariable, impactOfExtension, extensions, variables, tags };
}

module.exports = { buildGraph };
