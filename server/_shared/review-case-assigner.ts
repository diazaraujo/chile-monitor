import { z } from 'zod';

import { canonicalizeJson, sha256CanonicalJson } from './evidence-packet-canonical';
import {
  parseReviewCaseSnapshot,
  type ReviewCasePacketRef,
  type ReviewCaseSnapshot,
} from './review-case-contract';

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const OPERATION_KEY = /^[\x21-\x7e]{1,255}$/;
const CUT = /^\d{5}$/;
const SHA256 = /^[a-fA-F0-9]{64}$/;

const markingSchema = z.enum([
  'PUBLIC', 'PII', 'LICENSED', 'MUNICIPAL_INTERNAL', 'ACTIVE_REVIEW', 'AUTHORITY_ONLY',
]);
const packetRefSchema = z.object({
  packet_id: z.string().min(1),
  packet_content_sha256: z.string().regex(SHA256),
  packet_schema_version: z.literal('0.1.0'),
  packet_generated_at: z.string().datetime({ offset: true }),
  primary_release_id: z.string().min(1),
  required_markings: z.array(markingSchema).min(1)
    .refine((values) => new Set(values).size === values.length),
}).strict();

const commandSchema = z.object({
  operationKey: z.string().regex(OPERATION_KEY),
  caseId: z.string().regex(IDENTIFIER),
  expectedCaseVersion: z.number().int().min(1),
  reviewerId: z.string().regex(IDENTIFIER),
}).strict();

const authoritySchema = z.object({
  authority_id: z.string().regex(IDENTIFIER),
  authority_version: z.number().int().min(1),
  actor_id: z.string().regex(IDENTIFIER),
  municipality_cut: z.string().regex(CUT),
  roles: z.tuple([z.literal('coordinator')]),
  permitted_actions: z.array(z.literal('AssignReviewer')).min(1),
  valid_from: z.string().datetime({ offset: true }),
  valid_to: z.string().datetime({ offset: true }).nullable(),
  revoked_at: z.string().datetime({ offset: true }).nullable(),
}).strict();

const reviewerSchema = z.object({
  reviewer_id: z.string().regex(IDENTIFIER),
  municipality_cut: z.string().regex(CUT),
  eligible: z.literal(true),
  valid_from: z.string().datetime({ offset: true }),
  valid_to: z.string().datetime({ offset: true }).nullable(),
  revoked_at: z.string().datetime({ offset: true }).nullable(),
}).strict();

const actionSchema = z.object({
  schema_version: z.literal('0.1.0'),
  action_id: z.string().regex(IDENTIFIER),
  action_type: z.literal('AssignReviewer'),
  case_id: z.string().regex(IDENTIFIER),
  municipality_cut: z.string().regex(CUT),
  license_id: z.string().regex(IDENTIFIER),
  previous_case_version: z.number().int().min(1),
  resulting_case_version: z.number().int().min(2),
  reviewer_id: z.string().regex(IDENTIFIER),
  actor_id: z.string().regex(IDENTIFIER),
  actor_roles: z.tuple([z.literal('coordinator')]),
  authority_id: z.string().regex(IDENTIFIER),
  authority_version: z.number().int().min(1),
  occurred_at: z.string().datetime({ offset: true }),
  legal_effect: z.literal('none'),
  packet_ref: packetRefSchema,
  command_sha256: z.string().regex(SHA256),
}).strict();

const receiptSchema = z.object({
  schema_version: z.literal('0.1.0'),
  case: z.unknown(),
  action: actionSchema,
  replayed: z.boolean(),
}).strict();
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

export interface AssignReviewerCommand {
  /** Derived from the transport Idempotency-Key header, never request JSON. */
  operationKey: string;
  caseId: string;
  expectedCaseVersion: number;
  reviewerId: string;
}

export interface AssignReviewerAuthority {
  authority_id: string;
  authority_version: number;
  actor_id: string;
  municipality_cut: string;
  roles: ['coordinator'];
  permitted_actions: 'AssignReviewer'[];
  valid_from: string;
  valid_to: string | null;
  revoked_at: string | null;
}

