import { z } from 'zod';

import { hashEvidencePacketContent, sha256CanonicalJson } from './evidence-packet-canonical';
import { parseEvidencePacket } from './evidence-packet-contract';
import type {
  CommitOpenLicenseReviewRequest,
  CommitOpenLicenseReviewResult,
  OpenLicenseReviewOperationLookup,
  OpenLicenseReviewOperationResult,
  OpenLicenseReviewWritePort,
} from './review-case-opener';

const CHUNK_MAX_BYTES = 192 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const SECRET_HEADER = 'x-review-case-storage-secret';

const operationResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('miss') }).strict(),
  z.object({ kind: z.literal('replayed'), receipt: z.unknown() }).strict(),
  z.object({ kind: z.literal('operation_conflict') }).strict(),
]);

const commitResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('committed') }).strict(),
  z.object({ kind: z.literal('replayed'), receipt: z.unknown() }).strict(),
  z.object({ kind: z.literal('operation_conflict') }).strict(),
  z.object({ kind: z.literal('active_case_conflict') }).strict(),
  z.object({ kind: z.literal('cas_conflict') }).strict(),
]);

export class ConvexReviewCaseWritePortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConvexReviewCaseWritePortError';
  }
}

export interface ConvexReviewCaseWritePortConfig {
  convexSiteUrl: string;
  storageSecret: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function validConfigValue(value: string): boolean {
  return value.length > 0 && value.length <= 2_048;
}

function normalizeSiteUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConvexReviewCaseWritePortError('Review storage configuration is invalid');
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new ConvexReviewCaseWritePortError('Review storage configuration is invalid');
  }
  return url.toString().replace(/\/$/, '');
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  }
  return btoa(binary);
}

function chunkPacket(json: string): {
  nature: 'historical_non_executable';
  bytes: number;
  chunks: { ordinal: number; encodedBase64: string; byteLength: number }[];
} {
  const bytes = new TextEncoder().encode(json);
  const chunks = [];
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_MAX_BYTES) {
    const part = bytes.subarray(offset, Math.min(offset + CHUNK_MAX_BYTES, bytes.byteLength));
    chunks.push({
      ordinal: chunks.length,
      encodedBase64: encodeBase64(part),
      byteLength: part.byteLength,
    });
  }
  return { nature: 'historical_non_executable', bytes: bytes.byteLength, chunks };
}

async function operationKeySha256(operationKey: string, actorId: string): Promise<string> {
  return sha256CanonicalJson({
    actor_id: actorId,
    action: 'OpenLicenseReview',
    operation_key: operationKey,
  });
}

export function createConvexReviewCaseWritePort(
  config: ConvexReviewCaseWritePortConfig,
): OpenLicenseReviewWritePort {
  if (!validConfigValue(config.storageSecret)) {
    throw new ConvexReviewCaseWritePortError('Review storage configuration is invalid');
  }
  const siteUrl = normalizeSiteUrl(config.convexSiteUrl);
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new ConvexReviewCaseWritePortError('Review storage configuration is invalid');
  }

  async function post(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`${siteUrl}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'chile-monitor-review-case/1.0',
          [SECRET_HEADER]: config.storageSecret,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ConvexReviewCaseWritePortError('Review storage is unavailable');
    }
    if (!response.ok) {
      throw new ConvexReviewCaseWritePortError(`Review storage returned HTTP ${response.status}`);
    }
    try {
      return await response.json();
    } catch {
      throw new ConvexReviewCaseWritePortError('Review storage returned invalid JSON');
    }
  }

  return {
    async readOpenLicenseReviewOperation(
      lookup: OpenLicenseReviewOperationLookup,
    ): Promise<OpenLicenseReviewOperationResult> {
      const value = await post('/api/internal-review-case-operation', {
        lookup: {
          operationKeySha256: await operationKeySha256(lookup.operationKey, lookup.actorId),
          commandSha256: lookup.commandSha256,
          actorId: lookup.actorId,
          municipalityCut: lookup.municipalityCut,
        },
      });
      const parsed = operationResultSchema.safeParse(value);
      if (!parsed.success) {
        throw new ConvexReviewCaseWritePortError('Review storage returned an invalid operation result');
      }
      return parsed.data;
    },

    async commitOpenLicenseReview(
      request: CommitOpenLicenseReviewRequest,
    ): Promise<CommitOpenLicenseReviewResult> {
      let packet: ReturnType<typeof parseEvidencePacket>;
      try {
        packet = parseEvidencePacket(JSON.parse(request.evidencePacketSnapshot.json));
      } catch {
        throw new ConvexReviewCaseWritePortError('Review packet is invalid');
      }
      const computedHash = await hashEvidencePacketContent(packet);
      if (
        computedHash !== packet.reproducibility.packet_content_sha256
        || computedHash !== request.caseSnapshot.packet_ref.packet_content_sha256
        || computedHash !== request.action.packet_ref.packet_content_sha256
      ) {
        throw new ConvexReviewCaseWritePortError('Review packet integrity check failed');
      }
      const operationHash = await operationKeySha256(
        request.operationKey,
        request.authorityFence.actorId,
      );
      const { operationKey: _operationKey, evidencePacketSnapshot: _packet, ...rest } = request;
      const value = await post('/api/internal-open-license-review', {
        request: {
          ...rest,
          operationKeySha256: operationHash,
          evidencePacketSnapshot: chunkPacket(request.evidencePacketSnapshot.json),
        },
      });
      const parsed = commitResultSchema.safeParse(value);
      if (!parsed.success) {
        throw new ConvexReviewCaseWritePortError('Review storage returned an invalid commit result');
      }
      return parsed.data;
    },
  };
}

export function createConvexReviewCaseWritePortFromEnv(): OpenLicenseReviewWritePort {
  const convexSiteUrl = process.env.CONVEX_SITE_URL ?? '';
  const storageSecret = process.env.REVIEW_CASE_STORAGE_SECRET ?? '';
  if (!convexSiteUrl || !storageSecret) {
    throw new ConvexReviewCaseWritePortError('Review storage configuration is missing');
  }
  return createConvexReviewCaseWritePort({ convexSiteUrl, storageSecret });
}
