import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");
const NOW = Date.parse("2026-08-29T12:00:00.000Z");
const HASH = "a".repeat(64);
const OPERATION_HASH = "b".repeat(64);
const COMMAND_HASH = "c".repeat(64);
const reviewApi = anyApi.reviewCases!;
const originalReviewStorageSecret = process.env.REVIEW_CASE_STORAGE_SECRET;

function authority(overrides: Record<string, unknown> = {}) {
  return {
    authorityId: "authority-001",
    authorityVersion: 3,
    actorId: "actor-001",
    municipalityCut: "13101",
    roles: ["rentas"],
    permittedActions: ["OpenLicenseReview"],
    allowedMarkings: ["ACTIVE_REVIEW", "MUNICIPAL_INTERNAL"],
    allowedRepresentations: ["public", "municipal_restricted"],
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: null,
    revokedAt: null,
    ...overrides,
  };
}

function commitRequest(overrides: Record<string, unknown> = {}) {
  const packet = {
    packet_id: "packet-001",
    schema_version: "0.1.0",
    generated_at: "2026-08-29T12:00:00.000Z",
    case_id: "case-001",
    municipality_cut: "13101",
    classification: ["ACTIVE_REVIEW", "MUNICIPAL_INTERNAL"],
    pinned_releases: [{
      producer: "inteligencia-inmobiliaria",
      product: "commercial-licenses",
      capability: "patents.get",
      release_id: "release-001",
    }],
    license: { license_id: "license-001" },
    reproducibility: {
      packet_content_sha256: HASH,
      input_queries: [{
        producer: "inteligencia-inmobiliaria",
        capability: "patents.get",
        release_id: "release-001",
      }],
    },
  };
  const json = JSON.stringify(packet);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const packetRef = {
    packet_id: "packet-001",
    packet_content_sha256: HASH,
    packet_schema_version: "0.1.0",
    packet_generated_at: "2026-08-29T12:00:00.000Z",
    primary_release_id: "release-001",
    required_markings: ["ACTIVE_REVIEW", "MUNICIPAL_INTERNAL"],
  };
  return {
    operationKeySha256: OPERATION_HASH,
    commandSha256: COMMAND_HASH,
    activeCaseKey: "13101:license-001",
    expectedCaseVersion: 0,
    caseSnapshot: {
      schema_version: "0.1.0",
      case_id: "case-001",
      case_version: 1,
      municipality_cut: "13101",
      license_id: "license-001",
      status: "open",
      classification: ["ACTIVE_REVIEW", "MUNICIPAL_INTERNAL"],
      created_at: "2026-08-29T12:00:00.000Z",
      updated_at: "2026-08-29T12:00:00.000Z",
      packet_ref: packetRef,
    },
    evidencePacketSnapshot: {
      nature: "historical_non_executable",
      bytes: bytes.byteLength,
      chunks: [{ ordinal: 0, encodedBase64: btoa(binary), byteLength: bytes.byteLength }],
    },
    action: {
      schema_version: "0.1.0",
      action_id: "action-001",
      action_type: "OpenLicenseReview",
      case_id: "case-001",
      municipality_cut: "13101",
      license_id: "license-001",
      previous_case_version: 0,
      resulting_case_version: 1,
      actor_id: "actor-001",
      actor_roles: ["rentas"],
      authority_id: "authority-001",
      authority_version: 3,
      occurred_at: "2026-08-29T12:00:00.000Z",
      legal_effect: "none",
      packet_ref: packetRef,
      command_sha256: COMMAND_HASH,
    },
    authorityFence: {
      authorityId: "authority-001",
      authorityVersion: 3,
      actorId: "actor-001",
      municipalityCut: "13101",
      action: "OpenLicenseReview",
      requiredMarkings: ["ACTIVE_REVIEW", "MUNICIPAL_INTERNAL"],
      representation: "municipal_restricted",
      evaluatedAt: "2026-08-29T12:00:00.000Z",
    },
    ...overrides,
  };
}

async function harness() {
  const t = convexTest(schema, modules);
  await t.mutation(reviewApi._seedReviewWriteLock as any, {});
  await t.mutation(reviewApi.upsertAuthorityGrant as any, authority());
  return t;
}