export interface AssignReviewerEligibility {
  reviewer_id: string;
  municipality_cut: string;
  eligible: true;
  valid_from: string;
  valid_to: string | null;
  revoked_at: string | null;
}

export interface AssignReviewerActionEvent {
  schema_version: '0.1.0';
  action_id: string;
  action_type: 'AssignReviewer';
  case_id: string;
  municipality_cut: string;
  license_id: string;
  previous_case_version: number;
  resulting_case_version: number;
  reviewer_id: string;
  actor_id: string;
  actor_roles: ['coordinator'];
  authority_id: string;
  authority_version: number;
  occurred_at: string;
  legal_effect: 'none';
  packet_ref: ReviewCasePacketRef;
  command_sha256: string;
}

export interface AssignReviewerReceipt {
  schema_version: '0.1.0';
  case: ReviewCaseSnapshot;
  action: AssignReviewerActionEvent;
  replayed: boolean;
}

export interface AssignReviewerAuthorityRequest {
  action: 'AssignReviewer';
}

export interface AssignReviewerEligibilityRequest {
  reviewerId: string;
  municipalityCut: string;
  evaluatedAt: string;
}

export type AssignReviewerAuthorityPort = (
  request: AssignReviewerAuthorityRequest,
) => Promise<unknown | null>;

export type AssignReviewerEligibilityPort = (
  request: AssignReviewerEligibilityRequest,
) => Promise<unknown | null>;

export interface AssignReviewerOperationLookup {
  operationKey: string;
  commandSha256: string;
  actorId: string;
  municipalityCut: string;
}

export type AssignReviewerOperationResult =
  | { kind: 'miss' }
  | { kind: 'replayed'; receipt: unknown }
  | { kind: 'operation_conflict' };

export interface CommitAssignReviewerRequest {
  operationKey: string;
  commandSha256: string;
  expectedCaseVersion: number;
  previousCaseSnapshot: ReviewCaseSnapshot;
  resultingCaseSnapshot: ReviewCaseSnapshot;
  action: AssignReviewerActionEvent;
  authorityFence: {
    authorityId: string;
    authorityVersion: number;
    actorId: string;
    municipalityCut: string;
    action: 'AssignReviewer';
    evaluatedAt: string;
  };
  reviewerFence: {
    reviewerId: string;
    municipalityCut: string;
    evaluatedAt: string;
  };
}

export type CommitAssignReviewerResult =
  | { kind: 'committed' }
  | { kind: 'replayed'; receipt: unknown }
  | { kind: 'operation_conflict' }
  | { kind: 'cas_conflict' };

export interface AssignReviewerWritePort {
  readAssignReviewerOperation(
    lookup: AssignReviewerOperationLookup,
  ): Promise<AssignReviewerOperationResult>;
  readReviewCaseSnapshot(lookup: {
    caseId: string;
    caseVersion: number;
    municipalityCut: string;
  }): Promise<unknown | null>;
  commitAssignReviewer(
    request: CommitAssignReviewerRequest,
  ): Promise<CommitAssignReviewerResult>;
}

export interface ReviewCaseAssignerConfig {
  resolveAuthority: AssignReviewerAuthorityPort;
  resolveReviewerEligibility: AssignReviewerEligibilityPort;
  writePort: AssignReviewerWritePort;
  newActionId: () => string;
  now?: () => Date;
}

export interface ReviewCaseAssigner {
  assignReviewer(command: AssignReviewerCommand): Promise<AssignReviewerReceipt>;
}

export type ReviewCaseAssignerErrorKind =
  | 'invalid_request'
  | 'not_found_or_denied'
  | 'authority_unavailable'
  | 'reviewer_unavailable'
  | 'storage_unavailable'
  | 'integrity_failure'
  | 'idempotency_conflict'
  | 'case_conflict';

export class ReviewCaseAssignerError extends Error {
  readonly kind: ReviewCaseAssignerErrorKind;

  constructor(kind: ReviewCaseAssignerErrorKind, message: string) {
    super(message);
    this.name = 'ReviewCaseAssignerError';
    this.kind = kind;
  }
}

