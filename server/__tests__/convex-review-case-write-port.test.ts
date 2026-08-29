// @vitest-environment node

import { describe, expect, test, vi } from 'vitest';

import { hashEvidencePacketContent, sha256CanonicalJson } from '../_shared/evidence-packet-canonical';
import {
  ConvexReviewCaseWritePortError,
  createConvexReviewCaseWritePort,
} from '../_shared/convex-review-case-write-port';
import type { CommitOpenLicenseReviewRequest } from '../_shared/review-case-opener';

const NOW = '2026-08-29T12:00:00.000Z';
const HASH = 'a'.repeat(64);

async function commitRequest(): Promise<CommitOpenLicenseReviewRequest> {
  const packet: Record<string, any> = {
    packet_id: 'packet-001', schema_version: '0.1.0', generated_at: NOW,
    case_id: 'case-001', municipality_cut: '13101',
    classification: ['ACTIVE_REVIEW', 'MUNICIPAL_INTERNAL'],
    pinned_releases: [{
      producer: 'inteligencia-inmobiliaria', product: 'commercial-licenses',
      capability: 'patents.get', capability_version: '0.1.0', release_id: 'release-001',
      schema_version: '0.1.0', data_as_of: NOW, promoted_at: NOW,
      quality_status: 'promoted', availability: 'current', data_marking: 'LICENSED',
      last_good_release_id: null, quality_report_uri: 'quality/report.json',
      queried_at: NOW, response_sha256: HASH,
    }],
    license: {
      license_id: 'license-001', source_license_id: 'municipal-001',
      municipality_cut: '13101', license_type: 'commercial', reported_status: 'vigente',
      provisional_status: 'definitive',
      address: { original: 'Synthetic address', municipality_cut: '13101' },
      activities: ['retail'], observed_at: NOW, source_refs: ['source-001'],
    },
    timeline: [], establishments: [], parcel_resolutions: [], holders: [], requirements: [],
    evidence: [],
    source_refs: [{
      source_ref: 'source-001', producer: 'inteligencia-inmobiliaria',
      product: 'commercial-licenses', release_id: 'release-001',
      source_kind: 'capability_response', municipality_cut: '13101', observed_at: NOW,
    }],
    gaps: [], conflicts: [], alternative_explanations: [], legal_authorities: [],
    permitted_next_actions: [{
      action_id: 'assign-reviewer-policy', action_type: 'AssignReviewer', permitted: true,
      authorized_roles: ['coordinator'], reason: 'The new case requires an owner',
      legal_effect: 'none', evaluated_at: NOW,
    }],
    recommended_next_action_id: 'assign-reviewer-policy',
    reproducibility: {
      builder: 'chile-monitor', builder_version: '0.1.0',
      input_queries: [{
        producer: 'inteligencia-inmobiliaria', capability: 'patents.get',
        release_id: 'release-001', request_sha256: HASH, response_sha256: HASH,
      }],
      packet_content_sha256: HASH,
    },
  };
  packet.reproducibility.packet_content_sha256 = await hashEvidencePacketContent(packet);
  const contentHash = packet.reproducibility.packet_content_sha256 as string;
  const packetRef = {
    packet_id: 'packet-001', packet_content_sha256: contentHash,
    packet_schema_version: '0.1.0' as const, packet_generated_at: NOW,
    primary_release_id: 'release-001',
    required_markings: ['ACTIVE_REVIEW', 'LICENSED', 'MUNICIPAL_INTERNAL'] as const,
  };
  const json = JSON.stringify(packet);
  return {
    operationKey: 'private-operation-key-001', commandSha256: 'b'.repeat(64),
    activeCaseKey: '13101:license-001', expectedCaseVersion: 0,
    caseSnapshot: {
      schema_version: '0.1.0', case_id: 'case-001', case_version: 1,
      municipality_cut: '13101', license_id: 'license-001', status: 'open',
      classification: ['ACTIVE_REVIEW', 'MUNICIPAL_INTERNAL'],
      created_at: NOW, updated_at: NOW,
      packet_ref: { ...packetRef, required_markings: [...packetRef.required_markings] },
    },
    evidencePacketSnapshot: {
      nature: 'historical_non_executable', json,
      bytes: new TextEncoder().encode(json).byteLength,
    },
    action: {
      schema_version: '0.1.0', action_id: 'action-001', action_type: 'OpenLicenseReview',
      case_id: 'case-001', municipality_cut: '13101', license_id: 'license-001',
      previous_case_version: 0, resulting_case_version: 1,
      actor_id: 'actor-001', actor_roles: ['rentas'], authority_id: 'authority-001',
      authority_version: 3, occurred_at: NOW, legal_effect: 'none',
      packet_ref: { ...packetRef, required_markings: [...packetRef.required_markings] },
      command_sha256: 'b'.repeat(64),
    },
    authorityFence: {
      authorityId: 'authority-001', authorityVersion: 3, actorId: 'actor-001',
      municipalityCut: '13101', action: 'OpenLicenseReview',
      requiredMarkings: [...packetRef.required_markings],
      representation: 'municipal_restricted', evaluatedAt: NOW,
    },
  };
}