describe("commercial-license review storage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.REVIEW_CASE_STORAGE_SECRET = "review-storage-test-secret";
  });
  afterEach(() => {
    vi.useRealTimers();
    if (originalReviewStorageSecret === undefined) delete process.env.REVIEW_CASE_STORAGE_SECRET;
    else process.env.REVIEW_CASE_STORAGE_SECRET = originalReviewStorageSecret;
  });

  test("keeps operation lookup private and no-store", async () => {
    const t = await harness();
    const unauthorized = await t.fetch("/api/internal-review-case-operation", {
      method: "POST",
      body: JSON.stringify({ lookup: {} }),
    });
    expect(unauthorized.status).toBe(401);

    const authorized = await t.fetch("/api/internal-review-case-operation", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-review-case-storage-secret": "review-storage-test-secret",
      },
      body: JSON.stringify({
        lookup: {
          operationKeySha256: OPERATION_HASH,
          commandSha256: COMMAND_HASH,
          actorId: "actor-001",
          municipalityCut: "13101",
        },
      }),
    });
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("cache-control")).toBe("no-store");
    expect(await authorized.json()).toEqual({ kind: "miss" });
  });

  test("commits packet, case, active pointer, action and operation atomically", async () => {
    const t = await harness();
    await expect(t.mutation(
      reviewApi.commitOpenLicenseReview as any,
      { request: commitRequest() },
    )).resolves.toEqual({ kind: "committed" });

    const counts = await t.run(async (ctx) => ({
      packets: (await ctx.db.query("reviewEvidencePackets").collect()).length,
      chunks: (await ctx.db.query("reviewEvidencePacketChunks").collect()).length,
      cases: (await ctx.db.query("reviewCases").collect()).length,
      active: (await ctx.db.query("reviewActiveCases").collect()).length,
      actions: (await ctx.db.query("reviewActions").collect()).length,
      operations: (await ctx.db.query("reviewOperations").collect()).length,
    }));
    expect(counts).toEqual({ packets: 1, chunks: 1, cases: 1, active: 1, actions: 1, operations: 1 });
  });

  test("replays the same actor/action operation without inserting again", async () => {
    const t = await harness();
    const request = commitRequest();
    await t.mutation(reviewApi.commitOpenLicenseReview as any, { request });
    const replay = await t.mutation(reviewApi.commitOpenLicenseReview as any, { request });
    expect(replay.kind).toBe("replayed");
    expect(replay.receipt.replayed).toBe(false);
    expect(replay.receipt.case.case_id).toBe("case-001");
  });

  test("binds an operation key to its original command across municipalities", async () => {
    const t = await harness();
    await t.mutation(reviewApi.commitOpenLicenseReview as any, { request: commitRequest() });
    const result = await t.query(reviewApi.readOpenLicenseReviewOperation as any, {
      lookup: {
        operationKeySha256: OPERATION_HASH,
        commandSha256: COMMAND_HASH,
        actorId: "actor-001",
        municipalityCut: "05109",
      },
    });
    expect(result).toEqual({ kind: "operation_conflict" });
  });

  test("rejects a second active case for the same license", async () => {
    const t = await harness();
    await t.mutation(reviewApi.commitOpenLicenseReview as any, { request: commitRequest() });
    const second = commitRequest({ operationKeySha256: "d".repeat(64) });
    second.caseSnapshot.case_id = "case-002";
    second.action.case_id = "case-002";
    second.action.action_id = "action-002";
    const packet = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(second.evidencePacketSnapshot.chunks[0]!.encodedBase64), (c) => c.charCodeAt(0)),
    ));
    packet.case_id = "case-002";
    packet.packet_id = "packet-002";
    const json = JSON.stringify(packet);
    const encoded = new TextEncoder().encode(json);
    let binary = "";
    for (const byte of encoded) binary += String.fromCharCode(byte);
    second.evidencePacketSnapshot = {
      nature: "historical_non_executable",
      bytes: encoded.byteLength,
      chunks: [{ ordinal: 0, encodedBase64: btoa(binary), byteLength: encoded.byteLength }],
    };
    second.caseSnapshot.packet_ref.packet_id = "packet-002";
    second.action.packet_ref.packet_id = "packet-002";
    expect(await t.mutation(reviewApi.commitOpenLicenseReview as any, { request: second }))
      .toEqual({ kind: "active_case_conflict" });
  });

  test("fails closed when authority representation is not currently allowed", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(reviewApi._seedReviewWriteLock as any, {});
    await t.mutation(reviewApi.upsertAuthorityGrant as any, authority({
      allowedRepresentations: ["public"],
    }));
    expect(await t.mutation(reviewApi.commitOpenLicenseReview as any, {
      request: commitRequest(),
    })).toEqual({ kind: "cas_conflict" });
  });

  test("rolls back every table on malformed packet chunks", async () => {
    const t = await harness();
    const request = commitRequest();
    request.evidencePacketSnapshot.chunks[0]!.encodedBase64 = "not base64";
    await expect(t.mutation(reviewApi.commitOpenLicenseReview as any, { request })).rejects.toThrow();
    const rows = await t.run(async (ctx) => await ctx.db.query("reviewCases").collect());
    expect(rows).toHaveLength(0);
  });
});