export function createReviewCaseAssigner(config: ReviewCaseAssignerConfig): ReviewCaseAssigner {
  if (typeof config.newActionId !== 'function') {
    throw new ReviewCaseAssignerError('invalid_request', 'Review case assigner configuration is invalid');
  }
  const now = config.now ?? (() => new Date());

  return {
    async assignReviewer(rawCommand) {
      const command = parseCommand(rawCommand);
      const evaluatedAt = serverTimestamp(now());
      const authority = await resolveAuthority(config.resolveAuthority);
      requireCurrentAuthority(authority, evaluatedAt);
      const commandSha256 = await hashCommand(command, authority.actor_id, authority.municipality_cut);
      const operation = await readOperation(config.writePort, {
        operationKey: command.operationKey,
        commandSha256,
        actorId: authority.actor_id,
        municipalityCut: authority.municipality_cut,
      });
      if (operation.kind === 'replayed') {
        return parseReceipt(operation.receipt, true, command, commandSha256, authority);
      }
      if (operation.kind === 'operation_conflict') throw idempotencyConflict();

      const previous = await readSnapshot(config.writePort, command, authority.municipality_cut);
      requireAssignable(previous, command, authority.municipality_cut);
      const reviewer = await resolveReviewer(
        config.resolveReviewerEligibility,
        command.reviewerId,
        authority.municipality_cut,
        evaluatedAt,
      );
      requireCurrentReviewer(reviewer, command.reviewerId, authority.municipality_cut, evaluatedAt);

      const assignedAt = serverTimestamp(now());
      if (Date.parse(assignedAt) < Date.parse(evaluatedAt)) {
        throw new ReviewCaseAssignerError('integrity_failure', 'Server clock moved backwards');
      }
      requireCurrentAuthority(authority, assignedAt);
      requireCurrentReviewer(reviewer, command.reviewerId, authority.municipality_cut, assignedAt);
      const actionId = generatedIdentifier(config.newActionId);
      const resulting = parseSnapshot({
        ...previous,
        case_version: previous.case_version + 1,
        status: 'in_review',
        updated_at: assignedAt,
        assignment: {
          reviewer_id: command.reviewerId,
          assigned_by: authority.actor_id,
          assigned_at: assignedAt,
        },
      });
      const action = parseAction({
        schema_version: '0.1.0',
        action_id: actionId,
        action_type: 'AssignReviewer',
        case_id: previous.case_id,
        municipality_cut: previous.municipality_cut,
        license_id: previous.license_id,
        previous_case_version: previous.case_version,
        resulting_case_version: resulting.case_version,
        reviewer_id: command.reviewerId,
        actor_id: authority.actor_id,
        actor_roles: ['coordinator'],
        authority_id: authority.authority_id,
        authority_version: authority.authority_version,
        occurred_at: assignedAt,
        legal_effect: 'none',
        packet_ref: previous.packet_ref,
        command_sha256: commandSha256,
      });
      const receipt = parseReceipt({
        schema_version: '0.1.0',
        case: resulting,
        action,
        replayed: false,
      }, false, command, commandSha256, authority);

      const result = await commit(config.writePort, {
        operationKey: command.operationKey,
        commandSha256,
        expectedCaseVersion: command.expectedCaseVersion,
        previousCaseSnapshot: previous,
        resultingCaseSnapshot: resulting,
        action,
        authorityFence: {
          authorityId: authority.authority_id,
          authorityVersion: authority.authority_version,
          actorId: authority.actor_id,
          municipalityCut: authority.municipality_cut,
          action: 'AssignReviewer',
          evaluatedAt: assignedAt,
        },
        reviewerFence: {
          reviewerId: reviewer.reviewer_id,
          municipalityCut: reviewer.municipality_cut,
          evaluatedAt: assignedAt,
        },
      });
      if (result.kind === 'committed') return receipt;
      if (result.kind === 'replayed') {
        return parseReceipt(result.receipt, true, command, commandSha256, authority);
      }
      if (result.kind === 'operation_conflict') throw idempotencyConflict();
      throw new ReviewCaseAssignerError('case_conflict', 'The review case could not be assigned');
    },
  };
}

