import {
  ApiError,
  UsageError,
} from './errors.js';

export interface AgentCategorySplit {
  categoryId: string;
  amountPence: number;
  lineItemId?: string;
}

export interface AgentAssignment {
  transactionRef: string;
  assignmentScope?: 'personal' | 'joint';
  categoryId?: string | null;
  lineItemId?: string | null;
  categorySplits?: AgentCategorySplit[] | null;
  incomeSubtype?: 'pay' | 'interest' | null;
}

export interface AssignmentPayload {
  assignments: AgentAssignment[];
}

type ApiCommand =
  | 'categories'
  | 'transactions'
  | 'assign'
  | 'ask-partner'
  | 'goals-list'
  | 'goals-create'
  | 'goals-update'
  | 'goals-delete';
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
      'assignmentScope',
      'categoryId',
      'lineItemId',
      'categorySplits',
      'incomeSubtype',
    ]),
    label,
  );

  requireString(assignment.transactionRef, `${label}.transactionRef`);
  if (
    assignment.assignmentScope !== undefined
    && assignment.assignmentScope !== 'personal'
    && assignment.assignmentScope !== 'joint'
  ) {
    throw new UsageError(`${label}.assignmentScope must be personal or joint`);
  }
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
    ...(assignment.assignmentScope !== undefined
      ? { assignmentScope: assignment.assignmentScope as 'personal' | 'joint' }
      : {}),
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
      value.jointBudgetContribution === null
      || (
        isObject(value.jointBudgetContribution)
        && typeof value.jointBudgetContribution.eligible === 'boolean'
        && typeof value.jointBudgetContribution.included === 'boolean'
        && Number.isInteger(value.jointBudgetContribution.amountPence)
        && Number(value.jointBudgetContribution.amountPence) > 0
        && (
          value.jointBudgetContribution.categoryId === null
          || typeof value.jointBudgetContribution.categoryId === 'string'
        )
        && (
          value.jointBudgetContribution.lineItemId === null
          || typeof value.jointBudgetContribution.lineItemId === 'string'
        )
        && Array.isArray(value.jointBudgetContribution.categorySplits)
        && (
          value.jointBudgetContribution.incomeSubtype === null
          || value.jointBudgetContribution.incomeSubtype === 'pay'
          || value.jointBudgetContribution.incomeSubtype === 'interest'
        )
      )
    )
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
    && value.succeeded.every((item) => (
      isObject(item)
      && typeof item.transactionRef === 'string'
      && (item.assignmentScope === 'personal' || item.assignmentScope === 'joint')
    ))
    && Array.isArray(value.failed)
    && value.failed.every((item) => (
      isObject(item)
      && typeof item.error === 'string'
      && (item.transactionRef === undefined || typeof item.transactionRef === 'string')
    ))
  );
}

export interface JointBudgetSettingsResponse {
  includeSharedPersonalTransactions: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export function validateJointBudgetSettingsResponse(
  value: unknown,
): JointBudgetSettingsResponse {
  if (
    !isObject(value)
    || Object.keys(value).some((key) => !new Set([
      'includeSharedPersonalTransactions',
      'updatedAt',
      'updatedBy',
    ]).has(key))
    || typeof value.includeSharedPersonalTransactions !== 'boolean'
    || (value.updatedAt !== null && !isIsoDateTime(value.updatedAt))
    || (value.updatedBy !== null && typeof value.updatedBy !== 'string')
  ) {
    throw new ApiError('Invalid joint budget settings response from the Agent API');
  }

  return value as unknown as JointBudgetSettingsResponse;
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

function hasOnlyFields(value: JsonObject, fields: readonly string[]): boolean {
  const allowed = new Set(fields);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isGoal(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, [
      'id',
      'name',
      'targetAmount',
      'targetMonthKey',
      'isAchieved',
      'sharedWithPartner',
    ])
    && typeof value.id === 'string'
    && value.id.trim().length > 0
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && (
      value.targetAmount === null
      || (typeof value.targetAmount === 'number' && Number.isFinite(value.targetAmount))
    )
    && (
      value.targetMonthKey === null
      || (
        typeof value.targetMonthKey === 'string'
        && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.targetMonthKey)
      )
    )
    && typeof value.isAchieved === 'boolean'
    && typeof value.sharedWithPartner === 'boolean'
  );
}

function isCurrency(value: unknown): boolean {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

function isGoalsResponse(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, ['currency', 'goals'])
    && isCurrency(value.currency)
    && Array.isArray(value.goals)
    && value.goals.every(isGoal)
  );
}

function isGoalMutationResponse(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, ['currency', 'goal'])
    && isCurrency(value.currency)
    && isGoal(value.goal)
  );
}

function isGoalDeleteResponse(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, ['deleted', 'deletedGoalId'])
    && value.deleted === true
    && typeof value.deletedGoalId === 'string'
    && value.deletedGoalId.trim().length > 0
  );
}

export function parseApiResponse(command: ApiCommand, value: unknown): unknown {
  const valid = command === 'categories'
    ? isCategoryResponse(value)
    : command === 'transactions'
      ? isTransactionsResponse(value)
      : command === 'assign'
        ? isAssignmentResponse(value)
        : command === 'ask-partner'
          ? isPartnerResponse(value)
          : command === 'goals-list'
            ? isGoalsResponse(value)
            : command === 'goals-delete'
              ? isGoalDeleteResponse(value)
              : isGoalMutationResponse(value);

  if (!valid) {
    const label = command === 'assign' ? 'assignment' : command;
    throw new ApiError(`Invalid ${label} response from the Agent API`);
  }
  return value;
}