function portWith(fetchImpl: typeof fetch) {
  return createConvexReviewCaseWritePort({
    convexSiteUrl: 'https://example.convex.site/',
    storageSecret: 'dedicated-review-secret',
    fetchImpl,
  });
}

describe('Convex review-case write port', () => {
  test('hashes the actor-scoped operation key and never sends the raw key', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ kind: 'miss' })) as unknown as typeof fetch;
    const port = portWith(fetchImpl);
    await expect(port.readOpenLicenseReviewOperation({
      operationKey: 'private-operation-key-001', commandSha256: 'b'.repeat(64),
      actorId: 'actor-001', municipalityCut: '13101',
    })).resolves.toEqual({ kind: 'miss' });

    const [, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(JSON.stringify(body)).not.toContain('private-operation-key-001');
    expect(body.lookup.operationKeySha256).toBe(await sha256CanonicalJson({
      actor_id: 'actor-001', action: 'OpenLicenseReview',
      operation_key: 'private-operation-key-001',
    }));
    expect(new Headers(init?.headers).get('x-review-case-storage-secret'))
      .toBe('dedicated-review-secret');
  });

  test('verifies packet content and sends bounded contiguous chunks', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ kind: 'committed' })) as unknown as typeof fetch;
    const port = portWith(fetchImpl);
    const request = await commitRequest();
    await expect(port.commitOpenLicenseReview(request)).resolves.toEqual({ kind: 'committed' });

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe('https://example.convex.site/api/internal-open-license-review');
    const wire = JSON.parse(String(init?.body)).request;
    expect(wire.operationKey).toBeUndefined();
    expect(wire.evidencePacketSnapshot.json).toBeUndefined();
    expect(wire.evidencePacketSnapshot.bytes).toBe(request.evidencePacketSnapshot.bytes);
    expect(wire.evidencePacketSnapshot.chunks[0].ordinal).toBe(0);
    expect(wire.evidencePacketSnapshot.chunks[0].byteLength)
      .toBe(request.evidencePacketSnapshot.bytes);
  });

  test('does not call storage when the packet hash is altered', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ kind: 'committed' })) as unknown as typeof fetch;
    const port = portWith(fetchImpl);
    const request = await commitRequest();
    request.caseSnapshot.packet_ref.packet_content_sha256 = 'f'.repeat(64);
    await expect(port.commitOpenLicenseReview(request)).rejects
      .toBeInstanceOf(ConvexReviewCaseWritePortError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('fails closed on non-2xx and malformed result payloads', async () => {
    const unavailable = portWith(vi.fn(async () => new Response('{}', { status: 503 })) as unknown as typeof fetch);
    await expect(unavailable.readOpenLicenseReviewOperation({
      operationKey: 'key', commandSha256: 'b'.repeat(64), actorId: 'actor', municipalityCut: '13101',
    })).rejects.toBeInstanceOf(ConvexReviewCaseWritePortError);

    const malformed = portWith(vi.fn(async () => Response.json({ kind: 'unknown' })) as unknown as typeof fetch);
    await expect(malformed.readOpenLicenseReviewOperation({
      operationKey: 'key', commandSha256: 'b'.repeat(64), actorId: 'actor', municipalityCut: '13101',
    })).rejects.toBeInstanceOf(ConvexReviewCaseWritePortError);
  });
});
