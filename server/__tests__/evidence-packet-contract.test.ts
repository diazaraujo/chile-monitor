// @vitest-environment node

import { describe, expect, test } from 'vitest';

import {
  EvidencePacketContractError,
  parseEvidencePacket,
} from '../_shared/evidence-packet-contract';

const SOURCE_REF = 'source-license';
const RELEASE_ID = 'commercial-licenses-2026-08-28-001';
const HASH = 'a'.repeat(64);

function packet(): Record<string, any> {
  return {
    packet_id: 'packet-001',
    schema_version: '0.1.0',
    generated_at: '2026-08-28T16:00:00Z',
    case_id: 'case-001',
    municipality_cut: '13101',
    classification: ['MUNICIPAL_INTERNAL', 'ACTIVE_REVIEW'],
    pinned_releases: [{
      producer: 'inteligencia-inmobiliaria',
      product: 'commercial-licenses',
      capability: 'patents.get',
      capability_version: '0.1.0',
      release_id: RELEASE_ID,
      schema_version: '0.1.0',
      data_as_of: '2026-08-28T12:00:00Z',
      promoted_at: '2026-08-28T13:00:00Z',
      quality_status: 'promoted',
      availability: 'current',
      data_marking: 'MUNICIPAL_INTERNAL',
      last_good_release_id: null,
      quality_report_uri: 'quality/report.json',
      queried_at: '2026-08-28T15:59:00Z',
      response_sha256: HASH,
      limitation_ids: [],
    }],
    license: {
      license_id: 'license-001',
      source_license_id: 'municipal-001',
      municipality_cut: '13101',
      license_type: 'commercial',
      reported_status: 'vigente',
      provisional_status: 'definitive',
      address: { original: 'Synthetic address', municipality_cut: '13101' },
      activities: ['retail'],
      observed_at: '2026-08-28T12:00:00Z',
      source_refs: [SOURCE_REF],
    },
    timeline: [{
      event_id: 'event-001',
      event_type: 'granted',
      effective_at: '2024-01-10T12:00:00Z',
      observed_at: '2026-08-28T12:00:00Z',
      source_refs: [SOURCE_REF],
    }],
    establishments: [{
      establishment_id: 'establishment-001',
      address: { original: 'Synthetic address', municipality_cut: '13101' },
      source_refs: [SOURCE_REF],
    }],
    parcel_resolutions: [{
      resolution_id: 'resolution-001',
      establishment_id: 'establishment-001',
      status: 'resolved',
      selected_candidate_id: 'candidate-001',
      candidates: [{
        candidate_id: 'candidate-001',
        parcel_id: 'parcel-001',
        method: 'source_role_exact',
        confidence: 0.99,
        parcel_release_id: 'parcels-2026-08-001',
        source_refs: [SOURCE_REF],
      }],
      resolved_at: '2026-08-28T15:59:00Z',
    }],
    holders: [{
      holder_id: 'holder-001',
      holder_kind: 'legal_entity',
      legal_entity_id: 'entity-001',
      legal_entity_rut: '76543210-K',
      display_name: 'Synthetic Company SpA',
      valid_from: '2024-01-10T12:00:00Z',
      source_refs: [SOURCE_REF],
    }],
    requirements: [{
      requirement_id: 'requirement-001',
      requirement_type: 'sanitary',
      reported_status: 'reported-current',
      source_refs: [SOURCE_REF],
    }],
    evidence: [{
      evidence_id: 'evidence-001',
      artifact_type: 'api_response',
      title: 'Synthetic response',
      captured_at: '2026-08-28T15:59:00Z',
      integrity: { sha256: HASH, byte_size: 100 },
      source_refs: [SOURCE_REF],
      supports: ['requirement-001'],
      classification: ['MUNICIPAL_INTERNAL'],
    }],
    source_refs: [{
      source_ref: SOURCE_REF,
      producer: 'inteligencia-inmobiliaria',
      product: 'commercial-licenses',
      release_id: RELEASE_ID,
      source_kind: 'capability_response',
      municipality_cut: '13101',
      observed_at: '2026-08-28T12:00:00Z',
    }],
    gaps: [],
    conflicts: [],
    alternative_explanations: [],
    legal_authorities: [],
    permitted_next_actions: [{
      action_id: 'action-review',
      action_type: 'AssignReviewer',
      permitted: true,
      authorized_roles: ['coordinator'],
      reason: 'Case is open',
      legal_effect: 'none',
      evaluated_at: '2026-08-28T16:00:00Z',
    }],
    recommended_next_action_id: 'action-review',
    reproducibility: {
      builder: 'chile-monitor',
      builder_version: '0.1.0',
      input_queries: [{
        producer: 'inteligencia-inmobiliaria',
        capability: 'patents.get',
        release_id: RELEASE_ID,
        request_sha256: HASH,
        response_sha256: HASH,
      }],
      packet_content_sha256: HASH,
    },
  };
}

function expectContractFailure(value: unknown, path?: string): void {
  try {
    parseEvidencePacket(value);
    throw new Error('expected contract failure');
  } catch (error) {
    expect(error).toBeInstanceOf(EvidencePacketContractError);
    if (path) expect((error as EvidencePacketContractError).path).toContain(path);
  }
}

