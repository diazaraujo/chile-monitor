import { ConvexError, v } from "convex/values";

import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";

const ACTION = "OpenLicenseReview";
const PACKET_NATURE = "historical_non_executable";
const PACKET_SCHEMA_VERSION = "0.1.0";
const BASE_CLASSIFICATION = ["ACTIVE_REVIEW", "MUNICIPAL_INTERNAL"] as const;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const CUT = /^\d{5}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export const REVIEW_PACKET_MAX_BYTES = 2 * 1024 * 1024;
export const REVIEW_PACKET_CHUNK_MAX_BYTES = 192 * 1024;

const lookupValidator = v.object({
  operationKeySha256: v.string(),
  commandSha256: v.string(),
  actorId: v.string(),
  municipalityCut: v.string(),
});

const authorityFenceValidator = v.object({
  authorityId: v.string(),
  authorityVersion: v.number(),
  actorId: v.string(),
  municipalityCut: v.string(),
  action: v.literal("OpenLicenseReview"),
  requiredMarkings: v.array(v.string()),
  representation: v.union(v.literal("public"), v.literal("municipal_restricted")),
  evaluatedAt: v.string(),
});

const packetChunkValidator = v.object({
  ordinal: v.number(),
  encodedBase64: v.string(),
  byteLength: v.number(),
});

const commitValidator = v.object({
  operationKeySha256: v.string(),
  commandSha256: v.string(),
  activeCaseKey: v.string(),
  expectedCaseVersion: v.number(),
  caseSnapshot: v.any(),
  evidencePacketSnapshot: v.object({
    nature: v.string(),
    bytes: v.number(),
    chunks: v.array(packetChunkValidator),
  }),
  action: v.any(),
  authorityFence: authorityFenceValidator,
});

