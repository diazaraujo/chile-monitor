// @vitest-environment node

import { describe, expect, test } from 'vitest';

import {
  EvidencePacketCanonicalError,
  canonicalizeJson,
  hashEvidencePacketContent,
  sha256CanonicalJson,
} from '../_shared/evidence-packet-canonical';

describe('EvidencePacket canonical JSON', () => {
  test('sorts object keys recursively while preserving array order', () => {
    const left = {
      z: [{ beta: 2, alpha: 1 }, 'último'],
      a: { y: true, x: null },
    };
    const right = {
      a: { x: null, y: true },
      z: [{ alpha: 1, beta: 2 }, 'último'],
    };

    const expected = '{"a":{"x":null,"y":true},"z":[{"alpha":1,"beta":2},"último"]}';
    expect(canonicalizeJson(left)).toBe(expected);
    expect(canonicalizeJson(right)).toBe(expected);
  });

  test('escapes JSON strings and accepts plain null-prototype records', () => {
    const value = Object.create(null) as Record<string, unknown>;
    value.quote = 'line\n"quoted"';
    value.emoji = '🏛️';

    expect(canonicalizeJson(value)).toBe('{"emoji":"🏛️","quote":"line\\n\\"quoted\\""}');
  });

  test('produces a lowercase SHA-256 digest of UTF-8 canonical JSON', async () => {
    await expect(sha256CanonicalJson({ b: 2, a: 1 })).resolves.toBe(
      '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777',
    );
  });

  test('rejects values that JSON.stringify would coerce or omit', () => {
    const sparse = new Array(1);
    const extraArrayProperty = [1] as number[] & { extra?: number };
    extraArrayProperty.extra = 2;
    const getter = Object.defineProperty({}, 'secret', {
      enumerable: true,
      get: () => 'must not execute',
    });
    const hidden = Object.defineProperty({}, 'secret', {
      enumerable: false,
      value: 'must not disappear',
    });

    const cases: Array<{ value: unknown; code: string }> = [
      { value: undefined, code: 'invalid_type' },
      { value: 1n, code: 'invalid_type' },
      { value: Symbol('value'), code: 'invalid_type' },
      { value: () => undefined, code: 'invalid_type' },
      { value: Number.NaN, code: 'non_finite_number' },
      { value: Number.POSITIVE_INFINITY, code: 'non_finite_number' },
      { value: -0, code: 'negative_zero' },
      { value: sparse, code: 'sparse_array' },
      { value: extraArrayProperty, code: 'unsupported_property' },
      { value: getter, code: 'unsupported_property' },
      { value: hidden, code: 'unsupported_property' },
      { value: new Date('2026-08-28T00:00:00Z'), code: 'unsupported_object' },
      { value: new Map(), code: 'unsupported_object' },
    ];

    for (const entry of cases) {
      expect(() => canonicalizeJson(entry.value)).toThrowError(
        expect.objectContaining({
          name: 'EvidencePacketCanonicalError',
          code: entry.code,
        }),
      );
    }
  });

  test('rejects unsafe properties, symbols, unpaired surrogates and cycles', () => {
    const unsafe = JSON.parse('{"__proto__":1}') as Record<string, unknown>;
    const symbolProperty = { valid: true } as Record<string | symbol, unknown>;
    symbolProperty[Symbol('secret')] = true;
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;

    expect(() => canonicalizeJson(unsafe)).toThrowError(
      expect.objectContaining({ code: 'unsupported_property' }),
    );
    expect(() => canonicalizeJson(symbolProperty)).toThrowError(
      expect.objectContaining({ code: 'unsupported_property' }),
    );
    expect(() => canonicalizeJson('\ud800')).toThrowError(
      expect.objectContaining({ code: 'invalid_unicode' }),
    );
    expect(() => canonicalizeJson(cycle)).toThrowError(
      expect.objectContaining({ code: 'circular_reference' }),
    );
  });

  test('allows repeated references when they are not circular', () => {
    const shared = { id: 'source-1' };
    expect(canonicalizeJson({ left: shared, right: shared })).toBe(
      '{"left":{"id":"source-1"},"right":{"id":"source-1"}}',
    );
  });

  test('hashes packet content without its self-referential field and does not mutate input', async () => {
    const packet = Object.freeze({
      packet_content_sha256: 'top-level-value-must-remain',
      packet_id: 'packet-1',
      reproducibility: Object.freeze({
        packet_content_sha256: 'f'.repeat(64),
        builder_version: '1.0.0',
        builder: 'chile-monitor',
      }),
    });
    const expectedContent = {
      packet_content_sha256: 'top-level-value-must-remain',
      packet_id: 'packet-1',
      reproducibility: {
        builder_version: '1.0.0',
        builder: 'chile-monitor',
      },
    };

    await expect(hashEvidencePacketContent(packet)).resolves.toBe(
      await sha256CanonicalJson(expectedContent),
    );
    expect(packet.reproducibility.packet_content_sha256).toBe('f'.repeat(64));
    expect(Object.isFrozen(packet)).toBe(true);
    expect(Object.isFrozen(packet.reproducibility)).toBe(true);
  });

  test('gives the same content hash regardless of the current digest value', async () => {
    const base = {
      packet_id: 'packet-1',
      reproducibility: { builder: 'chile-monitor', packet_content_sha256: 'a'.repeat(64) },
    };
    const changed = {
      reproducibility: { packet_content_sha256: 'b'.repeat(64), builder: 'chile-monitor' },
      packet_id: 'packet-1',
    };

    expect(await hashEvidencePacketContent(base)).toBe(await hashEvidencePacketContent(changed));
  });

  test('rejects malformed packet metadata with a safe error', async () => {
    const secret = 'RUT-AND-ADDRESS-MUST-NOT-LEAK';
    const malformed = { packet_id: secret, reproducibility: null };

    let caught: unknown;
    try {
      await hashEvidencePacketContent(malformed);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EvidencePacketCanonicalError);
    expect(caught).toMatchObject({ code: 'invalid_packet' });
    expect(String(caught)).not.toContain(secret);
    expect(JSON.stringify(caught)).not.toContain(secret);
  });
});
