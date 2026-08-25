import {
  ApiError,
  UsageError,
} from './errors.js';
import { isAccountRef } from './account-ref.js';
import { CATEGORY_TYPES, ICON_KEYS } from './category-metadata.js';
import { isGoalType } from './goal-metadata.js';

export interface AgentCategorySplit {
  categoryId: string;
  amountPence: number;
  lineItemId?: string;
}

export interface AgentAssignment {
  transactionRef: string;
  sharing?: {
    isShared: boolean;
    shareRatio?: number;
    userExclusiveAmountPence?: number;
    partnerExclusiveAmountPence?: number;
  };
  assignmentScope?: 'personal' | 'joint';
  categoryId?: string | null;
  lineItemId?: string | null;
  categorySplits?: AgentCategorySplit[] | null;
  incomeSubtype?: 'pay' | 'interest' | null;
}

export interface AssignmentPayload {
  assignments: AgentAssignment[];
}

export type AssignmentOperationResult = (
  | { status: 'succeeded'; transactionRef: string }
  | { status: 'failed'; transactionRef: string; error: string }
) & Record<string, unknown>;

export interface AssignmentOperationResponse {
  operationId: string;
  status: 'pending' | 'processing' | 'completed';
  itemCount: number;
  completedCount: number;
  failedCount: number;
  expiresAt: string;
  pollAfterMs: number;
  results?: AssignmentOperationResult[];
}

export interface BudgetAllocation {
  categoryId: string;
  lineItemId: string;
  plannedPence: number;
}

export interface BudgetUpdatePayload {
  allocations: BudgetAllocation[];
}

export interface NotificationRulePayload {
  amountChange: {
    enabled: boolean;
    comparison: 'increase' | 'any';
    baselinePence: number;
  };
  renewalReminder: {
    enabled: boolean;
    renewalDate: string | null;
    leadDays: number;
  };
  delivery: { email: boolean };
}

