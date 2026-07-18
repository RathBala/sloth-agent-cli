import { UsageError } from './errors.js';

export interface AgentCategorySplit {
  categoryId: string;
  amountPence: number;
  lineItemId?: string;
}

export interface AgentAssignment {
  transactionRef: string;
  categoryId?: string | null;
  lineItemId?: string | null;
  categorySplits?: AgentCategorySplit[] | null;
  incomeSubtype?: 'pay' | 'interest' | null;
}

export interface AssignmentPayload {
  assignments: AgentAssignment[];
}

type ApiCommand = 'categories' | 'transactions' | 'assign' | 'ask-partner';
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) throw new UsageError(`${label} must be an object`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new UsageError(`${label} is required`);
  }
  return value;
}

function rejectUnknownFields(
  value: JsonObject,
  allowed: Set<string>,
  label: string,
): void {
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) throw new UsageError(`${label} contains unknown field: ${unknown}`);
}

function validateSplit(value: unknown, index: number, splitIndex: number): AgentCategorySplit {
  const label = `assignments[${index}].categorySplits[${splitIndex}]`;
  const split = requireObject(value, label);
  rejectUnknownFields(split, new Set(['categoryId', 'amountPence', 'lineItemId']), label);
  const categoryId = requireString(split.categoryId, `${label}.categoryId`);
  if (!Number.isInteger(split.amountPence) || Number(split.amountPence) <= 0) {
    throw new UsageError(`${label}.amountPence must be a positive integer`);
  }
  if (split.lineItemId !== undefined) {
    requireString(split.lineItemId, `${label}.lineItemId`);
  }

  return typeof split.lineItemId === 'string'
    ? { categoryId, amountPence: Number(split.amountPence), lineItemId: split.lineItemId }
    : { categoryId, amountPence: Number(split.amountPence) };
}

function validateAssignment(value: unknown, index: number): AgentAssignment {
  const label = `assignments[${index}]`;
  const assignment = requireObject(value, label);
  rejectUnknownFields(
    assignment,
    new Set([
      'transactionRef',
      'categoryId',
      'lineItemId',
      'categorySplits',
      'incomeSubtype',
    ]),
    label,
  );

  requireString(assignment.transactionRef, `${label}.transactionRef`);
  if (assignment.categoryId !== undefined && assignment.categoryId !== null) {
    requireString(assignment.categoryId, `${label}.categoryId`);
  }
  if (assignment.lineItemId !== undefined && assignment.lineItemId !== null) {
    requireString(assignment.lineItemId, `${label}.lineItemId`);
  }
  if (
    assignment.incomeSubtype !== undefined
    && assignment.incomeSubtype !== null
    && assignment.incomeSubtype !== 'pay'
    && assignment.incomeSubtype !== 'interest'
  ) {
    throw new UsageError(`${label}.incomeSubtype must be pay, interest, or null`);
  }

  let categorySplits: AgentCategorySplit[] | null | undefined;
  if (assignment.categorySplits === null) {
    categorySplits = null;
  } else if (assignment.categorySplits !== undefined) {
    if (!Array.isArray(assignment.categorySplits) || assignment.categorySplits.length === 0) {
      throw new UsageError(`${label}.categorySplits must be a non-empty array or null`);
    }
    categorySplits = assignment.categorySplits.map((split, splitIndex) => (
      validateSplit(split, index, splitIndex)
    ));
  }

  const hasCategory = typeof assignment.categoryId === 'string' && assignment.categoryId.trim().length > 0;
  const isClear = assignment.categoryId === null && (!categorySplits || categorySplits.length === 0);
  const hasSplits = Array.isArray(categorySplits) && categorySplits.length > 0;
  if (!hasCategory && !isClear && !hasSplits) {
    throw new UsageError(`${label}.categoryId or categorySplits is required`);
  }

  return {
    transactionRef: assignment.transactionRef as string,
    ...(assignment.categoryId !== undefined ? { categoryId: assignment.categoryId as string | null } : {}),
    ...(assignment.lineItemId !== undefined ? { lineItemId: assignment.lineItemId as string | null } : {}),
    ...(categorySplits !== undefined ? { categorySplits } : {}),
    ...(assignment.incomeSubtype !== undefined
      ? { incomeSubtype: assignment.incomeSubtype as 'pay' | 'interest' | null }
      : {}),
  };
}

