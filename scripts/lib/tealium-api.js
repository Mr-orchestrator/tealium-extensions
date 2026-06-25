'use strict';
/**
 * Tealium iQ Profiles API client. Used by knowledge-agent.js to reconcile the local
 * manifest knowledge base with the LIVE profile. Credentials come from env / GitHub
 * Secrets — never commit them:
 *   TEALIUM_ACCOUNT, TEALIUM_PROFILE, TEALIUM_API_TOKEN  (Bearer)
 *
 * Docs: https://docs.tealium.com/server-side/iq-tag-management/  (Profiles API)
 * When creds are absent we run in LOCAL-MANIFEST MODE (no network) — the platform is
 * fully usable without a live profile.
 */
const https = require('https');

function hasCreds() {
  return Boolean(process.env.TEALIUM_ACCOUNT && process.env.TEALIUM_PROFILE && process.env.TEALIUM_API_TOKEN);
}

function getProfile() {
  if (!hasCreds()) return Promise.resolve(null); // local-manifest mode
  const { TEALIUM_ACCOUNT, TEALIUM_PROFILE, TEALIUM_API_TOKEN } = process.env;
  const pathUrl = `/v2/profiles/${TEALIUM_ACCOUNT}/${TEALIUM_PROFILE}`;
  return request(pathUrl, TEALIUM_API_TOKEN);
}

function request(pathUrl, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: 'api.tealiumiq.com', path: pathUrl, method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      res => {
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
          } else {
            reject(new Error(`Tealium API ${res.statusCode}: ${body.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

module.exports = { hasCreds, getProfile };