describe('EvidencePacket runtime contract', () => {
  test('parses a minimal complete packet', () => {
    const parsed = parseEvidencePacket(packet());
    expect(parsed.schema_version).toBe('0.1.0');
    expect(parsed.recommended_next_action_id).toBe('action-review');
  });

  test('rejects additional properties and missing required fields', () => {
    const additional = packet();
    additional.license.untrusted_note = 'must not pass';
    expectContractFailure(additional, 'license');

    const missing = packet();
    delete missing.reproducibility;
    expectContractFailure(missing, 'reproducibility');
  });

  test('rejects invalid CUT, dates, legal-entity RUT, and SHA-256', () => {
    const mutations = [
      (value: Record<string, any>) => { value.municipality_cut = '1310'; },
      (value: Record<string, any>) => { value.generated_at = '2026-02-30T12:00:00Z'; },
      (value: Record<string, any>) => { value.holders[0].legal_entity_rut = 'invalid-rut'; },
      (value: Record<string, any>) => { value.reproducibility.packet_content_sha256 = 'abc'; },
    ];
    for (const mutate of mutations) {
      const value = packet();
      mutate(value);
      expectContractFailure(value);
    }
  });

  test('requires last-good metadata for stale releases', () => {
    const value = packet();
    value.pinned_releases[0].availability = 'stale_last_good';
    expectContractFailure(value, 'last_good_release_id');

    value.pinned_releases[0].last_good_release_id = 'commercial-licenses-2026-08-21-001';
    expect(parseEvidencePacket(value).pinned_releases[0].availability).toBe('stale_last_good');
  });

  test('requires explicit natural-person redaction', () => {
    const value = packet();
    Object.assign(value.holders[0], {
      holder_kind: 'natural_person_redacted',
      legal_entity_id: null,
      legal_entity_rut: null,
      display_name: 'REDACTED',
    });
    expect(parseEvidencePacket(value).holders[0].display_name).toBe('REDACTED');

    value.holders[0].display_name = 'Private name';
    expectContractFailure(value, 'display_name');
  });

  test('enforces all parcel-resolution states and candidate references', () => {
    const ambiguous = packet();
    ambiguous.parcel_resolutions[0].status = 'ambiguous';
    ambiguous.parcel_resolutions[0].selected_candidate_id = null;
    expect(parseEvidencePacket(ambiguous).parcel_resolutions[0].status).toBe('ambiguous');

    const invalidAmbiguous = packet();
    invalidAmbiguous.parcel_resolutions[0].status = 'ambiguous';
    expectContractFailure(invalidAmbiguous, 'selected_candidate_id');

    const invalidResolved = packet();
    invalidResolved.parcel_resolutions[0].selected_candidate_id = 'missing-candidate';
    expectContractFailure(invalidResolved, 'selected_candidate_id');

    const unresolved = packet();
    unresolved.parcel_resolutions[0].status = 'unresolved';
    unresolved.parcel_resolutions[0].selected_candidate_id = null;
    unresolved.parcel_resolutions[0].candidates = [];
    expect(parseEvidencePacket(unresolved).parcel_resolutions[0].status).toBe('unresolved');
  });

  test('requires at least one permitted action and a coherent recommendation', () => {
    const nonePermitted = packet();
    nonePermitted.permitted_next_actions[0].permitted = false;
    nonePermitted.recommended_next_action_id = null;
    expectContractFailure(nonePermitted, 'permitted_next_actions');

    const missing = packet();
    missing.recommended_next_action_id = 'missing-action';
    expectContractFailure(missing, 'recommended_next_action_id');

    const blocked = packet();
    blocked.permitted_next_actions.push({
      ...blocked.permitted_next_actions[0],
      action_id: 'action-blocked',
      permitted: false,
    });
    blocked.recommended_next_action_id = 'action-blocked';
    expectContractFailure(blocked, 'recommended_next_action_id');
  });

  test('rejects unresolved object, evidence, source, action, and release references', () => {
    const mutations: Array<[string, (value: Record<string, any>) => void]> = [
      ['source_refs', (value) => { value.requirements[0].source_refs = ['missing-source']; }],
      ['establishment_id', (value) => { value.parcel_resolutions[0].establishment_id = 'missing-establishment'; }],
      ['supports', (value) => { value.evidence[0].supports = ['missing-object']; }],
      ['evidence_refs', (value) => {
        value.alternative_explanations.push({
          explanation_id: 'explanation-001', description: 'Synthetic explanation', status: 'proposed',
          recorded_at: '2026-08-28T16:00:00Z', evidence_refs: ['missing-evidence'], source_refs: [SOURCE_REF],
        });
      }],
      ['release_id', (value) => { value.reproducibility.input_queries[0].release_id = 'missing-release'; }],
    ];
    for (const [path, mutate] of mutations) {
      const value = packet();
      mutate(value);
      expectContractFailure(value, path);
    }
  });

  test('rejects duplicate identifiers and mismatched municipality CUTs', () => {
    const duplicate = packet();
    duplicate.source_refs.push({ ...duplicate.source_refs[0] });
    expectContractFailure(duplicate, 'source_refs');

    const wrongCut = packet();
    wrongCut.establishments[0].address.municipality_cut = '13102';
    expectContractFailure(wrongCut, 'municipality_cut');
  });

  test('requires query response hashes to match their pinned releases', () => {
    const value = packet();
    value.reproducibility.input_queries[0].response_sha256 = 'b'.repeat(64);
    expectContractFailure(value, 'response_sha256');
  });

  test('errors are typed and never echo rejected values', () => {
    const value = packet();
    const sensitive = '76543210-K-at-Synthetic-address';
    value.packet_id = sensitive;
    value.unexpected = sensitive;
    try {
      parseEvidencePacket(value);
      throw new Error('expected contract failure');
    } catch (error) {
      expect(error).toBeInstanceOf(EvidencePacketContractError);
      expect((error as Error).message).not.toContain(sensitive);
      expect((error as Error).message).not.toContain('Synthetic address');
    }
  });
});