function parseCommand(value: unknown): AssignReviewerCommand {
  const result = commandSchema.safeParse(value);
  if (!result.success) {
    throw new ReviewCaseAssignerError('invalid_request', 'Assign reviewer request is invalid');
  }
  return result.data;
}

function serverTimestamp(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ReviewCaseAssignerError('integrity_failure', 'Server clock is invalid');
  }
  return value.toISOString();
}

async function resolveAuthority(port: AssignReviewerAuthorityPort): Promise<AssignReviewerAuthority> {
  let value: unknown | null;
  try {
    value = await port({ action: 'AssignReviewer' });
  } catch {
    throw new ReviewCaseAssignerError('authority_unavailable', 'Review authority is unavailable');
  }
  if (value === null) throw notFoundOrDenied();
  const result = authoritySchema.safeParse(value);
  if (!result.success) throw notFoundOrDenied();
  return result.data;
}

function requireCurrentAuthority(authority: AssignReviewerAuthority, instant: string): void {
  const at = Date.parse(instant);
  if (
    authority.revoked_at !== null
    || Date.parse(authority.valid_from) > at
    || (authority.valid_to !== null && Date.parse(authority.valid_to) < at)
    || !authority.permitted_actions.includes('AssignReviewer')
  ) throw notFoundOrDenied();
}

async function resolveReviewer(
  port: AssignReviewerEligibilityPort,
  reviewerId: string,
  municipalityCut: string,
  evaluatedAt: string,
): Promise<AssignReviewerEligibility> {
  let value: unknown | null;
  try {
    value = await port({ reviewerId, municipalityCut, evaluatedAt });
  } catch {
    throw new ReviewCaseAssignerError('reviewer_unavailable', 'Reviewer eligibility is unavailable');
  }
  if (value === null) throw notFoundOrDenied();
  const result = reviewerSchema.safeParse(value);
  if (!result.success) throw notFoundOrDenied();
  return result.data;
}

function requireCurrentReviewer(
  reviewer: AssignReviewerEligibility,
  reviewerId: string,
  municipalityCut: string,
  instant: string,
): void {
  const at = Date.parse(instant);
  if (
    reviewer.reviewer_id !== reviewerId
    || reviewer.municipality_cut !== municipalityCut
    || reviewer.revoked_at !== null
    || Date.parse(reviewer.valid_from) > at
    || (reviewer.valid_to !== null && Date.parse(reviewer.valid_to) < at)
  ) throw notFoundOrDenied();
}

async function readOperation(
  port: AssignReviewerWritePort,
  lookup: AssignReviewerOperationLookup,
): Promise<AssignReviewerOperationResult> {
  let value: unknown;
  try {
    value = await port.readAssignReviewerOperation(lookup);
  } catch {
    throw new ReviewCaseAssignerError('storage_unavailable', 'Review storage is unavailable');
  }
  const result = operationResultSchema.safeParse(value);
  if (!result.success) {
    throw new ReviewCaseAssignerError('integrity_failure', 'Review storage failed validation');
  }
  return result.data;
}

async function readSnapshot(
  port: AssignReviewerWritePort,
  command: AssignReviewerCommand,
  municipalityCut: string,
): Promise<ReviewCaseSnapshot> {
  let value: unknown | null;
  try {
    value = await port.readReviewCaseSnapshot({
      caseId: command.caseId,
      caseVersion: command.expectedCaseVersion,
      municipalityCut,
    });
  } catch {
    throw new ReviewCaseAssignerError('storage_unavailable', 'Review storage is unavailable');
  }
  if (value === null) throw notFoundOrDenied();
  return parseSnapshot(value);
}

function requireAssignable(
  snapshot: ReviewCaseSnapshot,
  command: AssignReviewerCommand,
  municipalityCut: string,
): void {
  if (
    snapshot.case_id !== command.caseId
    || snapshot.case_version !== command.expectedCaseVersion
    || snapshot.municipality_cut !== municipalityCut
    || snapshot.status !== 'open'
    || snapshot.assignment !== undefined
  ) throw notFoundOrDenied();
}

