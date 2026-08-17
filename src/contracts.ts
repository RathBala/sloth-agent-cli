import {
  ApiError,
  UsageError,
} from './errors.js';
import { CATEGORY_TYPES, ICON_KEYS } from './category-metadata.js';
import { isGoalType } from './goal-metadata.js';

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

export interface BudgetAllocation {
  categoryId: string;
  lineItemId: string;
  plannedPence: number;
}

export interface BudgetUpdatePayload {
  allocations: BudgetAllocation[];
}

type ApiCommand =
  | 'accounts'
  | 'accounts-update'
  | 'accounts-remove'
  | 'investments'
  | 'budget'
  | 'budget-status'
  | 'budget-move'
  | 'budget-update'
  | 'categories'
  | 'categories-create'
  | 'categories-rename'
  | 'line-items-create'
  | 'line-items-rename'
  | 'transactions'
  | 'assign'
  | 'ask-partner'
  | 'goals-list'
  | 'goals-create'
  | 'goals-update'
  | 'goals-mark-spent'
  | 'goals-restore'
  | 'goals-delete';
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
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

export function validateBudgetUpdatePayload(value: unknown): BudgetUpdatePayload {
  const payload = requireObject(value, 'budget update payload');
  rejectUnknownFields(payload, new Set(['allocations']), 'budget update payload');
  if (!Array.isArray(payload.allocations)) {
    throw new UsageError('allocations array is required');
  }
  if (payload.allocations.length < 1 || payload.allocations.length > 100) {
    throw new UsageError('allocations must contain between 1 and 100 items');
  }

  const seen = new Set<string>();
  const allocations = payload.allocations.map((value, index) => {
    const label = `allocations[${index}]`;
    const allocation = requireObject(value, label);
    rejectUnknownFields(
      allocation,
      new Set(['categoryId', 'lineItemId', 'plannedPence']),
      label,
    );
    const categoryId = requireString(allocation.categoryId, `${label}.categoryId`);
    const lineItemId = requireString(allocation.lineItemId, `${label}.lineItemId`);
    if (
      typeof allocation.plannedPence !== 'number'
      || !Number.isSafeInteger(allocation.plannedPence)
      || allocation.plannedPence < 0
    ) {
      throw new UsageError(`${label}.plannedPence must be a nonnegative safe integer`);
    }
    const key = `${categoryId}\u0000${lineItemId}`;
    if (seen.has(key)) {
      throw new UsageError(`${label} duplicates a categoryId and lineItemId pair`);
    }
    seen.add(key);
    return { categoryId, lineItemId, plannedPence: allocation.plannedPence };
  });

  return { allocations };
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

function isCategoryMutationResponse(value: unknown): boolean {
  if (!isObject(value) || !hasOnlyFields(value, ['category']) || !isObject(value.category)) {
    return false;
  }
  const category = value.category;
  return (
    hasOnlyFields(category, ['id', 'name', 'iconKey', 'categoryType', 'source'])
    && typeof category.id === 'string'
    && category.id.trim().length > 0
    && typeof category.name === 'string'
    && category.name.trim().length > 0
    && typeof category.iconKey === 'string'
    && ICON_KEYS.includes(category.iconKey as typeof ICON_KEYS[number])
    && typeof category.categoryType === 'string'
    && CATEGORY_TYPES.includes(category.categoryType as typeof CATEGORY_TYPES[number])
    && category.source === 'user'
  );
}

function isLineItemMutationResponse(value: unknown): boolean {
  if (
    !isObject(value)
    || !hasOnlyFields(value, ['scope', 'categoryId', 'lineItem'])
    || (value.scope !== 'personal' && value.scope !== 'joint')
    || typeof value.categoryId !== 'string'
    || !value.categoryId.trim()
    || !isObject(value.lineItem)
  ) return false;
  return (
    hasOnlyFields(value.lineItem, ['id', 'name'])
    && typeof value.lineItem.id === 'string'
    && value.lineItem.id.trim().length > 0
    && typeof value.lineItem.name === 'string'
    && value.lineItem.name.trim().length > 0
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
    && Number.isInteger(value.personalBudgetAmountPence)
    && Number(value.personalBudgetAmountPence) >= 0
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

const REFRESH_STATUSES = new Set(['skipped', 'completed', 'in_progress', 'partial', 'failed']);
const REFRESH_REASONS = new Set([
  'all_fetched_today',
  'no_api_connections',
  'no_selected_accounts',
  'refreshed',
  'wait_timeout',
  'account_failures',
  'partial_already_attempted',
  'refresh_error',
]);

function isRefreshStatus(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, ['status', 'reason', 'utcDate'])
    && typeof value.status === 'string'
    && REFRESH_STATUSES.has(value.status)
    && typeof value.reason === 'string'
    && REFRESH_REASONS.has(value.reason)
    && isIsoDate(value.utcDate)
  );
}

function isTransactionsResponse(value: unknown): boolean {
  return (
    isObject(value)
    && Array.isArray(value.transactions)
    && value.transactions.every(isTransaction)
    && (value.nextCursor === null || typeof value.nextCursor === 'string')
    && isRefreshStatus(value.refresh)
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
      'goalType',
      'spentAt',
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
    && isGoalType(value.goalType)
    && (
      value.goalType === 'spend'
        ? value.spentAt === null || isIsoDateTime(value.spentAt)
        : value.spentAt === null
    )
    && typeof value.sharedWithPartner === 'boolean'
  );
}

function isCurrency(value: unknown): boolean {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isBudgetLineItem(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, ['id', 'name', 'plannedPence'])
    && typeof value.id === 'string'
    && value.id.trim().length > 0
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && isNonnegativeSafeInteger(value.plannedPence)
  );
}

