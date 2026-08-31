import { z } from 'zod';

import { sha256CanonicalJson } from './evidence-packet-canonical';
import type {
  AssignReviewerOperationLookup,
  AssignReviewerOperationResult,
  AssignReviewerWritePort,
  CommitAssignReviewerRequest,
  CommitAssignReviewerResult,
} from './review-case-assigner';

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
  z.object({ kind: z.literal('cas_conflict') }).strict(),
]);

export class ConvexReviewCaseAssignmentPortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConvexReviewCaseAssignmentPortError';
  }
}

export interface ConvexReviewCaseAssignmentPortConfig {
  convexSiteUrl: string;
  storageSecret: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function normalizeSiteUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch {
    throw new ConvexReviewCaseAssignmentPortError('Review storage configuration is invalid');
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new ConvexReviewCaseAssignmentPortError('Review storage configuration is invalid');
  }
  return url.toString().replace(/\/$/, '');
}

async function operationKeySha256(operationKey: string, actorId: string): Promise<string> {
  return sha256CanonicalJson({
    actor_id: actorId,
    action: 'AssignReviewer',
    operation_key: operationKey,
  });
}

export function createConvexReviewCaseAssignmentPort(
  config: ConvexReviewCaseAssignmentPortConfig,
): AssignReviewerWritePort {
  if (!config.storageSecret || config.storageSecret.length > 2_048) {
    throw new ConvexReviewCaseAssignmentPortError('Review storage configuration is invalid');
  }
  const siteUrl = normalizeSiteUrl(config.convexSiteUrl);
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new ConvexReviewCaseAssignmentPortError('Review storage configuration is invalid');
  }

  async function post(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`${siteUrl}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'chile-monitor-review-assignment/1.0',
          [SECRET_HEADER]: config.storageSecret,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ConvexReviewCaseAssignmentPortError('Review storage is unavailable');
    }
    if (!response.ok) {
      throw new ConvexReviewCaseAssignmentPortError(
        `Review storage returned HTTP ${response.status}`,
      );
    }
    try { return await response.json(); } catch {
      throw new ConvexReviewCaseAssignmentPortError('Review storage returned invalid JSON');
    }
  }

  return {
    async readAssignReviewerOperation(
      lookup: AssignReviewerOperationLookup,
    ): Promise<AssignReviewerOperationResult> {
      const value = await post('/api/internal-assign-reviewer-operation', {
        lookup: {
          operationKeySha256: await operationKeySha256(lookup.operationKey, lookup.actorId),
          commandSha256: lookup.commandSha256,
          actorId: lookup.actorId,
          municipalityCut: lookup.municipalityCut,
        },
      });
      const parsed = operationResultSchema.safeParse(value);
      if (!parsed.success) {
        throw new ConvexReviewCaseAssignmentPortError('Review storage returned invalid data');
      }
      return parsed.data;
    },

    async readReviewCaseSnapshot(lookup) {
      const value = await post('/api/internal-review-case-assignment-snapshot', { lookup });
      if (value === null || (typeof value === 'object' && !Array.isArray(value))) return value;
      throw new ConvexReviewCaseAssignmentPortError('Review storage returned invalid data');
    },

    async commitAssignReviewer(
      request: CommitAssignReviewerRequest,
    ): Promise<CommitAssignReviewerResult> {
      const operationHash = await operationKeySha256(
        request.operationKey,
        request.authorityFence.actorId,
      );
      const { operationKey: _operationKey, ...rest } = request;
      const value = await post('/api/internal-assign-reviewer', {
        request: { ...rest, operationKeySha256: operationHash },
      });
      const parsed = commitResultSchema.safeParse(value);
      if (!parsed.success) {
        throw new ConvexReviewCaseAssignmentPortError('Review storage returned invalid data');
      }
      return parsed.data;
    },
  };
}

export function createConvexReviewCaseAssignmentPortFromEnv(): AssignReviewerWritePort {
  const convexSiteUrl = process.env.CONVEX_SITE_URL ?? '';
  const storageSecret = process.env.REVIEW_CASE_STORAGE_SECRET ?? '';
  if (!convexSiteUrl || !storageSecret) {
    throw new ConvexReviewCaseAssignmentPortError('Review storage configuration is missing');
  }
  return createConvexReviewCaseAssignmentPort({ convexSiteUrl, storageSecret });
}