function generatedIdentifier(factory: () => string): string {
  let value: string;
  try {
    value = factory();
  } catch {
    throw new ReviewCaseAssignerError('integrity_failure', 'Action identifier could not be generated');
  }
  if (!IDENTIFIER.test(value)) {
    throw new ReviewCaseAssignerError('integrity_failure', 'Action identifier is invalid');
  }
  return value;
}

async function hashCommand(
  command: AssignReviewerCommand,
  actorId: string,
  municipalityCut: string,
): Promise<string> {
  try {
    return await sha256CanonicalJson({
      action: 'AssignReviewer',
      actor_id: actorId,
      municipality_cut: municipalityCut,
      case_id: command.caseId,
      expected_case_version: command.expectedCaseVersion,
      reviewer_id: command.reviewerId,
    });
  } catch {
    throw new ReviewCaseAssignerError('integrity_failure', 'Assign reviewer command could not be hashed');
  }
}

function parseSnapshot(value: unknown): ReviewCaseSnapshot {
  try {
    return parseReviewCaseSnapshot(value);
  } catch {
    throw new ReviewCaseAssignerError('integrity_failure', 'Review case failed validation');
  }
}

function parseAction(value: unknown): AssignReviewerActionEvent {
  const result = actionSchema.safeParse(value);
  if (!result.success || result.data.resulting_case_version !== result.data.previous_case_version + 1) {
    throw new ReviewCaseAssignerError('integrity_failure', 'Review action failed validation');
  }
  return result.data;
}

function parseReceipt(
  value: unknown,
  replayed: boolean,
  command: AssignReviewerCommand,
  commandSha256: string,
  authority: AssignReviewerAuthority,
): AssignReviewerReceipt {
  const outer = receiptSchema.safeParse(value);
  if (!outer.success) throw new ReviewCaseAssignerError('integrity_failure', 'Review receipt failed validation');
  const snapshot = parseSnapshot(outer.data.case);
  const action = parseAction(outer.data.action);
  if (
    snapshot.case_id !== command.caseId
    || snapshot.case_version !== command.expectedCaseVersion + 1
    || snapshot.municipality_cut !== authority.municipality_cut
    || snapshot.status !== 'in_review'
    || snapshot.assignment?.reviewer_id !== command.reviewerId
    || snapshot.assignment.assigned_by !== authority.actor_id
    || snapshot.assignment.assigned_at !== action.occurred_at
    || action.case_id !== snapshot.case_id
    || action.municipality_cut !== snapshot.municipality_cut
    || action.license_id !== snapshot.license_id
    || action.previous_case_version !== command.expectedCaseVersion
    || action.resulting_case_version !== snapshot.case_version
    || action.reviewer_id !== command.reviewerId
    || action.actor_id !== authority.actor_id
    || action.authority_id !== authority.authority_id
    || action.authority_version !== authority.authority_version
    || action.command_sha256 !== commandSha256
    || !samePacketRef(action.packet_ref, snapshot.packet_ref)
  ) throw new ReviewCaseAssignerError('integrity_failure', 'Review receipt failed validation');
  return { schema_version: '0.1.0', case: snapshot, action, replayed };
}

async function commit(
  port: AssignReviewerWritePort,
  request: CommitAssignReviewerRequest,
): Promise<CommitAssignReviewerResult> {
  let value: unknown;
  try {
    value = await port.commitAssignReviewer(request);
  } catch {
    throw new ReviewCaseAssignerError('storage_unavailable', 'Review storage is unavailable');
  }
  const result = commitResultSchema.safeParse(value);
  if (!result.success) {
    throw new ReviewCaseAssignerError('integrity_failure', 'Review storage failed validation');
  }
  return result.data;
}

function samePacketRef(left: ReviewCasePacketRef, right: ReviewCasePacketRef): boolean {
  try {
    return canonicalizeJson(left) === canonicalizeJson(right);
  } catch {
    return false;
  }
}

function notFoundOrDenied(): ReviewCaseAssignerError {
  return new ReviewCaseAssignerError('not_found_or_denied', 'Review case was not found');
}

function idempotencyConflict(): ReviewCaseAssignerError {
  return new ReviewCaseAssignerError(
    'idempotency_conflict',
    'The operation key was already used for another command',
  );
}