const authorityGrantValidator = v.object({
  authorityId: v.string(),
  authorityVersion: v.number(),
  actorId: v.string(),
  municipalityCut: v.string(),
  roles: v.array(v.union(v.literal("rentas"), v.literal("control"))),
  permittedActions: v.array(v.literal("OpenLicenseReview")),
  allowedMarkings: v.array(v.union(
    v.literal("PUBLIC"), v.literal("PII"), v.literal("LICENSED"),
    v.literal("MUNICIPAL_INTERNAL"), v.literal("ACTIVE_REVIEW"), v.literal("AUTHORITY_ONLY"),
  )),
  allowedRepresentations: v.array(v.union(
    v.literal("public"), v.literal("municipal_restricted"),
  )),
  validFrom: v.string(),
  validTo: v.union(v.string(), v.null()),
  revokedAt: v.union(v.string(), v.null()),
});

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  const values = value as string[];
  return new Set(values).size === values.length ? values : null;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function validInstant(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function failIntegrity(): never {
  throw new ConvexError("REVIEW_STORAGE_INTEGRITY");
}

function validateLookup(lookup: {
  operationKeySha256: string;
  commandSha256: string;
  actorId: string;
  municipalityCut: string;
}): void {
  if (
    !SHA256.test(lookup.operationKeySha256)
    || !SHA256.test(lookup.commandSha256)
    || !IDENTIFIER.test(lookup.actorId)
    || !CUT.test(lookup.municipalityCut)
  ) failIntegrity();
}

async function uniqueByIndex<T>(rows: T[]): Promise<T | null> {
  if (rows.length > 1) failIntegrity();
  return rows[0] ?? null;
}

async function loadReceipt(
  ctx: QueryCtx | MutationCtx,
  binding: { caseId: string; actionId: string },
): Promise<JsonRecord> {
  const caseRows = await ctx.db
    .query("reviewCases")
    .withIndex("by_case_version", (q) => q.eq("caseId", binding.caseId).eq("caseVersion", 1))
    .collect();
  const actionRows = await ctx.db
    .query("reviewActions")
    .withIndex("by_actionId", (q) => q.eq("actionId", binding.actionId))
    .collect();
  const caseRow = await uniqueByIndex(caseRows);
  const actionRow = await uniqueByIndex(actionRows);
  if (!caseRow || !actionRow || actionRow.caseId !== caseRow.caseId) failIntegrity();
  try {
    return {
      schema_version: PACKET_SCHEMA_VERSION,
      case: JSON.parse(caseRow.snapshotJson),
      action: JSON.parse(actionRow.actionJson),
      replayed: false,
    };
  } catch {
    return failIntegrity();
  }
}

async function findOperation(
  ctx: QueryCtx | MutationCtx,
  actorId: string,
  operationKeySha256: string,
) {
  const rows = await ctx.db
    .query("reviewOperations")
    .withIndex("by_actor_action_key", (q) => (
      q.eq("actorId", actorId).eq("actionType", ACTION)
        .eq("operationKeySha256", operationKeySha256)
    ))
    .collect();
  return await uniqueByIndex(rows);
}

export const readOpenLicenseReviewOperation = internalQuery({
  args: { lookup: lookupValidator },
  handler: async (ctx, args) => {
    validateLookup(args.lookup);
    const binding = await findOperation(ctx, args.lookup.actorId, args.lookup.operationKeySha256);
    if (!binding) return { kind: "miss" as const };
    if (
      binding.commandSha256 !== args.lookup.commandSha256
      || binding.municipalityCut !== args.lookup.municipalityCut
    ) return { kind: "operation_conflict" as const };
    return {
      kind: "replayed" as const,
      receipt: await loadReceipt(ctx, binding),
    };
  },
});

function validateGrantInput(args: {
  authorityId: string;
  authorityVersion: number;
  actorId: string;
  municipalityCut: string;
  roles: string[];
  permittedActions: string[];
  allowedMarkings: string[];
  allowedRepresentations: string[];
  validFrom: string;
  validTo: string | null;
  revokedAt: string | null;
}): void {
  const roles = new Set(["rentas", "control"]);
  const markings = new Set([
    "PUBLIC", "PII", "LICENSED", "MUNICIPAL_INTERNAL", "ACTIVE_REVIEW", "AUTHORITY_ONLY",
  ]);
  const representations = new Set(["public", "municipal_restricted"]);
  if (
    !IDENTIFIER.test(args.authorityId)
    || !Number.isSafeInteger(args.authorityVersion)
    || args.authorityVersion < 1
    || !IDENTIFIER.test(args.actorId)
    || !CUT.test(args.municipalityCut)
    || args.roles.length === 0
    || new Set(args.roles).size !== args.roles.length
    || args.roles.some((role) => !roles.has(role))
    || !sameSet(args.permittedActions, [ACTION])
    || args.allowedMarkings.length === 0
    || new Set(args.allowedMarkings).size !== args.allowedMarkings.length
    || args.allowedMarkings.some((marking) => !markings.has(marking))
    || args.allowedRepresentations.length === 0
    || new Set(args.allowedRepresentations).size !== args.allowedRepresentations.length
    || args.allowedRepresentations.some((item) => !representations.has(item))
    || !validInstant(args.validFrom)
    || (args.validTo !== null && !validInstant(args.validTo))
    || (args.validTo !== null && Date.parse(args.validTo) <= Date.parse(args.validFrom))
    || (args.revokedAt !== null && !validInstant(args.revokedAt))
  ) throw new ConvexError("INVALID_REVIEW_AUTHORITY_GRANT");
}

/** Operator-only provisioning primitive; no public function or browser route exposes it. */
export const _seedReviewWriteLock = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("reviewWriteLocks")
      .withIndex("by_lockKey", (q) => q.eq("lockKey", "review-write"))
      .collect();
    if (rows.length > 1) failIntegrity();
    if (rows.length === 0) {
      await ctx.db.insert("reviewWriteLocks", {
        lockKey: "review-write",
        lastTouchedAt: Date.now(),
      });
      return { seeded: true };
    }
    return { seeded: false };
  },
});

