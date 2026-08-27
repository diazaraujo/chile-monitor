import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// @ts-expect-error - plain JS edge handler, no type declarations
import handler from '../api/geo.js';

/**
 * `/api/geo` derives its whole body from per-request IP-geo headers, so its
 * answer differs for every visitor. No cache layer in front of it keys on those
 * headers: Vercel's CDN is not given a `Vary`, and the Cloudflare zone in front
 * of api.worldmonitor.app ignores `Vary` outright (see api/bootstrap.js
 * TIER_CACHE). A shared-cacheable response therefore pins the FIRST visitor's
 * country onto every later caller at that PoP, and the client silently trusts
 * it (src/utils/user-location.ts only falls back when the value is 'XX') to
 * geo-filter the live-channel list.
 *
 * What this guard does NOT cover, so nobody reads a green run as more than it is:
 *   - vercel.json header rules, which are additive and outrank the handler at the
 *     CDN. Guarded separately in tests/deploy-config.test.mjs ('no vercel.json
 *     rule re-enables shared caching of /api/geo').
 *   - Cloudflare Cache Rules for the api.worldmonitor.app zone. They live outside
 *     this repo, and an "Edge TTL: ignore cache-control headers" rule overrides
 *     the origin no matter what it sends. That one is an ops check, not a test.
 */

// A per-visitor body must never be STORABLE by a shared cache, and exactly two
// directives promise that: an unqualified `no-store` or an unqualified `private`.
// Everything else leaves the response shared-storable under RFC 9111 -- `public`,
// any positive `max-age` (explicit freshness is sufficient on its own; `public`
// is only needed to make otherwise-uncacheable responses cacheable), a bare
// `no-cache` (which permits storage and reuse after revalidation), an
// `s-maxage=0` paired with `stale-while-revalidate`, or no directive at all.
// Enumerating the DANGEROUS values is what makes an absence-guard rot: the first
// value nobody thought of sails through. So this inverts it and enumerates the
// two safe ones. Deliberately over-inclusive -- the endpoint ships `no-store`, so
// a false alarm costs a moment's thought while a false clear costs a repeat of
// the exact bug this file exists to prevent.
const UNQUALIFIED_NO_STORE = /(^|[\s,])no-store\s*([,;]|$)/;
// `private` must be unqualified: RFC 9111's `private="Set-Cookie"` form excludes
// only the named field and leaves the rest shared-storable.
const UNQUALIFIED_PRIVATE = /(^|[\s,])private\s*([,;]|$)/;

function isSharedCacheable(cacheControl: string | null): boolean {
  if (!cacheControl) return true; // no directive at all -> shared caches may heuristically store
  const value = cacheControl.toLowerCase();
  return !UNQUALIFIED_NO_STORE.test(value) && !UNQUALIFIED_PRIVATE.test(value);
}

// Every header that can set a shared-cache policy for this response. Vercel reads
// Vercel-CDN-Cache-Control > CDN-Cache-Control > Cache-Control; Cloudflare reads
// Cloudflare-CDN-Cache-Control > CDN-Cache-Control > Cache-Control. A CDN-specific
// header the handler does not currently set would silently outrank its `no-store`.
const CDN_CACHE_HEADERS = [
  'CDN-Cache-Control',
  'Vercel-CDN-Cache-Control',
  'Cloudflare-CDN-Cache-Control',
  'Surrogate-Control',
];

function geoRequest(headers: Record<string, string>): Request {
  return new Request('https://api.worldmonitor.app/api/geo', { headers });
}

async function countryFor(headers: Record<string, string>): Promise<string> {
  const res = await handler(geoRequest(headers));
  return (await res.json()).country;
}