export function validateAssignmentPayload(value: unknown): AssignmentPayload {
  const payload = requireObject(value, 'assignment payload');
  rejectUnknownFields(payload, new Set(['assignments']), 'assignment payload');
  if (!Array.isArray(payload.assignments)) {
    throw new UsageError('assignments array is required');
  }
  if (payload.assignments.length < 1 || payload.assignments.length > 100) {
    throw new UsageError('assignments must contain between 1 and 100 items');
  }
  return { assignments: payload.assignments.map(validateAssignment) };
}

function isLineItemMap(value: unknown): boolean {
  if (!isObject(value)) return false;
  return Object.values(value).every((items) => (
    Array.isArray(items)
    && items.every((item) => (
      isObject(item)
      && typeof item.id === 'string'
      && item.id.length > 0
      && typeof item.name === 'string'
      && item.name.length > 0
    ))
  ));
}

function isCategoryResponse(value: unknown): boolean {
  return (
    isObject(value)
    && Array.isArray(value.categories)
    && value.categories.every((category) => (
      isObject(category)
      && typeof category.id === 'string'
      && typeof category.name === 'string'
      && (category.source === 'default' || category.source === 'user')
    ))
    && isLineItemMap(value.personalLineItemsByCategoryId)
    && isLineItemMap(value.jointLineItemsByCategoryId)
  );
}

function isTransaction(value: unknown): boolean {
  return (
    isObject(value)
    && typeof value.transactionRef === 'string'
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.amount === 'number'
    && Number.isFinite(value.amount)
    && typeof value.currency === 'string'
    && typeof value.date === 'string'
    && value.status === 'booked'
    && typeof value.accountId === 'string'
    && typeof value.accountDocId === 'string'
    && typeof value.requisitionId === 'string'
    && (value.scope === 'personal' || value.scope === 'joint')
    && (value.categoryId === null || typeof value.categoryId === 'string')
    && (value.lineItemId === null || typeof value.lineItemId === 'string')
    && Array.isArray(value.categorySplits)
    && (
      value.incomeSubtype === null
      || value.incomeSubtype === 'pay'
      || value.incomeSubtype === 'interest'
    )
  );
}

function isTransactionsResponse(value: unknown): boolean {
  return (
    isObject(value)
    && Array.isArray(value.transactions)
    && value.transactions.every(isTransaction)
    && (value.nextCursor === null || typeof value.nextCursor === 'string')
  );
}

function isAssignmentResponse(value: unknown): boolean {
  return (
    isObject(value)
    && Array.isArray(value.succeeded)
    && value.succeeded.every((item) => isObject(item) && typeof item.transactionRef === 'string')
    && Array.isArray(value.failed)
    && value.failed.every((item) => (
      isObject(item)
      && typeof item.error === 'string'
      && (item.transactionRef === undefined || typeof item.transactionRef === 'string')
    ))
  );
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isIsoDateTime(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return (
    !Number.isNaN(parsed.valueOf())
    && parsed.toISOString() === value
  );
}

function isPartnerResponse(value: unknown): boolean {
  return (
    isObject(value)
    && typeof value.requestId === 'string'
    && isHttpUrl(value.publicUrl)
    && typeof value.message === 'string'
    && isIsoDateTime(value.expiresAt)
    && value.status === 'open'
  );
}

export function parseApiResponse(command: ApiCommand, value: unknown): unknown {
  const valid = command === 'categories'
    ? isCategoryResponse(value)
    : command === 'transactions'
      ? isTransactionsResponse(value)
      : command === 'assign'
        ? isAssignmentResponse(value)
        : isPartnerResponse(value);

  if (!valid) {
    const label = command === 'assign' ? 'assignment' : command;
    throw new UsageError(`Invalid ${label} response from the Agent API`);
  }
  return value;
}