/** Operator-only provisioning primitive; no public function or browser route exposes it. */
export const upsertAuthorityGrant = internalMutation({
  args: authorityGrantValidator,
  handler: async (ctx, args) => {
    validateGrantInput(args);
    const now = Date.now();
    const existingRows = await ctx.db
      .query("reviewAuthorityGrants")
      .withIndex("by_authorityId", (q) => q.eq("authorityId", args.authorityId))
      .collect();
    const existing = await uniqueByIndex(existingRows);
    if (existing) {
      if (
        existing.actorId !== args.actorId
        || existing.municipalityCut !== args.municipalityCut
        || args.authorityVersion <= existing.authorityVersion
      ) throw new ConvexError("INVALID_REVIEW_AUTHORITY_ADVANCE");
      await ctx.db.replace(existing._id, {
        ...args,
        validTo: args.validTo ?? undefined,
        revokedAt: args.revokedAt ?? undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("reviewAuthorityGrants", {
        ...args,
        validTo: args.validTo ?? undefined,
        revokedAt: args.revokedAt ?? undefined,
        updatedAt: now,
      });
    }

    const writeLocks = await ctx.db
      .query("reviewWriteLocks")
      .withIndex("by_lockKey", (q) => q.eq("lockKey", "review-write"))
      .collect();
    if (writeLocks.length > 1) failIntegrity();
    if (writeLocks.length === 0) throw new ConvexError("REVIEW_WRITE_LOCK_NOT_SEEDED");
    await ctx.db.patch(writeLocks[0]!._id, { lastTouchedAt: now });
    return { authorityId: args.authorityId, authorityVersion: args.authorityVersion };
  },
});

function decodePacketSnapshot(snapshot: {
  nature: string;
  bytes: number;
  chunks: { ordinal: number; encodedBase64: string; byteLength: number }[];
}): { json: string; chunks: { ordinal: number; encodedBase64: string; byteLength: number }[] } {
  if (
    snapshot.nature !== PACKET_NATURE
    || !Number.isSafeInteger(snapshot.bytes)
    || snapshot.bytes <= 0
    || snapshot.bytes > REVIEW_PACKET_MAX_BYTES
    || snapshot.chunks.length === 0
  ) failIntegrity();
  const byteChunks: Uint8Array[] = [];
  let total = 0;
  for (let index = 0; index < snapshot.chunks.length; index++) {
    const chunk = snapshot.chunks[index]!;
    if (
      chunk.ordinal !== index
      || !Number.isSafeInteger(chunk.byteLength)
      || chunk.byteLength <= 0
      || chunk.byteLength > REVIEW_PACKET_CHUNK_MAX_BYTES
    ) failIntegrity();
    let binary: string;
    try {
      binary = atob(chunk.encodedBase64);
    } catch {
      return failIntegrity();
    }
    if (binary.length !== chunk.byteLength || btoa(binary) !== chunk.encodedBase64) failIntegrity();
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    byteChunks.push(bytes);
    total += bytes.byteLength;
  }
  if (total !== snapshot.bytes) failIntegrity();
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const bytes of byteChunks) {
    joined.set(bytes, offset);
    offset += bytes.byteLength;
  }
  try {
    return {
      json: new TextDecoder("utf-8", { fatal: true }).decode(joined),
      chunks: snapshot.chunks,
    };
  } catch {
    return failIntegrity();
  }
}

function validateCommitPayload(args: {
  operationKeySha256: string;
  commandSha256: string;
  activeCaseKey: string;
  expectedCaseVersion: number;
  caseSnapshot: unknown;
  action: unknown;
  authorityFence: {
    authorityId: string;
    authorityVersion: number;
    actorId: string;
    municipalityCut: string;
    action: string;
    requiredMarkings: string[];
    representation: string;
    evaluatedAt: string;
  };
}, packetJson: string): {
  snapshot: JsonRecord;
  action: JsonRecord;
  packet: JsonRecord;
  packetRef: JsonRecord;
  packetId: string;
  caseId: string;
  actionId: string;
  licenseId: string;
  occurredAt: number;
} {
  validateLookup({
    operationKeySha256: args.operationKeySha256,
    commandSha256: args.commandSha256,
    actorId: args.authorityFence.actorId,
    municipalityCut: args.authorityFence.municipalityCut,
  });
  const snapshot = record(args.caseSnapshot);
  const action = record(args.action);
  let packetValue: unknown;
  try {
    packetValue = JSON.parse(packetJson);
  } catch {
    return failIntegrity();
  }
  const packet = record(packetValue);
  const packetRef = record(snapshot?.packet_ref);
  const actionPacketRef = record(action?.packet_ref);
  const reproduction = record(packet?.reproducibility);
  const license = record(packet?.license);
  const classification = stringArray(snapshot?.classification);
  const packetClassification = stringArray(packet?.classification);
  const requiredMarkings = stringArray(packetRef?.required_markings);
  const actorRoles = stringArray(action?.actor_roles);
  if (
    !snapshot || !action || !packet || !packetRef || !actionPacketRef || !reproduction || !license
    || !classification || !packetClassification || !requiredMarkings || !actorRoles
    || snapshot.schema_version !== PACKET_SCHEMA_VERSION
    || snapshot.case_version !== 1
    || snapshot.status !== "open"
    || !sameSet(classification, BASE_CLASSIFICATION)
    || packet.schema_version !== PACKET_SCHEMA_VERSION
    || !sameSet(packetClassification, BASE_CLASSIFICATION)
    || action.schema_version !== PACKET_SCHEMA_VERSION
    || action.action_type !== ACTION
    || action.previous_case_version !== 0
    || action.resulting_case_version !== 1
    || action.legal_effect !== "none"
    || action.command_sha256 !== args.commandSha256
    || action.actor_id !== args.authorityFence.actorId
    || action.authority_id !== args.authorityFence.authorityId
    || action.authority_version !== args.authorityFence.authorityVersion
    || args.expectedCaseVersion !== 0
    || snapshot.municipality_cut !== args.authorityFence.municipalityCut
    || action.municipality_cut !== snapshot.municipality_cut
    || packet.municipality_cut !== snapshot.municipality_cut
    || action.case_id !== snapshot.case_id
    || packet.case_id !== snapshot.case_id
    || action.license_id !== snapshot.license_id
    || license.license_id !== snapshot.license_id
    || packetRef.packet_id !== packet.packet_id
    || actionPacketRef.packet_id !== packetRef.packet_id
    || packetRef.packet_content_sha256 !== reproduction.packet_content_sha256
    || actionPacketRef.packet_content_sha256 !== packetRef.packet_content_sha256
    || packetRef.primary_release_id !== actionPacketRef.primary_release_id
    || packetRef.packet_generated_at !== packet.generated_at
    || snapshot.created_at !== snapshot.updated_at
    || action.occurred_at !== snapshot.created_at
    || !validInstant(snapshot.created_at)
    || args.activeCaseKey !== `${snapshot.municipality_cut}:${snapshot.license_id}`
    || !sameSet(requiredMarkings, args.authorityFence.requiredMarkings)
  ) failIntegrity();
  const caseId = String(snapshot.case_id);
  const actionId = String(action.action_id);
  const packetId = String(packet.packet_id);
  const licenseId = String(snapshot.license_id);
  if (
    !IDENTIFIER.test(caseId)
    || !IDENTIFIER.test(actionId)
    || packetId.length === 0
    || !IDENTIFIER.test(licenseId)
    || !SHA256.test(String(packetRef.packet_content_sha256))
  ) failIntegrity();
  const primaryReleases = Array.isArray(packet.pinned_releases)
    ? packet.pinned_releases.filter((item) => record(item)?.capability === "patents.get")
    : [];
  const inputQueries = Array.isArray(reproduction.input_queries)
    ? reproduction.input_queries.filter((item) => record(item)?.capability === "patents.get")
    : [];
  const release = record(primaryReleases[0]);
  const query = record(inputQueries[0]);
  if (
    primaryReleases.length !== 1
    || inputQueries.length !== 1
    || release?.producer !== "inteligencia-inmobiliaria"
    || release.product !== "commercial-licenses"
    || release.release_id !== packetRef.primary_release_id
    || query?.producer !== "inteligencia-inmobiliaria"
    || query.release_id !== packetRef.primary_release_id
  ) failIntegrity();
  return {
    snapshot,
    action,
    packet,
    packetRef,
    packetId,
    caseId,
    actionId,
    licenseId,
    occurredAt: Date.parse(String(action.occurred_at)),
  };
}

export const commitOpenLicenseReview = internalMutation({
  args: { request: commitValidator },
  handler: async (ctx, args) => {
    const request = args.request;
    const decoded = decodePacketSnapshot(request.evidencePacketSnapshot);
    const validated = validateCommitPayload(request, decoded.json);
    const grantRows = await ctx.db
      .query("reviewAuthorityGrants")
      .withIndex("by_authorityId", (q) => q.eq("authorityId", request.authorityFence.authorityId))
      .collect();
    const grant = await uniqueByIndex(grantRows);
    const evaluatedAt = Date.parse(request.authorityFence.evaluatedAt);
    const commitAt = Date.now();
    if (
      !grant
      || !Number.isFinite(evaluatedAt)
      || grant.authorityVersion !== request.authorityFence.authorityVersion
      || grant.actorId !== request.authorityFence.actorId
      || grant.municipalityCut !== request.authorityFence.municipalityCut
      || request.authorityFence.action !== ACTION
      || !grant.permittedActions.includes(ACTION)
      || !sameSet(validated.action.actor_roles as string[], grant.roles)
      || !request.authorityFence.requiredMarkings.every((item) => (
        grant.allowedMarkings.some((allowed) => allowed === item)
      ))
      || !grant.allowedRepresentations.includes(request.authorityFence.representation)
      || Date.parse(grant.validFrom) > commitAt
      || (grant.validTo !== undefined && Date.parse(grant.validTo) < commitAt)
      || grant.revokedAt !== undefined
    ) return { kind: "cas_conflict" as const };

    const writeLockRows = await ctx.db
      .query("reviewWriteLocks")
      .withIndex("by_lockKey", (q) => q.eq("lockKey", "review-write"))
      .collect();
    const writeLock = await uniqueByIndex(writeLockRows);
    if (!writeLock) return { kind: "cas_conflict" as const };

    const existingOperation = await findOperation(ctx, grant.actorId, request.operationKeySha256);
    if (existingOperation) {
      if (
        existingOperation.commandSha256 !== request.commandSha256
        || existingOperation.municipalityCut !== grant.municipalityCut
      ) return { kind: "operation_conflict" as const };
      return {
        kind: "replayed" as const,
        receipt: await loadReceipt(ctx, existingOperation),
      };
    }
    if (request.expectedCaseVersion !== 0) return { kind: "cas_conflict" as const };
    const activeCases = await ctx.db
      .query("reviewActiveCases")
      .withIndex("by_municipality_license", (q) => (
        q.eq("municipalityCut", grant.municipalityCut)
          .eq("licenseId", validated.licenseId)
      ))
      .collect();
    if (activeCases.length > 0) return { kind: "active_case_conflict" as const };

    const duplicateCases = await ctx.db
      .query("reviewCases")
      .withIndex("by_case_version", (q) => q.eq("caseId", validated.caseId).eq("caseVersion", 1))
      .collect();
    const duplicateActions = await ctx.db
      .query("reviewActions")
      .withIndex("by_actionId", (q) => q.eq("actionId", validated.actionId))
      .collect();
    const duplicatePackets = await ctx.db
      .query("reviewEvidencePackets")
      .withIndex("by_packetId", (q) => q.eq("packetId", validated.packetId))
      .collect();
    if (duplicateCases.length || duplicateActions.length || duplicatePackets.length) {
      return { kind: "cas_conflict" as const };
    }

    const touchedAt = Date.now();
    await ctx.db.patch(writeLock._id, { lastTouchedAt: touchedAt });
    await ctx.db.insert("reviewEvidencePackets", {
      packetId: validated.packetId,
      caseId: validated.caseId,
      caseVersion: 1,
      packetContentSha256: String(validated.packetRef.packet_content_sha256),
      primaryReleaseId: String(validated.packetRef.primary_release_id),
      nature: PACKET_NATURE,
      packetBytes: request.evidencePacketSnapshot.bytes,
      chunkCount: decoded.chunks.length,
      createdAt: validated.occurredAt,
    });
    for (const chunk of decoded.chunks) {
      await ctx.db.insert("reviewEvidencePacketChunks", {
        packetId: validated.packetId,
        ordinal: chunk.ordinal,
        encodedBase64: chunk.encodedBase64,
        byteLength: chunk.byteLength,
      });
    }
    await ctx.db.insert("reviewCases", {
      caseId: validated.caseId,
      caseVersion: 1,
      municipalityCut: grant.municipalityCut,
      licenseId: validated.licenseId,
      status: "open",
      snapshotJson: JSON.stringify(validated.snapshot),
      packetId: validated.packetId,
      createdAt: validated.occurredAt,
      updatedAt: validated.occurredAt,
    });
    await ctx.db.insert("reviewActiveCases", {
      municipalityCut: grant.municipalityCut,
      licenseId: validated.licenseId,
      caseId: validated.caseId,
      caseVersion: 1,
      openedAt: validated.occurredAt,
    });
    await ctx.db.insert("reviewActions", {
      actionId: validated.actionId,
      caseId: validated.caseId,
      actionType: ACTION,
      resultingCaseVersion: 1,
      actorId: grant.actorId,
      legalEffect: "none",
      actionJson: JSON.stringify(validated.action),
      occurredAt: validated.occurredAt,
    });
    await ctx.db.insert("reviewOperations", {
      actorId: grant.actorId,
      actionType: ACTION,
      operationKeySha256: request.operationKeySha256,
      commandSha256: request.commandSha256,
      municipalityCut: grant.municipalityCut,
      caseId: validated.caseId,
      actionId: validated.actionId,
      createdAt: validated.occurredAt,
    });
    return { kind: "committed" as const };
  },
});