function isBudgetCategory(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, ['id', 'name', 'plannedPence', 'assignedPence', 'lineItems'])
    && typeof value.id === 'string'
    && value.id.trim().length > 0
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && isNonnegativeSafeInteger(value.plannedPence)
    && (value.assignedPence === null || isSafeInteger(value.assignedPence))
    && Array.isArray(value.lineItems)
    && value.lineItems.every(isBudgetLineItem)
  );
}

function isBudgetResponse(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, [
      'scope',
      'periodKey',
      'periodStatus',
      'currency',
      'effectiveFromPeriodKey',
      'funding',
      'categories',
    ])
    && (value.scope === 'personal' || value.scope === 'joint')
    && typeof value.periodKey === 'string'
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.periodKey)
    && (
      value.periodStatus === 'historical'
      || value.periodStatus === 'current'
      || value.periodStatus === 'future'
    )
    && isCurrency(value.currency)
    && typeof value.effectiveFromPeriodKey === 'string'
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.effectiveFromPeriodKey)
    && (
      value.funding === null
      || (
        isObject(value.funding)
        && hasOnlyFields(value.funding, ['toAssignPence', 'nextPeriodReservePence'])
        && isSafeInteger(value.funding.toAssignPence)
        && isSafeInteger(value.funding.nextPeriodReservePence)
      )
    )
    && Array.isArray(value.categories)
    && value.categories.every(isBudgetCategory)
  );
}

function isBudgetStatusResponse(value: unknown): boolean {
  if (
    !isObject(value)
    || !hasOnlyFields(value, [
      'scope',
      'periodKey',
      'periodStatus',
      'currency',
      'effectiveFromPeriodKey',
      'funding',
      'activity',
      'refresh',
      'categories',
    ])
  ) return false;

  return (
    (value.scope === 'personal' || value.scope === 'joint')
    && typeof value.periodKey === 'string'
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.periodKey)
    && value.periodStatus === 'current'
    && isCurrency(value.currency)
    && typeof value.effectiveFromPeriodKey === 'string'
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.effectiveFromPeriodKey)
    && (
      value.funding === null
      || (
        isObject(value.funding)
        && hasOnlyFields(value.funding, ['toAssignPence', 'nextPeriodReservePence'])
        && isSafeInteger(value.funding.toAssignPence)
        && isSafeInteger(value.funding.nextPeriodReservePence)
      )
    )
    && isObject(value.activity)
    && hasOnlyFields(value.activity, [
      'startDate',
      'endDate',
      'transactionCount',
      'uncategorizedSpentPence',
      'unmappedSpentPence',
    ])
    && isIsoDate(value.activity.startDate)
    && isIsoDate(value.activity.endDate)
    && value.activity.startDate <= value.activity.endDate
    && isNonnegativeSafeInteger(value.activity.transactionCount)
    && isSafeInteger(value.activity.uncategorizedSpentPence)
    && isSafeInteger(value.activity.unmappedSpentPence)
    && isRefreshStatus(value.refresh)
    && Array.isArray(value.categories)
    && value.categories.every((category) => (
      isObject(category)
      && hasOnlyFields(category, [
        'id',
        'name',
        'plannedPence',
        'assignedPence',
        'spentPence',
        'availablePence',
      ])
      && typeof category.id === 'string'
      && category.id.trim().length > 0
      && typeof category.name === 'string'
      && category.name.trim().length > 0
      && isNonnegativeSafeInteger(category.plannedPence)
      && isSafeInteger(category.assignedPence)
      && isSafeInteger(category.spentPence)
      && isSafeInteger(category.availablePence)
      && Number.isSafeInteger(category.assignedPence - category.spentPence)
      && category.availablePence === category.assignedPence - category.spentPence
    ))
  );
}

