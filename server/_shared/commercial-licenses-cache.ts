import { getCachedJson, setCachedJson } from './redis';
import { sha256Hex } from './hash';

const CACHE_KEY_PREFIX = 'commercial-licenses:v1';

export const COMMERCIAL_LICENSES_LATEST_TTL_SECONDS = 5 * 60;
export const COMMERCIAL_LICENSES_PINNED_TTL_SECONDS = 24 * 60 * 60;

export interface CommercialLicensesCacheIdentity {
  operation: string;
  parameters: unknown;
  releaseId?: string;
}

export interface CommercialLicensesCacheStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<unknown>;
}

export interface CommercialLicensesCacheOptions<T>
  extends CommercialLicensesCacheIdentity {
  load: () => Promise<unknown>;
  validate: (value: unknown) => T;
  cache?: CommercialLicensesCacheStore;
}

const redisCache: CommercialLicensesCacheStore = {
  get: (key) => getCachedJson(key),
  set: (key, value, ttlSeconds) => setCachedJson(key, value, ttlSeconds),
};

function canonicalJson(value: unknown, ancestors = new Set<object>()): string | undefined {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) return 'null';
      return Object.is(value, -0) ? '0' : JSON.stringify(value);
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined;
    case 'bigint':
      throw new TypeError('Commercial licenses cache parameters must be JSON-compatible');
    case 'object': {
      const object = value as object;
      if (ancestors.has(object)) {
        throw new TypeError('Commercial licenses cache parameters must not be cyclic');
      }

      ancestors.add(object);
      try {
        if (Array.isArray(value)) {
          return `[${value.map((entry) => canonicalJson(entry, ancestors) ?? 'null').join(',')}]`;
        }

        const record = value as Record<string, unknown>;
        const prototype = Object.getPrototypeOf(record);
        if (prototype !== Object.prototype && prototype !== null) {
          throw new TypeError('Commercial licenses cache parameters must use plain JSON objects');
        }
        const entries = Object.keys(record)
          .sort()
          .flatMap((key) => {
            const normalized = canonicalJson(record[key], ancestors);
            return normalized === undefined
              ? []
              : [`${JSON.stringify(key)}:${normalized}`];
          });
        return `{${entries.join(',')}}`;
      } finally {
        ancestors.delete(object);
      }
    }
  }
}

function normalizeOperation(operation: string): string {
  const normalized = operation.trim().toLowerCase();
  if (!normalized) {
    throw new TypeError('Commercial licenses cache operation must not be empty');
  }
  return normalized;
}

function getReleaseScope(releaseId: string | undefined): 'latest' | 'pinned' {
  if (releaseId === undefined) return 'latest';
  if (!releaseId.trim()) {
    throw new TypeError('Commercial licenses pinned release ID must not be empty');
  }
  return 'pinned';
}

/**
 * Produces an opaque key. Query values and release IDs only occur inside the
 * digest, so RUTs, addresses and source identifiers never appear in Redis keys
 * or cache-key logs.
 */
export async function buildCommercialLicensesCacheKey(
  identity: CommercialLicensesCacheIdentity,
): Promise<string> {
  const scope = getReleaseScope(identity.releaseId);
  const normalized = canonicalJson({
    operation: normalizeOperation(identity.operation),
    parameters: identity.parameters,
    releaseId: identity.releaseId,
  });
  const digest = await sha256Hex(normalized ?? 'null');
  return `${CACHE_KEY_PREFIX}:${scope}:${digest}`;
}

export function getCommercialLicensesCacheTtlSeconds(
  releaseId: string | undefined,
): number {
  return getReleaseScope(releaseId) === 'pinned'
    ? COMMERCIAL_LICENSES_PINNED_TTL_SECONDS
    : COMMERCIAL_LICENSES_LATEST_TTL_SECONDS;
}

/**
 * Reads through the cache without weakening the contract boundary. Cached and
 * freshly loaded values pass the same validator. A failed load or validation
 * is propagated and never written; this layer does not invent a release
 * fallback.
 */
export async function getOrLoadCommercialLicenses<T>(
  options: CommercialLicensesCacheOptions<T>,
): Promise<T> {
  const cache = options.cache ?? redisCache;
  const key = await buildCommercialLicensesCacheKey(options);

  let cached: unknown | null = null;
  try {
    cached = await cache.get(key);
  } catch {
    // Cache availability must not prevent a direct producer request.
  }

  if (cached !== null) {
    try {
      return options.validate(cached);
    } catch {
      // Treat a malformed/obsolete cache entry as a miss and replace it only
      // after the producer response passes the same validator.
    }
  }

  const validated = options.validate(await options.load());

  try {
    await cache.set(
      key,
      validated,
      getCommercialLicensesCacheTtlSeconds(options.releaseId),
    );
  } catch {
    // A cache write failure does not turn a validated producer success into an
    // application failure.
  }

  return validated;
}
