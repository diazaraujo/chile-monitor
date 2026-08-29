// @vitest-environment node

import { describe, expect, test, vi } from 'vitest';

import {
  COMMERCIAL_LICENSES_LATEST_TTL_SECONDS,
  COMMERCIAL_LICENSES_PINNED_TTL_SECONDS,
  buildCommercialLicensesCacheKey,
  getOrLoadCommercialLicenses,
} from '../_shared/commercial-licenses-cache';

interface SuccessfulValue {
  ok: true;
  releaseId: string;
}

function validateSuccessfulValue(value: unknown): SuccessfulValue {
  if (
    value == null
    || typeof value !== 'object'
    || (value as Record<string, unknown>).ok !== true
    || typeof (value as Record<string, unknown>).releaseId !== 'string'
  ) {
    throw new TypeError('invalid commercial licenses response');
  }
  return value as SuccessfulValue;
}

function cacheHarness(initial: unknown | null = null) {
  let cached = initial;
  return {
    store: {
      get: vi.fn(async () => cached),
      set: vi.fn(async (_key: string, value: unknown) => {
        cached = value;
        return true;
      }),
    },
  };
}

describe('commercial licenses cache keys', () => {
  test('are deterministic across parameter object ordering and normalized operation spelling', async () => {
    const first = await buildCommercialLicensesCacheKey({
      operation: ' PATENTS.SEARCH ',
      parameters: { municipality: '13101', filters: { status: 'active', page: 2 } },
    });
    const second = await buildCommercialLicensesCacheKey({
      operation: 'patents.search',
      parameters: { filters: { page: 2, status: 'active' }, municipality: '13101' },
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^commercial-licenses:v1:latest:[a-f0-9]{64}$/);
  });

  test('contain no raw RUT, address, source ID or release ID', async () => {
    const sensitiveValues = [
      '76.123.456-7',
      'Avenida Siempre Viva 742',
      'municipal-source-row-9981',
      'release-pilot-2026-08-28',
    ];
    const key = await buildCommercialLicensesCacheKey({
      operation: 'establishments.resolve',
      releaseId: sensitiveValues[3],
      parameters: {
        rut: sensitiveValues[0],
        address: sensitiveValues[1],
        sourceId: sensitiveValues[2],
      },
    });

    expect(key).toMatch(/^commercial-licenses:v1:pinned:[a-f0-9]{64}$/);
    for (const sensitive of sensitiveValues) expect(key).not.toContain(sensitive);
  });

  test('isolates latest, pinned releases, operations and varying parameters', async () => {
    const base = { municipality: '13101', patentId: 'PAT-001' };
    const latest = await buildCommercialLicensesCacheKey({
      operation: 'patents.get',
      parameters: base,
    });
    const pinnedOne = await buildCommercialLicensesCacheKey({
      operation: 'patents.get',
      parameters: base,
      releaseId: 'release-1',
    });
    const pinnedTwo = await buildCommercialLicensesCacheKey({
      operation: 'patents.get',
      parameters: base,
      releaseId: 'release-2',
    });
    const otherOperation = await buildCommercialLicensesCacheKey({
      operation: 'patents.timeline',
      parameters: base,
    });
    const otherParameters = await buildCommercialLicensesCacheKey({
      operation: 'patents.get',
      parameters: { ...base, patentId: 'PAT-002' },
    });

    expect(new Set([latest, pinnedOne, pinnedTwo, otherOperation, otherParameters])).toHaveLength(5);
  });

  test('rejects non-JSON objects instead of allowing cache-key collisions', async () => {
    await expect(buildCommercialLicensesCacheKey({
      operation: 'patents.get',
      parameters: { effectiveOn: new Date('2026-08-28T00:00:00Z') },
    })).rejects.toThrow(/plain JSON objects/);
  });
});

describe('commercial licenses read-through cache', () => {
  test('returns a validated cache hit without loading from the producer', async () => {
    const hit = { ok: true as const, releaseId: 'release-1' };
    const cache = cacheHarness(hit);
    const load = vi.fn();

    await expect(getOrLoadCommercialLicenses({
      operation: 'patents.get',
      parameters: { patentId: 'PAT-001' },
      releaseId: 'release-1',
      cache: cache.store,
      load,
      validate: validateSuccessfulValue,
    })).resolves.toEqual(hit);

    expect(load).not.toHaveBeenCalled();
    expect(cache.store.set).not.toHaveBeenCalled();
  });

  test('does not return an invalid hit and only writes a validated producer success', async () => {
    const fresh = { ok: true as const, releaseId: 'release-1' };
    const cache = cacheHarness({ error: 'poisoned' });
    const validate = vi.fn(validateSuccessfulValue);

    await expect(getOrLoadCommercialLicenses({
      operation: 'patents.get',
      parameters: { patentId: 'PAT-001' },
      releaseId: 'release-1',
      cache: cache.store,
      load: vi.fn(async () => fresh),
      validate,
    })).resolves.toEqual(fresh);

    expect(validate).toHaveBeenCalledTimes(2);
    expect(cache.store.set).toHaveBeenCalledWith(
      expect.stringMatching(/^commercial-licenses:v1:pinned:[a-f0-9]{64}$/),
      fresh,
      COMMERCIAL_LICENSES_PINNED_TTL_SECONDS,
    );
  });

  test('does not cache a producer response that fails validation', async () => {
    const cache = cacheHarness();

    await expect(getOrLoadCommercialLicenses({
      operation: 'patents.search',
      parameters: { rut: '76.123.456-7' },
      cache: cache.store,
      load: vi.fn(async () => ({ error: 'invalid' })),
      validate: validateSuccessfulValue,
    })).rejects.toThrow('invalid commercial licenses response');

    expect(cache.store.set).not.toHaveBeenCalled();
  });

  test('does not cache producer failures or fall back from a pinned release', async () => {
    const cache = cacheHarness();
    const upstreamError = new Error('pinned release unavailable');

    await expect(getOrLoadCommercialLicenses({
      operation: 'patents.timeline',
      parameters: { patentId: 'PAT-001' },
      releaseId: 'release-missing',
      cache: cache.store,
      load: vi.fn(async () => { throw upstreamError; }),
      validate: validateSuccessfulValue,
    })).rejects.toBe(upstreamError);

    expect(cache.store.get).toHaveBeenCalledTimes(1);
    expect(cache.store.set).not.toHaveBeenCalled();
  });

  test('uses a shorter TTL for latest than for immutable pinned releases', async () => {
    const latestCache = cacheHarness();
    const pinnedCache = cacheHarness();
    const value = { ok: true as const, releaseId: 'release-current' };
    const common = {
      operation: 'patents.coverage',
      parameters: { municipality: '13101' },
      load: vi.fn(async () => value),
      validate: validateSuccessfulValue,
    };

    await getOrLoadCommercialLicenses({ ...common, cache: latestCache.store });
    await getOrLoadCommercialLicenses({
      ...common,
      cache: pinnedCache.store,
      releaseId: 'release-current',
    });

    expect(latestCache.store.set).toHaveBeenCalledWith(
      expect.any(String),
      value,
      COMMERCIAL_LICENSES_LATEST_TTL_SECONDS,
    );
    expect(pinnedCache.store.set).toHaveBeenCalledWith(
      expect.any(String),
      value,
      COMMERCIAL_LICENSES_PINNED_TTL_SECONDS,
    );
    expect(COMMERCIAL_LICENSES_PINNED_TTL_SECONDS).toBeGreaterThan(
      COMMERCIAL_LICENSES_LATEST_TTL_SECONDS,
    );
  });
});