interface BudgetMovementResponse {
  moved: true;
  scope: 'personal' | 'joint';
  periodKey: string;
  currency: string;
  fromCategoryId: string;
  toCategoryId: string;
  amountPence: number;
  toAssignPence: number;
  categoryBalances: Array<{ categoryId: string; assignedPence: number }>;
}

function isBudgetMovementResponse(value: unknown): value is BudgetMovementResponse {
  return (
    isObject(value)
    && hasOnlyFields(value, [
      'moved',
      'scope',
      'periodKey',
      'currency',
      'fromCategoryId',
      'toCategoryId',
      'amountPence',
      'toAssignPence',
      'categoryBalances',
    ])
    && value.moved === true
    && (value.scope === 'personal' || value.scope === 'joint')
    && typeof value.periodKey === 'string'
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.periodKey)
    && isCurrency(value.currency)
    && typeof value.fromCategoryId === 'string'
    && value.fromCategoryId.trim().length > 0
    && typeof value.toCategoryId === 'string'
    && value.toCategoryId.trim().length > 0
    && value.fromCategoryId !== value.toCategoryId
    && isNonnegativeSafeInteger(value.amountPence)
    && value.amountPence > 0
    && isSafeInteger(value.toAssignPence)
    && Array.isArray(value.categoryBalances)
    && value.categoryBalances.length >= 1
    && value.categoryBalances.length <= 2
    && value.categoryBalances.every((balance) => (
      isObject(balance)
      && hasOnlyFields(balance, ['categoryId', 'assignedPence'])
      && typeof balance.categoryId === 'string'
      && balance.categoryId.trim().length > 0
      && isSafeInteger(balance.assignedPence)
    ))
  );
}

interface BudgetMovementExpectation {
  scope: 'personal' | 'joint';
  periodKey?: string;
  fromCategoryId: string;
  toCategoryId: string;
  amountPence: number;
}

export function validateBudgetMovementResponse(
  value: unknown,
  expected: BudgetMovementExpectation,
): unknown {
  if (!isBudgetMovementResponse(value)) {
    throw new ApiError('Invalid budget-move response from the Agent API');
  }

  const expectedCategoryIds = [expected.fromCategoryId, expected.toCategoryId]
    .filter(categoryId => categoryId !== 'to-assign')
    .sort();
  const actualCategoryIds = value.categoryBalances
    .map(balance => balance.categoryId)
    .sort();
  const matchesRequest = value.scope === expected.scope
    && (expected.periodKey === undefined || value.periodKey === expected.periodKey)
    && value.fromCategoryId === expected.fromCategoryId
    && value.toCategoryId === expected.toCategoryId
    && value.amountPence === expected.amountPence;
  const matchesAffectedCategories = actualCategoryIds.length === expectedCategoryIds.length
    && actualCategoryIds.every((categoryId, index) => categoryId === expectedCategoryIds[index]);

  if (!matchesRequest || !matchesAffectedCategories) {
    throw new ApiError('Invalid budget-move response from the Agent API');
  }
  return value;
}

function isNullableNonEmptyString(value: unknown): boolean {
  return value === null || (
    typeof value === 'string'
    && value.length > 0
    && value === value.trim()
  );
}

