import { sha256Hex } from './hash';

export type EvidencePacketCanonicalErrorCode =
  | 'invalid_type'
  | 'non_finite_number'
  | 'negative_zero'
  | 'invalid_unicode'
  | 'sparse_array'
  | 'unsupported_property'
  | 'unsupported_object'
  | 'circular_reference'
  | 'invalid_packet';

/** Safe error: no values, property names, or document paths are retained. */
export class EvidencePacketCanonicalError extends Error {
  readonly code: EvidencePacketCanonicalErrorCode;

  constructor(code: EvidencePacketCanonicalErrorCode, message: string) {
    super(message);
    this.name = 'EvidencePacketCanonicalError';
    this.code = code;
  }
}

/**
 * Produces deterministic JSON by recursively sorting object keys. Inputs must
 * already be unambiguous JSON data; coercions performed by JSON.stringify
 * (undefined, holes, toJSON, non-finite numbers, and negative zero) are rejected.
 */
export function canonicalizeJson(value: unknown): string {
  try {
    return encodeCanonical(value, new Set<object>());
  } catch (error) {
    if (error instanceof EvidencePacketCanonicalError) throw error;
    throw new EvidencePacketCanonicalError(
      'unsupported_object',
      'Evidence packet contains an unsupported object',
    );
  }
}

export async function sha256CanonicalJson(value: unknown): Promise<string> {
  return sha256Hex(canonicalizeJson(value));
}

/**
 * Hashes packet content without the self-referential digest field. The input
 * packet and its reproducibility object are never modified.
 */
export async function hashEvidencePacketContent(packet: unknown): Promise<string> {
  const packetRecord = requirePlainRecord(packet, 'invalid_packet');
  const reproducibilityDescriptor = Object.getOwnPropertyDescriptor(packetRecord, 'reproducibility');
  if (!isEnumerableDataDescriptor(reproducibilityDescriptor)) {
    throw new EvidencePacketCanonicalError(
      'invalid_packet',
      'Evidence packet reproducibility metadata is invalid',
    );
  }
  const reproducibility = requirePlainRecord(reproducibilityDescriptor.value, 'invalid_packet');

  const packetForHash = copyRecord(packetRecord);
  packetForHash.reproducibility = copyRecord(reproducibility, 'packet_content_sha256');
  return sha256CanonicalJson(packetForHash);
}

function encodeCanonical(value: unknown, ancestors: Set<object>): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      assertValidUnicode(value);
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) {
        throw new EvidencePacketCanonicalError(
          'non_finite_number',
          'Canonical JSON requires finite numbers',
        );
      }
      if (Object.is(value, -0)) {
        throw new EvidencePacketCanonicalError(
          'negative_zero',
          'Canonical JSON does not accept negative zero',
        );
      }
      return JSON.stringify(value);
    case 'object':
      return encodeObject(value, ancestors);
    default:
      throw new EvidencePacketCanonicalError(
        'invalid_type',
        'Canonical JSON accepts only JSON value types',
      );
  }
}

function encodeObject(value: object, ancestors: Set<object>): string {
  if (ancestors.has(value)) {
    throw new EvidencePacketCanonicalError(
      'circular_reference',
      'Canonical JSON does not accept circular references',
    );
  }
  ancestors.add(value);
  try {
    return Array.isArray(value)
      ? encodeArray(value, ancestors)
      : encodeRecord(requirePlainRecord(value), ancestors);
  } finally {
    ancestors.delete(value);
  }
}

function encodeArray(value: unknown[], ancestors: Set<object>): string {
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    throw new EvidencePacketCanonicalError(
      'unsupported_property',
      'Canonical JSON does not accept symbol properties',
    );
  }

  const propertyNames = Object.getOwnPropertyNames(value);
  if (
    propertyNames.some(
      (name) => name !== 'length' && (!isArrayIndex(name) || Number(name) >= value.length),
    )
  ) {
    throw new EvidencePacketCanonicalError(
      'unsupported_property',
      'Canonical JSON arrays do not accept extra properties',
    );
  }

  const encoded: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor) {
      throw new EvidencePacketCanonicalError(
        'sparse_array',
        'Canonical JSON does not accept sparse arrays',
      );
    }
    if (!isEnumerableDataDescriptor(descriptor)) {
      throw new EvidencePacketCanonicalError(
        'unsupported_property',
        'Canonical JSON requires enumerable data properties',
      );
    }
    encoded.push(encodeCanonical(descriptor.value, ancestors));
  }
  return `[${encoded.join(',')}]`;
}

function encodeRecord(value: Record<string, unknown>, ancestors: Set<object>): string {
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    throw new EvidencePacketCanonicalError(
      'unsupported_property',
      'Canonical JSON does not accept symbol properties',
    );
  }

  const entries: string[] = [];
  for (const key of Object.getOwnPropertyNames(value).sort()) {
    assertValidUnicode(key);
    if (key === '__proto__') {
      throw new EvidencePacketCanonicalError(
        'unsupported_property',
        'Canonical JSON does not accept unsafe property names',
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!isEnumerableDataDescriptor(descriptor)) {
      throw new EvidencePacketCanonicalError(
        'unsupported_property',
        'Canonical JSON requires enumerable data properties',
      );
    }
    entries.push(`${JSON.stringify(key)}:${encodeCanonical(descriptor.value, ancestors)}`);
  }
  return `{${entries.join(',')}}`;
}

function requirePlainRecord(
  value: unknown,
  errorCode: EvidencePacketCanonicalErrorCode = 'unsupported_object',
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new EvidencePacketCanonicalError(errorCode, 'Evidence packet requires a JSON object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new EvidencePacketCanonicalError(errorCode, 'Canonical JSON requires plain objects');
  }
  return value as Record<string, unknown>;
}

function copyRecord(
  value: Record<string, unknown>,
  excludedKey?: string,
): Record<string, unknown> {
  const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === excludedKey) continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!isEnumerableDataDescriptor(descriptor)) {
      throw new EvidencePacketCanonicalError(
        'invalid_packet',
        'Evidence packet contains an unsupported property',
      );
    }
    copy[key] = descriptor.value;
  }
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    throw new EvidencePacketCanonicalError(
      'invalid_packet',
      'Evidence packet contains an unsupported property',
    );
  }
  return copy;
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor;
}

function isArrayIndex(value: string): boolean {
  if (!/^(0|[1-9][0-9]*)$/u.test(value)) return false;
  const index = Number(value);
  return Number.isSafeInteger(index) && index >= 0 && String(index) === value;
}

function assertValidUnicode(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new EvidencePacketCanonicalError(
          'invalid_unicode',
          'Canonical JSON requires valid Unicode strings',
        );
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new EvidencePacketCanonicalError(
        'invalid_unicode',
        'Canonical JSON requires valid Unicode strings',
      );
    }
  }
}
