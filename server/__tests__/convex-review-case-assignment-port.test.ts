// @vitest-environment node

import { describe, expect, test, vi } from 'vitest';

import {
  ConvexReviewCaseAssignmentPortError,
  createConvexReviewCaseAssignmentPort,
} from '../_shared/convex-review-case-assignment-port';
import { sha256CanonicalJson } from '../_shared/evidence-packet-canonical';
import type { CommitAssignReviewerRequest } from '../_shared/review-case-assigner';
import type { ReviewCaseSnapshot } from '../_shared/review-case-contract';

const NOW = '2026-08-31T11:00:00.000Z';

function snapshot(): ReviewCaseSnapshot {
  return {
    schema_version: '0.1.0', case_id: 'case-001', case_version: 1,
    municipality_cut: '10303', license_id: 'license-001', status: 'open',
    classification: ['ACTIVE_REVIEW', 'MUNICIPAL_INTERNAL'],
    created_at: NOW, updated_at: NOW,
    packet_ref: {
      packet_id: 'packet-001', packet_content_sha256: 'a'.repeat(64),
      packet_schema_version: '0.1.0', packet_generated_at: NOW,
      primary_release_id: 'purranque-2026-s1',
      required_markings: ['ACTIVE_REVIEW', 'MUNICIPAL_INTERNAL'],
    },
  };
}

function commitRequest(): CommitAssignReviewerRequest {
  const previous = snapshot();
  const resulting: ReviewCaseSnapshot = {
    ...previous, case_version: 2, status: 'in_review', assignment: {
      reviewer_id: 'reviewer-001', assigned_by: 'coordinator-001', assigned_at: NOW,
    },
  };
  return {
    operationKey: 'private-assignment-key', commandSha256: 'b'.repeat(64),
    expectedCaseVersion: 1, previousCaseSnapshot: previous,
    resultingCaseSnapshot: resulting,
    action: {
      schema_version: '0.1.0', action_id: 'action-001', action_type: 'AssignReviewer',
      case_id: 'case-001', municipality_cut: '10303', license_id: 'license-001',
      previous_case_version: 1, resulting_case_version: 2, reviewer_id: 'reviewer-001',
      actor_id: 'coordinator-001', actor_roles: ['coordinator'],
      authority_id: 'authority-001', authority_version: 1, occurred_at: NOW,
      legal_effect: 'none', packet_ref: previous.packet_ref, command_sha256: 'b'.repeat(64),
    },
    authorityFence: {
      authorityId: 'authority-001', authorityVersion: 1, actorId: 'coordinator-001',
      municipalityCut: '10303', action: 'AssignReviewer', evaluatedAt: NOW,
    },
    reviewerFence: { reviewerId: 'reviewer-001', municipalityCut: '10303', evaluatedAt: NOW },
  };
}

function portWith(fetchImpl: typeof fetch) {
  return createConvexReviewCaseAssignmentPort({
    convexSiteUrl: 'https://example.convex.site/',
    storageSecret: 'assignment-storage-secret',
    fetchImpl,
  });
}

describe('Convex review-case assignment port', () => {
  test('hashes operation keys with the AssignReviewer namespace', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ kind: 'miss' })) as unknown as typeof fetch;
    const port = portWith(fetchImpl);
    await port.readAssignReviewerOperation({
      operationKey: 'private-assignment-key', commandSha256: 'b'.repeat(64),
      actorId: 'coordinator-001', municipalityCut: '10303',
    });
    const [, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(JSON.stringify(body)).not.toContain('private-assignment-key');
    expect(body.lookup.operationKeySha256).toBe(await sha256CanonicalJson({
      actor_id: 'coordinator-001', action: 'AssignReviewer',
      operation_key: 'private-assignment-key',
    }));
    expect(new Headers(init?.headers).get('x-review-case-storage-secret'))
      .toBe('assignment-storage-secret');
  });

  test('reads the exact scoped snapshot through the internal route', async () => {
    const fetchImpl = vi.fn(async () => Response.json(snapshot())) as unknown as typeof fetch;
    const port = portWith(fetchImpl);
    await expect(port.readReviewCaseSnapshot({
      caseId: 'case-001', caseVersion: 1, municipalityCut: '10303',
    })).resolves.toMatchObject({ case_id: 'case-001', case_version: 1 });
    expect(vi.mocked(fetchImpl).mock.calls[0]?.[0])
      .toBe('https://example.convex.site/api/internal-review-case-assignment-snapshot');
  });

  test('commits without sending the raw idempotency key', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ kind: 'committed' })) as unknown as typeof fetch;
    const port = portWith(fetchImpl);
    await expect(port.commitAssignReviewer(commitRequest())).resolves.toEqual({ kind: 'committed' });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe('https://example.convex.site/api/internal-assign-reviewer');
    const wire = JSON.parse(String(init?.body)).request;
    expect(wire.operationKey).toBeUndefined();
    expect(wire.operationKeySha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test('fails closed on malformed storage results and insecure configuration', async () => {
    expect(() => createConvexReviewCaseAssignmentPort({
      convexSiteUrl: 'http://public.example.com', storageSecret: 'secret',
    })).toThrow(ConvexReviewCaseAssignmentPortError);
    const port = portWith(vi.fn(async () => Response.json({ kind: 'unknown' })) as unknown as typeof fetch);
    await expect(port.commitAssignReviewer(commitRequest()))
      .rejects.toBeInstanceOf(ConvexReviewCaseAssignmentPortError);
  });
});