function isAccount(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, [
      'accountRef',
      'accountName',
      'institutionName',
      'accountType',
      'ownership',
      'balanceAmount',
      'currency',
      'source',
      'lastBalanceUpdatedAt',
      'connectionState',
      'isGoalSavingsSource',
    ])
    && typeof value.accountRef === 'string'
    && /^sloth_account_v1_[A-Za-z0-9_-]{43}$/.test(value.accountRef)
    && isNullableNonEmptyString(value.accountName)
    && isNullableNonEmptyString(value.institutionName)
    && (
      value.accountType === 'current'
      || value.accountType === 'savings'
      || value.accountType === 'investments'
    )
    && (value.ownership === 'personal' || value.ownership === 'joint')
    && (
      value.balanceAmount === null
      || (typeof value.balanceAmount === 'number' && Number.isFinite(value.balanceAmount))
    )
    && (value.currency === null || isCurrency(value.currency))
    && (value.source === 'connected' || value.source === 'manual')
    && (
      value.lastBalanceUpdatedAt === null
      || isIsoDateTime(value.lastBalanceUpdatedAt)
    )
    && (
      value.connectionState === 'active'
      || value.connectionState === 'expired'
      || value.connectionState === 'manual'
      || value.connectionState === 'unknown'
    )
    && typeof value.isGoalSavingsSource === 'boolean'
  );
}

function isAccountsResponse(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, ['asOf', 'accounts'])
    && isIsoDateTime(value.asOf)
    && Array.isArray(value.accounts)
    && value.accounts.every(isAccount)
  );
}

function isAccountMutationResponse(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, ['changed', 'account'])
    && typeof value.changed === 'boolean'
    && isAccount(value.account)
  );
}

function isAccountRemovalResponse(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, ['removed', 'changed', 'accountRef'])
    && value.removed === true
    && typeof value.changed === 'boolean'
    && typeof value.accountRef === 'string'
    && /^sloth_account_v1_[A-Za-z0-9_-]{43}$/.test(value.accountRef)
  );
}

function isInvestmentHolding(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, [
      'instrumentType',
      'symbol',
      'name',
      'units',
      'unitPriceAmount',
      'marketValueAmount',
      'currency',
      'providerFreshnessAsOf',
      'syncedAt',
    ])
    && typeof value.instrumentType === 'string'
    && value.instrumentType.trim().length > 0
    && (value.symbol === null || (typeof value.symbol === 'string' && value.symbol.trim().length > 0))
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && typeof value.units === 'number'
    && Number.isFinite(value.units)
    && typeof value.unitPriceAmount === 'number'
    && Number.isFinite(value.unitPriceAmount)
    && typeof value.marketValueAmount === 'number'
    && Number.isFinite(value.marketValueAmount)
    && isCurrency(value.currency)
    && (value.providerFreshnessAsOf === null || isIsoDateTime(value.providerFreshnessAsOf))
    && isIsoDateTime(value.syncedAt)
  );
}

function isInvestmentsResponse(value: unknown): boolean {
  return (
    isObject(value)
    && hasOnlyFields(value, ['asOf', 'investmentAccounts'])
    && isIsoDateTime(value.asOf)
    && Array.isArray(value.investmentAccounts)
    && value.investmentAccounts.every((account) => {
      if (!isObject(account)) return false;
      const { holdings, ...baseAccount } = account;
      return (
        isAccount(baseAccount)
        && account.accountType === 'investments'
        && account.source === 'connected'
        && Array.isArray(holdings)
        && holdings.every(isInvestmentHolding)
      );
    })
  );
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
  const valid = command === 'accounts'
    ? isAccountsResponse(value)
    : command === 'accounts-update'
      ? isAccountMutationResponse(value)
    : command === 'accounts-remove'
      ? isAccountRemovalResponse(value)
    : command === 'investments'
        ? isInvestmentsResponse(value)
    : command === 'budget' || command === 'budget-update'
      ? isBudgetResponse(value)
    : command === 'budget-status'
      ? isBudgetStatusResponse(value)
    : command === 'budget-move'
      ? isBudgetMovementResponse(value)
    : command === 'categories'
      ? isCategoryResponse(value)
      : command === 'categories-create' || command === 'categories-rename'
        ? isCategoryMutationResponse(value)
        : command === 'line-items-create' || command === 'line-items-rename'
          ? isLineItemMutationResponse(value)
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
