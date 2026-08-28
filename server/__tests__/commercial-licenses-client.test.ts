// @vitest-environment node

import { afterEach, describe, expect, test, vi } from 'vitest';

const contract = vi.hoisted(() => {
  class CommercialLicensesContractError extends Error {}
  const parse = vi.fn((value: unknown) => {
    if (value === 'contract-error') throw new CommercialLicensesContractError('sensitive detail');
    return value;
  });
  return { CommercialLicensesContractError, parse };
});

vi.mock('../_shared/commercial-licenses-contract', () => ({
  CommercialLicensesContractError: contract.CommercialLicensesContractError,
  parsePatentGetResponse: contract.parse,
  parsePatentTimelineResponse: contract.parse,
  parsePatentSearchResponse: contract.parse,
  parsePatentCoverageResponse: contract.parse,
  parseEstablishmentResolveResponse: contract.parse,
}));

import {
  CommercialLicensesClientError,
  createCommercialLicensesClient,
} from '../_shared/commercial-licenses-client';

const RELEASE_ID = 'release-2026-08-28';

function response(
  releaseId = RELEASE_ID,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    metadata: {
      release_id: releaseId,
      schema_version: '0.1.0',
      data_marking: 'PUBLIC',
    },
    effective_on: '2026-08-01',
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createHarness(values: Array<Response | Error> = [jsonResponse(response())]) {
  const fetchImpl = vi.fn(async () => {
    const next = values.shift();
    if (!next) throw new Error('Unexpected request');
    if (next instanceof Error) throw next;
    return next;
  });
  const getBearerToken = vi.fn(async () => 'secret-service-token');
  const client = createCommercialLicensesClient({
    baseUrl: 'https://licenses.test/capabilities/',
    getBearerToken,
    fetchImpl,
  });
  return { client, fetchImpl, getBearerToken };
}

afterEach(() => {
  vi.restoreAllMocks();
  contract.parse.mockClear();
});

describe('commercial licenses HTTP client', () => {
  test('serializes patents.get path, query and required headers', async () => {
    const { client, fetchImpl } = createHarness();

    await client.getPatent({
      municipalityCut: '13101',
      licenseId: 'license / 42',
      releaseId: RELEASE_ID,
      effectiveOn: '2026-08-01',
      representation: 'municipal_restricted',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [input, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/capabilities/v1/patents/13101/license%20%2F%2042');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      effective_on: '2026-08-01',
      release_id: RELEASE_ID,
      representation: 'municipal_restricted',
    });
    expect(init).toMatchObject({
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer secret-service-token',
        'User-Agent': 'chile-monitor-server/1.0 (commercial-licenses)',
      },
    });
    expect(init?.body).toBeUndefined();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  test('serializes patents.timeline and omits absent query parameters', async () => {
    const { client, fetchImpl } = createHarness();

    await client.getPatentTimeline({ municipalityCut: '13101', licenseId: 'license-1' });

    const [input, init] = fetchImpl.mock.calls[0];
    expect(String(input)).toBe(
      'https://licenses.test/capabilities/v1/patents/13101/license-1/timeline',
    );
    expect(init?.method).toBe('GET');
  });

  test('serializes every patents.search filter with URLSearchParams', async () => {
    const { client, fetchImpl } = createHarness();

    await client.searchPatents({
      municipalityCut: '13101',
      releaseId: RELEASE_ID,
      representation: 'public',
      status: 'vigente & observada',
      licenseType: 'commercial',
      activity: 'alimentos',
      legalEntityRut: '76543210-K',
      address: 'Avenida Uno 123 #4',
      establishmentId: 'est-1',
      parcelId: 'parcel-1',
      effectiveOn: '2026-08-01',
      cursor: 'opaque+cursor=',
      limit: 25,
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.pathname).toBe('/capabilities/v1/patents/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      activity: 'alimentos',
      address: 'Avenida Uno 123 #4',
      cursor: 'opaque+cursor=',
      effective_on: '2026-08-01',
      establishment_id: 'est-1',
      legal_entity_rut: '76543210-K',
      license_type: 'commercial',
      limit: '25',
      municipality_cut: '13101',
      parcel_id: 'parcel-1',
      release_id: RELEASE_ID,
      representation: 'public',
      status: 'vigente & observada',
    });
  });

  test('serializes patents.coverage', async () => {
    const { client, fetchImpl } = createHarness();

    await client.getPatentCoverage({
      municipalityCut: '13101',
      periodFrom: '2021-01-01',
      periodTo: '2026-08-28',
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.pathname).toBe('/capabilities/v1/patents/coverage');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      municipality_cut: '13101',
      period_from: '2021-01-01',
      period_to: '2026-08-28',
    });
  });

  test('serializes establishments.resolve body and release query', async () => {
    const { client, fetchImpl } = createHarness();
    const body = {
      municipality_cut: '13101',
      address: 'Avenida Uno 123',
      unit: null,
      effective_on: '2026-08-01',
    };

    await client.resolveEstablishment(body, { releaseId: RELEASE_ID });

    const [input, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/capabilities/v1/establishments/resolve');
    expect(Object.fromEntries(url.searchParams)).toEqual({ release_id: RELEASE_ID });
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  test('uses an eight second timeout and resolves bearer auth for each request', async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    const { client, getBearerToken } = createHarness([
      jsonResponse(response()),
      jsonResponse(response()),
    ]);

    await client.getPatentCoverage({ municipalityCut: '13101' });
    await client.getPatentCoverage({ municipalityCut: '13101' });

    expect(timeout).toHaveBeenNthCalledWith(1, 8_000);
    expect(timeout).toHaveBeenNthCalledWith(2, 8_000);
    expect(getBearerToken).toHaveBeenCalledTimes(2);
  });

  test('rejects a response that does not match the exact pinned release', async () => {
    const { client } = createHarness([jsonResponse(response('different-release'))]);

    await expect(
      client.getPatent({
        municipalityCut: '13101',
        licenseId: 'secret-id',
        releaseId: RELEASE_ID,
      }),
    ).rejects.toMatchObject({
      name: 'CommercialLicensesClientError',
      kind: 'release_mismatch',
    });
  });

  test('rejects schema, temporal and representation mismatches', async () => {
    const incompatible = createHarness([
      jsonResponse(response(RELEASE_ID, {
        metadata: {
          release_id: RELEASE_ID,
          schema_version: '1.0.0',
          data_marking: 'PUBLIC',
        },
      })),
    ]);
    await expect(
      incompatible.client.getPatentCoverage({ municipalityCut: '13101' }),
    ).rejects.toMatchObject({ kind: 'schema_incompatible' });

    const wrongDate = createHarness([
      jsonResponse(response(RELEASE_ID, { effective_on: '2026-07-31' })),
    ]);
    await expect(
      wrongDate.client.getPatent({
        municipalityCut: '13101',
        licenseId: 'license-1',
        effectiveOn: '2026-08-01',
      }),
    ).rejects.toMatchObject({ kind: 'temporal_mismatch' });

    const wrongMarking = createHarness([
      jsonResponse(response(RELEASE_ID, {
        metadata: {
          release_id: RELEASE_ID,
          schema_version: '0.1.0',
          data_marking: 'MUNICIPAL_INTERNAL',
        },
      })),
    ]);
    await expect(
      wrongMarking.client.getPatentCoverage({
        municipalityCut: '13101',
        representation: 'public',
      }),
    ).rejects.toMatchObject({ kind: 'representation_mismatch' });
  });

  test('keeps safe HTTP error fields without exposing upstream messages', async () => {
    const secret = 'Avenida Secreta 123';
    const { client } = createHarness([
      jsonResponse({ code: 'release_not_found', message: secret, retryable: false }, 404),
    ]);

    let caught: unknown;
    try {
      await client.getPatent({ municipalityCut: '13101', licenseId: 'sensitive-license' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      kind: 'http',
      status: 404,
      upstreamCode: 'release_not_found',
      retryable: false,
    });
    expect(String(caught)).not.toContain(secret);
    expect(JSON.stringify(caught)).not.toContain(secret);
  });

  test('types invalid JSON, contract, timeout and network failures without retrying', async () => {
    const cases: Array<{ value: Response | Error; kind: string }> = [
      { value: new Response('{invalid', { status: 200 }), kind: 'invalid_json' },
      { value: jsonResponse('contract-error'), kind: 'invalid_payload' },
      { value: new DOMException('secret timeout detail', 'TimeoutError'), kind: 'timeout' },
      { value: new Error('secret network detail'), kind: 'network' },
    ];

    for (const entry of cases) {
      const { client, fetchImpl } = createHarness([entry.value]);
      await expect(client.getPatentCoverage({ municipalityCut: '13101' })).rejects.toMatchObject({
        name: 'CommercialLicensesClientError',
        kind: entry.kind,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  test('rejects unsafe configuration and unavailable auth before fetch', async () => {
    expect(() =>
      createCommercialLicensesClient({
        baseUrl: 'https://token:secret@licenses.test/',
        getBearerToken: () => 'token',
      }),
    ).toThrowError(CommercialLicensesClientError);

    const fetchImpl = vi.fn();
    const client = createCommercialLicensesClient({
      baseUrl: 'https://licenses.test',
      getBearerToken: () => ' token-with-whitespace ',
      fetchImpl,
    });
    await expect(client.getPatentCoverage({ municipalityCut: '13101' })).rejects.toMatchObject({
      kind: 'configuration',
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    expect(() =>
      createCommercialLicensesClient({
        baseUrl: 'https://licenses.test/',
        getBearerToken: () => 'token',
        supportedSchemaMajor: -1,
      }),
    ).toThrowError(CommercialLicensesClientError);
  });
});