describe('/api/geo per-visitor cache contract', () => {
  // Positive controls for the detector itself, in BOTH directions. Without the
  // dangerous-side controls the rule could quietly narrow until it clears
  // everything; without the safe-side ones it could widen until it fails on a
  // correct value. Each string below is one a real edit might plausibly ship.
  it('isSharedCacheable flags every directive a shared cache may store', () => {
    // The exact value this endpoint shipped before the fix.
    assert.equal(isSharedCacheable('public, max-age=300, s-maxage=3600, stale-if-error=3600'), true);
    assert.equal(isSharedCacheable('s-maxage=600'), true);
    // Bare max-age with no `public` and no `s-maxage`: explicit freshness alone
    // is enough for a shared cache to store and reuse.
    assert.equal(isSharedCacheable('max-age=300'), true);
    // TIER_CACHE.slow from api/bootstrap.js -- the most likely "restore browser
    // caching" edit, because it reads as an in-house-approved value.
    assert.equal(isSharedCacheable('max-age=300, stale-while-revalidate=600, stale-if-error=3600'), true);
    // s-maxage=0 is fresh for zero seconds, but stale-while-revalidate still
    // licenses a shared cache to serve the stale (poisoned) copy.
    assert.equal(isSharedCacheable('s-maxage=0, stale-while-revalidate=600'), true);
    // Qualified private excludes only the named field; the rest stays storable.
    assert.equal(isSharedCacheable('private="Set-Cookie", max-age=300'), true);
    // no-cache permits storage and reuse after revalidation.
    assert.equal(isSharedCacheable('no-cache'), true);
    assert.equal(isSharedCacheable('must-revalidate, max-age=600'), true);
    assert.equal(isSharedCacheable(null), true);
    assert.equal(isSharedCacheable(''), true);
  });

  it('isSharedCacheable clears the directives that actually forbid shared storage', () => {
    assert.equal(isSharedCacheable('no-store'), false);
    assert.equal(isSharedCacheable('private, max-age=300'), false);
    assert.equal(isSharedCacheable('max-age=0, no-store'), false);
    assert.equal(isSharedCacheable('no-store, must-revalidate'), false);
    assert.equal(isSharedCacheable('PRIVATE'), false); // directives are case-insensitive
  });

  // Positive control for the premise: the body really is request-dependent.
  it('returns a different country per request header set', async () => {
    assert.equal(await countryFor({ 'x-vercel-ip-country': 'DE' }), 'DE');
    assert.equal(await countryFor({ 'x-vercel-ip-country': 'US' }), 'US');
    assert.equal(await countryFor({ 'cf-ipcountry': 'JP', 'x-vercel-ip-country': 'US' }), 'JP');
    assert.equal(await countryFor({ 'cf-ipcountry': 'T1', 'x-vercel-ip-country': 'US' }), 'US');
    assert.equal(await countryFor({}), 'XX');
  });

  it('never lets a shared cache store one visitor country for another', async () => {
    const res = await handler(geoRequest({ 'x-vercel-ip-country': 'DE' }));

    const cacheControl = res.headers.get('Cache-Control');
    assert.equal(
      isSharedCacheable(cacheControl),
      false,
      `Cache-Control "${cacheControl}" lets a shared cache serve one visitor's IP-geo to everyone`,
    );

    // A CDN header may be absent (Cache-Control then governs) but must never
    // carry a policy that outranks it with something shared-cacheable.
    for (const header of CDN_CACHE_HEADERS) {
      const value = res.headers.get(header);
      if (value === null) continue;
      assert.equal(
        isSharedCacheable(value),
        false,
        `${header} "${value}" outranks Cache-Control and re-enables shared CDN caching of a per-visitor body`,
      );
    }
  });

  // The CORS header sits in the same header object as the Cache-Control this fix
  // changed, so an edit to that object could drop it. The desktop shell and
  // preview deployments reach /api/geo cross-origin via toApiUrl.
  it('keeps the public CORS header the cross-origin callers depend on', async () => {
    const res = await handler(geoRequest({ 'x-vercel-ip-country': 'DE' }));
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  });
});