export interface ReceiptConfirmation {
  schemaVersion: 1;
  currency: string;
  receiptItems: Array<{
    id: string;
    label: string;
    amountPence: number;
  }>;
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
  | 'rules-list'
  | 'rules-get'
  | 'rules-set'
  | 'rules-delete'
  | 'rules-scan-contract'
  | 'ask-partner'
  | 'goals-list'
  | 'goals-create'
  | 'goals-update'
  | 'goals-mark-spent'
  | 'goals-restore'
  | 'goals-delete'
  | 'receipts-extract'
  | 'receipts-get'
  | 'receipts-attach'
  | 'receipts-remove';
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

export function validateNotificationRulePayload(value: unknown): NotificationRulePayload {
  const payload = requireObject(value, 'notification rule payload');
  rejectUnknownFields(
    payload,
    new Set(['amountChange', 'renewalReminder', 'delivery']),
    'notification rule payload',
  );
  const amountChange = requireObject(payload.amountChange, 'amountChange');
  const renewalReminder = requireObject(payload.renewalReminder, 'renewalReminder');
  const delivery = requireObject(payload.delivery, 'delivery');
  rejectUnknownFields(amountChange, new Set(['enabled', 'comparison', 'baselinePence']), 'amountChange');
  rejectUnknownFields(renewalReminder, new Set(['enabled', 'renewalDate', 'leadDays']), 'renewalReminder');
  rejectUnknownFields(delivery, new Set(['email']), 'delivery');
  if (typeof amountChange.enabled !== 'boolean') throw new UsageError('amountChange.enabled must be true or false');
  if (amountChange.comparison !== 'increase' && amountChange.comparison !== 'any') {
    throw new UsageError('amountChange.comparison must be increase or any');
  }
  if (!Number.isSafeInteger(amountChange.baselinePence) || Number(amountChange.baselinePence) <= 0) {
    throw new UsageError('amountChange.baselinePence must be a positive integer');
  }
  if (typeof renewalReminder.enabled !== 'boolean') throw new UsageError('renewalReminder.enabled must be true or false');
  if (renewalReminder.renewalDate !== null && !isIsoDate(renewalReminder.renewalDate)) {
    throw new UsageError('renewalReminder.renewalDate must be YYYY-MM-DD or null');
  }
  if (renewalReminder.enabled && renewalReminder.renewalDate === null) {
    throw new UsageError('renewalReminder.renewalDate is required when enabled');
  }
  if (!Number.isSafeInteger(renewalReminder.leadDays) || Number(renewalReminder.leadDays) < 1 || Number(renewalReminder.leadDays) > 365) {
    throw new UsageError('renewalReminder.leadDays must be an integer from 1 to 365');
  }
  if (typeof delivery.email !== 'boolean') {
    throw new UsageError('delivery.email must be true or false');
  }
  if (!amountChange.enabled && !renewalReminder.enabled) {
    throw new UsageError('At least one notification rule must be enabled');
  }
  return {
    amountChange: {
      enabled: amountChange.enabled,
      comparison: amountChange.comparison,
      baselinePence: Number(amountChange.baselinePence),
    },
    renewalReminder: {
      enabled: renewalReminder.enabled,
      renewalDate: renewalReminder.renewalDate as string | null,
      leadDays: Number(renewalReminder.leadDays),
    },
    delivery: { email: delivery.email },
  };
}

function isNotificationRule(value: unknown): boolean {
  if (!isObject(value)) return false;
  const renewalReminder = value.renewalReminder;
  const delivery = value.delivery;
  if (!isObject(renewalReminder) || !isObject(delivery)) return false;
  try {
    validateNotificationRulePayload({
      amountChange: value.amountChange,
      renewalReminder: {
        enabled: renewalReminder.enabled,
        renewalDate: renewalReminder.renewalDate,
        leadDays: renewalReminder.leadDays,
      },
      delivery: { email: delivery.email },
    });
  } catch {
    return false;
  }
  return hasOnlyFields(value, [
    'id', 'transactionRef', 'merchantName', 'currency', 'sourceAmountPence', 'amountChange',
    'renewalReminder', 'delivery', 'createdAt', 'updatedAt',
  ])
    && typeof value.id === 'string'
    && typeof value.transactionRef === 'string'
    && typeof value.merchantName === 'string'
    && typeof value.currency === 'string'
    && Number.isSafeInteger(value.sourceAmountPence)
    && hasOnlyFields(renewalReminder, ['enabled', 'renewalDate', 'leadDays', 'remindOn'])
    && (renewalReminder.remindOn === null || isIsoDate(renewalReminder.remindOn))
    && hasOnlyFields(delivery, ['inApp', 'email'])
    && delivery.inApp === true
    && (value.createdAt === null || isIsoDateTime(value.createdAt))
    && (value.updatedAt === null || isIsoDateTime(value.updatedAt));
}

function isNotificationRuleResponse(value: unknown): boolean {
  return isObject(value)
    && hasOnlyFields(value, ['rule'])
    && (value.rule === null || isNotificationRule(value.rule));
}

function isNotificationRuleListResponse(value: unknown): boolean {
  return isObject(value)
    && hasOnlyFields(value, ['rules'])
    && Array.isArray(value.rules)
    && value.rules.every(isNotificationRule);
}

function isNotificationRuleDeleteResponse(value: unknown): boolean {
  return isObject(value)
    && hasOnlyFields(value, ['deleted', 'transactionRef'])
    && value.deleted === true
    && typeof value.transactionRef === 'string';
}

function isRenewalExtractionResponse(value: unknown): boolean {
  return isObject(value)
    && hasOnlyFields(value, ['renewalDate', 'confidence'])
    && (value.renewalDate === null || isIsoDate(value.renewalDate))
    && (value.confidence === 'high' || value.confidence === 'medium' || value.confidence === 'low');
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
      'sharing',
      'assignmentScope',
      'categoryId',
      'lineItemId',
      'categorySplits',
      'incomeSubtype',
    ]),
    label,
  );

  requireString(assignment.transactionRef, `${label}.transactionRef`);
  let sharing: AgentAssignment['sharing'];
  if (assignment.sharing !== undefined) {
    const sharingValue = requireObject(assignment.sharing, `${label}.sharing`);
    rejectUnknownFields(sharingValue, new Set([
      'isShared',
      'shareRatio',
      'userExclusiveAmountPence',
      'partnerExclusiveAmountPence',
    ]), `${label}.sharing`);
    if (typeof sharingValue.isShared !== 'boolean') {
      throw new UsageError(`${label}.sharing.isShared must be true or false`);
    }
    if (
      sharingValue.shareRatio !== undefined
      && (
        typeof sharingValue.shareRatio !== 'number'
        || !Number.isFinite(sharingValue.shareRatio)
        || sharingValue.shareRatio < 0
        || sharingValue.shareRatio > 1
      )
    ) {
      throw new UsageError(`${label}.sharing.shareRatio must be a number from 0 to 1`);
    }
    for (const field of ['userExclusiveAmountPence', 'partnerExclusiveAmountPence'] as const) {
      if (
        sharingValue[field] !== undefined
        && (!Number.isSafeInteger(sharingValue[field]) || Number(sharingValue[field]) < 0)
      ) {
        throw new UsageError(`${label}.sharing.${field} must be a nonnegative safe integer`);
      }
    }
    if (
      sharingValue.isShared === false
      && (
        sharingValue.shareRatio !== undefined
        || sharingValue.userExclusiveAmountPence !== undefined
        || sharingValue.partnerExclusiveAmountPence !== undefined
      )
    ) {
      throw new UsageError(`${label}.sharing cannot include split fields when isShared is false`);
    }
    sharing = {
      isShared: sharingValue.isShared,
      ...(sharingValue.shareRatio === undefined ? {} : { shareRatio: sharingValue.shareRatio }),
      ...(sharingValue.userExclusiveAmountPence === undefined
        ? {}
        : { userExclusiveAmountPence: Number(sharingValue.userExclusiveAmountPence) }),
      ...(sharingValue.partnerExclusiveAmountPence === undefined
        ? {}
        : { partnerExclusiveAmountPence: Number(sharingValue.partnerExclusiveAmountPence) }),
    };
  }
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
  const hasCategoryOperation = hasCategory || isClear || hasSplits;
  if (!hasCategoryOperation && sharing === undefined) {
    throw new UsageError(`${label}.categoryId or categorySplits is required`);
  }
  if (
    !hasCategoryOperation
    && (
      assignment.assignmentScope !== undefined
      || assignment.lineItemId !== undefined
      || assignment.incomeSubtype !== undefined
      || assignment.categorySplits !== undefined
    )
  ) {
    throw new UsageError(`${label} category options require categoryId or categorySplits`);
  }

  return {
    transactionRef: assignment.transactionRef as string,
    ...(sharing === undefined ? {} : { sharing }),
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
  const assignments = payload.assignments.map(validateAssignment);
  const transactionRefs = new Set<string>();
  for (const assignment of assignments) {
    if (transactionRefs.has(assignment.transactionRef)) {
      throw new UsageError('Each assignments[].transactionRef must be unique');
    }
    transactionRefs.add(assignment.transactionRef);
  }
  return { assignments };
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

export function validateReceiptConfirmation(value: unknown): ReceiptConfirmation {
  const receipt = requireObject(value, 'receipt');
  rejectUnknownFields(receipt, new Set(['schemaVersion', 'currency', 'receiptItems']), 'receipt');
  if (receipt.schemaVersion !== 1) throw new UsageError('receipt.schemaVersion must be 1');
  if (typeof receipt.currency !== 'string' || !/^[A-Z]{3}$/.test(receipt.currency)) {
    throw new UsageError('receipt.currency must be a three-letter uppercase code');
  }
  if (!Array.isArray(receipt.receiptItems) || receipt.receiptItems.length < 1 || receipt.receiptItems.length > 200) {
    throw new UsageError('receipt.receiptItems must contain between 1 and 200 items');
  }
  const receiptItems = receipt.receiptItems.map((value, index) => {
    const label = `receipt.receiptItems[${index}]`;
    const item = requireObject(value, label);
    rejectUnknownFields(item, new Set(['id', 'label', 'amountPence']), label);
    const id = requireString(item.id, `${label}.id`);
    const itemLabel = requireString(item.label, `${label}.label`);
    if (id.length > 80 || itemLabel.length > 160) throw new UsageError(`${label} is too long`);
    if (!Number.isSafeInteger(item.amountPence)) {
      throw new UsageError(`${label}.amountPence must be a signed safe integer`);
    }
    return {
      id,
      label: itemLabel,
      amountPence: Number(item.amountPence),
    };
  });
  return { schemaVersion: 1, currency: receipt.currency, receiptItems };
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
    && isAccountRef(value.accountRef)
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
  const isResponseSplit = (split: unknown): boolean => (
    isObject(split)
    && hasOnlyFields(split, ['categoryId', 'amountPence', 'lineItemId'])
    && typeof split.categoryId === 'string'
    && isNonnegativeSafeInteger(split.amountPence)
    && split.amountPence > 0
    && (split.lineItemId === undefined || typeof split.lineItemId === 'string')
  );
  const isContribution = (contribution: unknown): boolean => (
    isObject(contribution)
    && hasOnlyFields(contribution, [
      'eligible', 'included', 'amountPence', 'categoryId', 'lineItemId',
      'categorySplits', 'incomeSubtype',
    ])
    && typeof contribution.eligible === 'boolean'
    && typeof contribution.included === 'boolean'
    && isNonnegativeSafeInteger(contribution.amountPence)
    && contribution.amountPence > 0
    && (contribution.categoryId === null || typeof contribution.categoryId === 'string')
    && (contribution.lineItemId === null || typeof contribution.lineItemId === 'string')
    && Array.isArray(contribution.categorySplits)
    && contribution.categorySplits.every(isResponseSplit)
    && (
      contribution.incomeSubtype === null
      || contribution.incomeSubtype === 'pay'
      || contribution.incomeSubtype === 'interest'
    )
  );
  const isSharing = (sharing: unknown): boolean => (
    isObject(sharing)
    && hasOnlyFields(sharing, [
      'isShared', 'shareRatio', 'sharedAmountPence', 'userExclusiveAmountPence',
      'partnerExclusiveAmountPence', 'jointBudgetContribution',
    ])
    && typeof sharing.isShared === 'boolean'
    && typeof sharing.shareRatio === 'number'
    && Number.isFinite(sharing.shareRatio)
    && sharing.shareRatio >= 0
    && sharing.shareRatio <= 1
    && isNonnegativeSafeInteger(sharing.sharedAmountPence)
    && isNonnegativeSafeInteger(sharing.userExclusiveAmountPence)
    && isNonnegativeSafeInteger(sharing.partnerExclusiveAmountPence)
    && (
      sharing.jointBudgetContribution === null
      || isContribution(sharing.jointBudgetContribution)
    )
  );
  const isCategoryResult = (item: JsonObject): boolean => (
    (item.assignmentScope === 'personal' || item.assignmentScope === 'joint')
    && (item.categoryId === null || typeof item.categoryId === 'string')
    && (item.lineItemId === null || typeof item.lineItemId === 'string')
    && Array.isArray(item.categorySplits)
    && item.categorySplits.every(isResponseSplit)
    && (
      item.incomeSubtype === null
      || item.incomeSubtype === 'pay'
      || item.incomeSubtype === 'interest'
    )
  );
  return (
    isObject(value)
    && Array.isArray(value.succeeded)
    && value.succeeded.every((item) => (
      isObject(item)
      && hasOnlyFields(item, [
        'transactionRef', 'categoryId', 'lineItemId', 'categorySplits',
        'incomeSubtype', 'assignmentScope', 'sharing',
      ])
      && typeof item.transactionRef === 'string'
      && (isCategoryResult(item) || isSharing(item.sharing))
      && (item.sharing === undefined || isSharing(item.sharing))
    ))
    && Array.isArray(value.failed)
    && value.failed.every((item) => (
      isObject(item)
      && hasOnlyFields(item, ['transactionRef', 'error'])
      && typeof item.error === 'string'
      && (item.transactionRef === undefined || typeof item.transactionRef === 'string')
    ))
  );
}

function isAssignmentOperationResult(value: unknown): value is AssignmentOperationResult {
  if (!isObject(value) || typeof value.transactionRef !== 'string') return false;
  const { status, ...legacyResult } = value;
  if (status === 'succeeded') {
    return isAssignmentResponse({ succeeded: [legacyResult], failed: [] });
  }
  if (status === 'failed') {
    return isAssignmentResponse({ succeeded: [], failed: [legacyResult] });
  }
  return false;
}

export function parseAssignmentOperationResponse(
  value: unknown,
): AssignmentOperationResponse {
  const validBase = isObject(value)
    && hasOnlyFields(value, [
      'operationId', 'status', 'itemCount', 'completedCount', 'failedCount',
      'expiresAt', 'pollAfterMs', 'results',
    ])
    && typeof value.operationId === 'string'
    && /^[a-f0-9]{64}$/.test(value.operationId)
    && (
      value.status === 'pending'
      || value.status === 'processing'
      || value.status === 'completed'
    )
    && Number.isSafeInteger(value.itemCount)
    && Number(value.itemCount) >= 1
    && Number(value.itemCount) <= 100
    && isNonnegativeSafeInteger(value.completedCount)
    && Number(value.completedCount) <= Number(value.itemCount)
    && isNonnegativeSafeInteger(value.failedCount)
    && Number(value.failedCount) <= Number(value.completedCount)
    && isIsoDateTime(value.expiresAt)
    && isNonnegativeSafeInteger(value.pollAfterMs)
    && Number(value.pollAfterMs) >= 100
    && Number(value.pollAfterMs) <= 10_000;

  if (!validBase) {
    throw new ApiError('Invalid assignment operation response from the Agent API');
  }

  const isComplete = value.status === 'completed';
  const resultsAreValid = isComplete
    ? (
      Number(value.completedCount) === Number(value.itemCount)
      && Array.isArray(value.results)
      && value.results.length === Number(value.itemCount)
      && value.results.every(isAssignmentOperationResult)
      && value.results.filter((result) => result.status === 'failed').length
        === Number(value.failedCount)
    )
    : value.results === undefined;

  if (!resultsAreValid) {
    throw new ApiError('Invalid assignment operation response from the Agent API');
  }
  return value as unknown as AssignmentOperationResponse;
}

export function toLegacyAssignmentResponse(
  value: unknown,
): { succeeded: JsonObject[]; failed: JsonObject[] } {
  const operation = parseAssignmentOperationResponse(value);
  if (operation.status !== 'completed' || !operation.results) {
    throw new ApiError('Assignment operation is not complete');
  }

  const succeeded: JsonObject[] = [];
  const failed: JsonObject[] = [];
  for (const result of operation.results) {
    const { status, ...legacyResult } = result;
    if (status === 'succeeded') succeeded.push(legacyResult);
    else failed.push(legacyResult);
  }
  return { succeeded, failed };
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

function isBudgetFunding(value: unknown): boolean {
  return value === null || (
    isObject(value)
    && hasOnlyFields(value, ['toAssignPence', 'nextPeriodReservePence'])
    && isSafeInteger(value.toAssignPence)
    && isSafeInteger(value.nextPeriodReservePence)
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
    && isBudgetFunding(value.funding)
    && Array.isArray(value.categories)
    && value.categories.every(isBudgetCategory)
  );
}

function isActivityAmounts(value: unknown): boolean {
  return isObject(value)
    && hasOnlyFields(value, ['moneyInPence', 'moneyOutPence', 'netPence'])
    && isNonnegativeSafeInteger(value.moneyInPence)
    && isNonnegativeSafeInteger(value.moneyOutPence)
    && isSafeInteger(value.netPence)
    && Number.isSafeInteger(value.moneyInPence - value.moneyOutPence)
    && value.netPence === value.moneyInPence - value.moneyOutPence;
}

function isBudgetActivityStatusResponse(value: unknown): boolean {
  if (!isObject(value) || !hasOnlyFields(value, [
    'scope', 'periodKey', 'periodStatus', 'currency', 'period', 'refresh', 'activity', 'budget',
  ])) return false;
  if (!isObject(value.period) || !hasOnlyFields(value.period, [
    'startDate', 'endDate', 'dateRangeSource',
  ])) return false;
  if (!isObject(value.activity) || !hasOnlyFields(value.activity, [
    'transactionCount', 'categories', 'uncategorized',
  ])) return false;
  const activityCategories = value.activity.categories;
  if (!Array.isArray(activityCategories) || !activityCategories.every((category) => (
    isObject(category)
    && hasOnlyFields(category, ['id', 'name', 'moneyInPence', 'moneyOutPence', 'netPence'])
    && typeof category.id === 'string'
    && category.id.trim().length > 0
    && typeof category.name === 'string'
    && category.name.trim().length > 0
    && isActivityAmounts({
      moneyInPence: category.moneyInPence,
      moneyOutPence: category.moneyOutPence,
      netPence: category.netPence,
    })
  ))) return false;
  const budget = value.budget;
  if (budget !== null && (!isObject(budget)
    || !hasOnlyFields(budget, ['effectiveFromPeriodKey', 'funding', 'categories'])
    || typeof budget.effectiveFromPeriodKey !== 'string'
    || !/^\d{4}-(0[1-9]|1[0-2])$/.test(budget.effectiveFromPeriodKey)
    || !isBudgetFunding(budget.funding)
    || !Array.isArray(budget.categories)
    || !budget.categories.every((category) => (
      isObject(category)
      && hasOnlyFields(category, [
        'id', 'name', 'plannedPence', 'assignedPence', 'spentPence', 'availablePence',
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
  )) return false;
  return (value.scope === 'personal' || value.scope === 'joint')
    && typeof value.periodKey === 'string'
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.periodKey)
    && (value.periodStatus === 'current' || value.periodStatus === 'historical')
    && isCurrency(value.currency)
    && isIsoDate(value.period.startDate)
    && isIsoDate(value.period.endDate)
    && value.period.startDate <= value.period.endDate
    && (value.period.dateRangeSource === 'stored'
      || value.period.dateRangeSource === 'legacy_settings_fallback')
    && isNonnegativeSafeInteger(value.activity.transactionCount)
    && isActivityAmounts(value.activity.uncategorized)
    && (value.periodStatus === 'historical'
      ? value.refresh === null
      : isRefreshStatus(value.refresh));
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
    && isAccountRef(value.accountRef)
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
    && isAccountRef(value.accountRef)
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

function isReceiptConfirmation(value: unknown): boolean {
  try {
    validateReceiptConfirmation(value);
    return true;
  } catch {
    return false;
  }
}

function isReceiptEvidence(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { revision, receiptTotalPence, confirmedAt, sourceSurface, ...confirmation } = value;
  return (
    hasOnlyFields(value, [
      'schemaVersion',
      'currency',
      'receiptItems',
      'revision',
      'receiptTotalPence',
      'confirmedAt',
      'sourceSurface',
    ])
    && isReceiptConfirmation(confirmation)
    && Number.isSafeInteger(revision)
    && Number(revision) > 0
    && Number.isSafeInteger(receiptTotalPence)
    && isIsoDateTime(confirmedAt)
    && (sourceSurface === 'web' || sourceSurface === 'agent_api')
  );
}

function isReceiptExtractResponse(value: unknown): boolean {
  if (!isObject(value) || !hasOnlyFields(value, ['draft']) || !isObject(value.draft)) return false;
  const { warnings, ...confirmation } = value.draft;
  return (
    isReceiptConfirmation(confirmation)
    && Array.isArray(warnings)
    && warnings.length <= 20
    && warnings.every((warning) => (
      warning === 'currency_unclear' || warning === 'total_unclear' || warning === 'item_unclear'
    ))
  );
}

function isReceiptLookupResponse(value: unknown): boolean {
  return isObject(value)
    && hasOnlyFields(value, ['receipt'])
    && (value.receipt === null || isReceiptEvidence(value.receipt));
}

function isReceiptMutationResponse(value: unknown): boolean {
  return isObject(value) && hasOnlyFields(value, ['receipt']) && isReceiptEvidence(value.receipt);
}

function isReceiptDeleteResponse(value: unknown): boolean {
  return isObject(value) && hasOnlyFields(value, ['deleted']) && value.deleted === true;
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
      ? isBudgetActivityStatusResponse(value)
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
      : command === 'rules-list'
        ? isNotificationRuleListResponse(value)
        : command === 'rules-get' || command === 'rules-set'
          ? isNotificationRuleResponse(value)
          : command === 'rules-delete'
            ? isNotificationRuleDeleteResponse(value)
            : command === 'rules-scan-contract'
              ? isRenewalExtractionResponse(value)
      : command === 'receipts-extract'
        ? isReceiptExtractResponse(value)
        : command === 'receipts-get'
          ? isReceiptLookupResponse(value)
          : command === 'receipts-attach'
            ? isReceiptMutationResponse(value)
            : command === 'receipts-remove'
              ? isReceiptDeleteResponse(value)
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
