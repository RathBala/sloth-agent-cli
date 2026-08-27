import { describe, expect, it } from 'vitest';

import {
  parseApiResponse,
  parseAssignmentOperationResponse,
  toLegacyAssignmentResponse,
  validateReceiptConfirmation,
  validateAssignmentPayload,
  validateBudgetUpdatePayload,
  validateNotificationRulePayload,
} from '../src/contracts.js';
import {
  agentApiV1AccountsResponse,
  agentApiV1AccountMutationResponse,
  agentApiV1AccountRemovalResponse,
  agentApiV1AssignmentResponse,
  agentApiV1AssignmentOperationReceipt,
  agentApiV1AssignmentOperationStatus,
  agentApiV1BudgetMovementResponse,
  agentApiV1BudgetResponse,
  agentApiV1BudgetStatusResponse,
  agentApiV1BudgetActivityStatusResponse,
  agentApiV1CategoriesResponse,
  agentApiV1CategoryMutationResponse,
  agentApiV1ExplanationResponse,
  agentApiV1GoalDeleteResponse,
  agentApiV1GoalMutationResponse,
  agentApiV1GoalPreviewResponse,
  agentApiV1GoalsResponse,
  agentApiV1LineItemMutationResponse,
  agentApiV1InvestmentsResponse,
  agentApiV1NotificationRule,
  agentApiV1PortfolioResponse,
  agentApiV1RenewalExtractionResponse,
  agentApiV1TransactionsResponse,
} from './fixtures/agent-api-v1.js';

describe('household portfolio contract', () => {
  it('accepts the trusted household portfolio response and rejects leaked partner details', () => {
    expect(parseApiResponse('portfolio', agentApiV1PortfolioResponse))
      .toBe(agentApiV1PortfolioResponse);
    expect(() => parseApiResponse('portfolio', {
      ...agentApiV1PortfolioResponse,
      accounts: [{
        ...agentApiV1PortfolioResponse.accounts[0],
        providerAccountId: 'must-not-leak',
      }],
    })).toThrow(/invalid portfolio response/i);
  });
});

describe('notification rule contracts', () => {
  it('accepts the Agent API write shape and rejects computed response fields in input', () => {
    const input = {
      amountChange: { enabled: true, comparison: 'increase', baselinePence: 3184 },
      renewalReminder: { enabled: true, renewalDate: '2027-07-30', leadDays: 30 },
      delivery: { email: true },
    } as const;

    expect(validateNotificationRulePayload(input)).toEqual(input);
    expect(() => validateNotificationRulePayload({
      ...input,
      delivery: { inApp: true, email: true },
    })).toThrow(/unknown field.*inApp/i);
    expect(() => validateNotificationRulePayload({
      ...input,
      renewalReminder: { ...input.renewalReminder, leadDays: 0 },
    })).toThrow(/1 to 365/i);
  });

  it('accepts canonical rule and extraction responses', () => {
    expect(parseApiResponse('rules-get', { rule: agentApiV1NotificationRule }))
      .toEqual({ rule: agentApiV1NotificationRule });
    expect(parseApiResponse('rules-set', { rule: agentApiV1NotificationRule }))
      .toEqual({ rule: agentApiV1NotificationRule });
    expect(parseApiResponse('rules-list', { rules: [agentApiV1NotificationRule] }))
      .toEqual({ rules: [agentApiV1NotificationRule] });
    expect(parseApiResponse('rules-scan-contract', agentApiV1RenewalExtractionResponse))
      .toEqual(agentApiV1RenewalExtractionResponse);
  });
});

describe('budget update payload validation', () => {
  it('accepts unique nonnegative line-item allocations', () => {
    expect(validateBudgetUpdatePayload({
      allocations: [
        { categoryId: 'groceries', lineItemId: 'weekly', plannedPence: 45_000 },
        { categoryId: 'bills', lineItemId: 'energy', plannedPence: 0 },
      ],
    })).toEqual({
      allocations: [
        { categoryId: 'groceries', lineItemId: 'weekly', plannedPence: 45_000 },
        { categoryId: 'bills', lineItemId: 'energy', plannedPence: 0 },
      ],
    });
  });

  it('rejects empty, duplicate, unsafe, or unknown budget data', () => {
    expect(() => validateBudgetUpdatePayload({ allocations: [] }))
      .toThrow(/between 1 and 100/);
    expect(() => validateBudgetUpdatePayload({
      allocations: [
        { categoryId: 'groceries', lineItemId: 'weekly', plannedPence: 1 },
        { categoryId: 'groceries', lineItemId: 'weekly', plannedPence: 2 },
      ],
    })).toThrow(/duplicate/);
    expect(() => validateBudgetUpdatePayload({
      allocations: [{ categoryId: 'groceries', lineItemId: 'weekly', plannedPence: -1 }],
    })).toThrow(/nonnegative safe integer/);
    expect(() => validateBudgetUpdatePayload({
      allocations: [{ categoryId: 'groceries', lineItemId: 'weekly', plannedPence: 1, amount: 1 }],
    })).toThrow(/unknown field/);
  });
});

describe('assignment payload validation', () => {
  it('accepts single, split, and clear assignments', () => {
    expect(validateAssignmentPayload({
      assignments: [
        { transactionRef: 'sloth_txn_1', categoryId: 'groceries', lineItemId: 'weekly' },
        {
          transactionRef: 'sloth_txn_2',
          categorySplits: [
            { categoryId: 'groceries', amountPence: 1500 },
            { categoryId: 'shopping', amountPence: 500, lineItemId: 'clothes' },
          ],
        },
        { transactionRef: 'sloth_txn_3', assignmentScope: 'joint', categoryId: null },
      ],
    })).toEqual({
      assignments: [
        { transactionRef: 'sloth_txn_1', categoryId: 'groceries', lineItemId: 'weekly' },
        {
          transactionRef: 'sloth_txn_2',
          categorySplits: [
            { categoryId: 'groceries', amountPence: 1500 },
            { categoryId: 'shopping', amountPence: 500, lineItemId: 'clothes' },
          ],
        },
        { transactionRef: 'sloth_txn_3', assignmentScope: 'joint', categoryId: null },
      ],
    });
  });

  it('accepts sharing-only and combined assignments', () => {
    const payload = {
      assignments: [
        { transactionRef: 'sloth_txn_1', sharing: { isShared: true } },
        {
          transactionRef: 'sloth_txn_2',
          sharing: {
            isShared: true,
            shareRatio: 0.6,
            userExclusiveAmountPence: 500,
            partnerExclusiveAmountPence: 0,
          },
          assignmentScope: 'joint',
          categoryId: 'groceries',
        },
        { transactionRef: 'sloth_txn_3', sharing: { isShared: false } },
      ],
    };

    expect(validateAssignmentPayload(payload)).toEqual(payload);
  });

  it('rejects malformed or ambiguous assignment data', () => {
    expect(() => validateAssignmentPayload({ assignments: [] })).toThrow(/between 1 and 100/);
    expect(() => validateAssignmentPayload({
      assignments: [{ transactionRef: 'sloth_txn_1' }],
    })).toThrow(/categoryId or categorySplits is required/);
    expect(() => validateAssignmentPayload({
      assignments: [{
        transactionRef: 'sloth_txn_1',
        categorySplits: [{ categoryId: 'groceries', amountPence: 1.5 }],
      }],
    })).toThrow(/positive integer/);
    expect(() => validateAssignmentPayload({
      assignments: [{ transactionRef: 'sloth_txn_1', categoryId: null, unexpected: true }],
    })).toThrow(/unknown field/);
    expect(() => validateAssignmentPayload({
      assignments: [
        { transactionRef: 'sloth_txn_1', categoryId: 'groceries' },
        { transactionRef: 'sloth_txn_1', categoryId: 'activities' },
      ],
    })).toThrow(/transactionRef must be unique/);
    for (const sharing of [
      {},
      { isShared: true, shareRatio: -0.1 },
      { isShared: true, shareRatio: 1.1 },
      { isShared: true, userExclusiveAmountPence: 1.5 },
      { isShared: true, partnerExclusiveAmountPence: -1 },
      { isShared: false, shareRatio: 0.5 },
    ]) {
      expect(() => validateAssignmentPayload({
        assignments: [{ transactionRef: 'sloth_txn_1', sharing }],
      })).toThrow();
    }
    for (const categoryOption of [
      { assignmentScope: 'joint' },
      { lineItemId: 'weekly' },
      { incomeSubtype: 'pay' },
      { categorySplits: null },
    ]) {
      expect(() => validateAssignmentPayload({
        assignments: [{
          transactionRef: 'sloth_txn_1',
          sharing: { isShared: true },
          ...categoryOption,
        }],
      })).toThrow(/category options require/);
    }
  });
});

describe('assignment operation response validation', () => {
  it('accepts pending receipts and completed ordered item results', () => {
    expect(parseAssignmentOperationResponse(agentApiV1AssignmentOperationReceipt))
      .toBe(agentApiV1AssignmentOperationReceipt);
    expect(parseAssignmentOperationResponse(agentApiV1AssignmentOperationStatus))
      .toBe(agentApiV1AssignmentOperationStatus);
  });

  it('converts terminal items back to the stable CLI result shape', () => {
    expect(toLegacyAssignmentResponse(agentApiV1AssignmentOperationStatus)).toEqual(
      agentApiV1AssignmentResponse,
    );
  });

  it.each([
    {
      label: 'missing progress counts',
      response: {
        operationId: 'assignment_operation_01',
        status: 'pending',
        itemCount: 2,
        expiresAt: '2026-08-08T12:00:00.000Z',
        pollAfterMs: 250,
      },
    },
    {
      label: 'results before completion',
      response: {
        ...agentApiV1AssignmentOperationReceipt,
        results: [],
      },
    },
    {
      label: 'completion without all items',
      response: {
        ...agentApiV1AssignmentOperationStatus,
        completedCount: 1,
      },
    },
    {
      label: 'counts that disagree with results',
      response: {
        ...agentApiV1AssignmentOperationStatus,
        failedCount: 0,
      },
    },
    {
      label: 'a malformed terminal item',
      response: {
        ...agentApiV1AssignmentOperationStatus,
        results: [{ status: 'failed', transactionRef: 'ref' }],
      },
    },
    {
      label: 'a noncanonical operation ID',
      response: {
        ...agentApiV1AssignmentOperationReceipt,
        operationId: 'assignment_operation_01',
      },
    },
    {
      label: 'a polling delay below the server contract',
      response: {
        ...agentApiV1AssignmentOperationReceipt,
        pollAfterMs: 0,
      },
    },
    {
      label: 'a polling delay above the server contract',
      response: {
        ...agentApiV1AssignmentOperationReceipt,
        pollAfterMs: 10_001,
      },
    },
  ])('rejects $label', ({ response }) => {
    expect(() => parseAssignmentOperationResponse(response))
      .toThrow(/invalid assignment operation response/i);
  });
});

describe('receipt contracts', () => {
  const confirmation = {
    schemaVersion: 1,
    currency: 'GBP',
    receiptItems: [
      { id: 'meal', label: 'Dinner', amountPence: 7_400 },
      { id: 'service', label: 'Service charge', amountPence: 1_000 },
      { id: 'discount', label: 'Offer', amountPence: -500 },
    ],
  };

  it('accepts signed receipt rows and rejects images or removed classification fields', () => {
    expect(validateReceiptConfirmation(confirmation)).toEqual(confirmation);
    expect(() => validateReceiptConfirmation({ ...confirmation, imageUrl: 'https://example.com' }))
      .toThrow(/unknown field/i);
    expect(() => validateReceiptConfirmation({
      ...confirmation,
      receiptItems: [{ id: 'bad', kind: 'discount', label: 'Offer', amountPence: -500 }],
    })).toThrow(/unknown field.*kind/i);
  });

  it('validates extraction, lookup, save, and delete responses', () => {
    const evidence = {
      ...confirmation,
      revision: 1,
      receiptTotalPence: 7_900,
      confirmedAt: '2026-08-20T10:00:00.000Z',
      sourceSurface: 'agent_api',
    };
    expect(parseApiResponse('receipts-extract', { draft: { ...confirmation, warnings: [] } }))
      .toEqual({ draft: { ...confirmation, warnings: [] } });
    expect(parseApiResponse('receipts-get', { receipt: null })).toEqual({ receipt: null });
    expect(parseApiResponse('receipts-attach', { receipt: evidence })).toEqual({ receipt: evidence });
    expect(parseApiResponse('receipts-remove', { deleted: true })).toEqual({ deleted: true });
  });
});

describe('API response validation', () => {
  it('validates documented response envelopes while preserving fields', () => {
    expect(parseApiResponse(
      'accounts',
      agentApiV1AccountsResponse,
    )).toBe(agentApiV1AccountsResponse);
    expect(parseApiResponse('accounts-update', agentApiV1AccountMutationResponse))
      .toBe(agentApiV1AccountMutationResponse);
    expect(parseApiResponse('accounts-remove', agentApiV1AccountRemovalResponse))
      .toBe(agentApiV1AccountRemovalResponse);
    expect(parseApiResponse('investments', agentApiV1InvestmentsResponse))
      .toBe(agentApiV1InvestmentsResponse);
    const jointInvestments = {
      ...agentApiV1InvestmentsResponse,
      investmentAccounts: [{
        ...agentApiV1InvestmentsResponse.investmentAccounts[0],
        ownership: 'joint',
      }],
    };
    expect(parseApiResponse('investments', jointInvestments)).toBe(jointInvestments);
    expect(parseApiResponse(
      'transactions',
      agentApiV1TransactionsResponse,
    )).toBe(agentApiV1TransactionsResponse);
    expect(parseApiResponse(
      'categories',
      agentApiV1CategoriesResponse,
    )).toBe(agentApiV1CategoriesResponse);
    expect(parseApiResponse('budget', agentApiV1BudgetResponse))
      .toBe(agentApiV1BudgetResponse);
    expect(() => parseApiResponse('budget-status', agentApiV1BudgetStatusResponse))
      .toThrow(/invalid budget-status response/i);
    expect(parseApiResponse('budget-status', agentApiV1BudgetActivityStatusResponse))
      .toBe(agentApiV1BudgetActivityStatusResponse);
    expect(parseApiResponse('budget-status', {
      ...agentApiV1BudgetActivityStatusResponse,
      periodStatus: 'current',
      refresh: agentApiV1BudgetStatusResponse.refresh,
      budget: {
        effectiveFromPeriodKey: '2026-08',
        funding: null,
        categories: [],
      },
    })).toMatchObject({
      periodStatus: 'current',
      budget: { funding: null },
    });
    expect(parseApiResponse('budget-update', agentApiV1BudgetResponse))
      .toBe(agentApiV1BudgetResponse);
    expect(parseApiResponse('budget-move', agentApiV1BudgetMovementResponse))
      .toBe(agentApiV1BudgetMovementResponse);
    const overallocatedBudget = {
      ...agentApiV1BudgetResponse,
      funding: {
        ...agentApiV1BudgetResponse.funding,
        toAssignPence: -1,
      },
      categories: agentApiV1BudgetResponse.categories.map((category) => ({
        ...category,
        assignedPence: -1,
      })),
    };
    expect(parseApiResponse('budget', overallocatedBudget)).toBe(overallocatedBudget);
    expect(parseApiResponse('categories-create', agentApiV1CategoryMutationResponse))
      .toBe(agentApiV1CategoryMutationResponse);
    expect(parseApiResponse('categories-rename', agentApiV1CategoryMutationResponse))
      .toBe(agentApiV1CategoryMutationResponse);
    expect(parseApiResponse('line-items-create', agentApiV1LineItemMutationResponse))
      .toBe(agentApiV1LineItemMutationResponse);
    expect(parseApiResponse('line-items-rename', agentApiV1LineItemMutationResponse))
      .toBe(agentApiV1LineItemMutationResponse);
    expect(parseApiResponse(
      'assign',
      agentApiV1AssignmentResponse,
    )).toBe(agentApiV1AssignmentResponse);
    const sharingResponse = {
      succeeded: [{
        transactionRef: 'sloth_txn_1',
        sharing: {
          isShared: true,
          shareRatio: 0.6,
          sharedAmountPence: 2_000,
          userExclusiveAmountPence: 0,
          partnerExclusiveAmountPence: 0,
          jointBudgetContribution: {
            eligible: true,
            included: true,
            amountPence: 2_000,
            categoryId: null,
            lineItemId: null,
            categorySplits: [],
            incomeSubtype: null,
          },
        },
      }],
      failed: [],
    };
    expect(parseApiResponse('assign', sharingResponse)).toBe(sharingResponse);
    expect(parseApiResponse(
      'ask-partner',
      agentApiV1ExplanationResponse,
    )).toBe(agentApiV1ExplanationResponse);
    expect(parseApiResponse(
      'goals-list',
      agentApiV1GoalsResponse,
    )).toBe(agentApiV1GoalsResponse);
    expect(parseApiResponse(
      'goals-create',
      agentApiV1GoalMutationResponse,
    )).toBe(agentApiV1GoalMutationResponse);
    expect(parseApiResponse(
      'goals-preview',
      agentApiV1GoalPreviewResponse,
    )).toBe(agentApiV1GoalPreviewResponse);
    expect(parseApiResponse(
      'goals-update',
      agentApiV1GoalMutationResponse,
    )).toBe(agentApiV1GoalMutationResponse);
    const spentGoalResponse = {
      currency: 'GBP',
      forecastBasis: agentApiV1GoalMutationResponse.forecastBasis,
      goal: {
        ...agentApiV1GoalMutationResponse.goal,
        goalType: 'spend',
        spentAt: '2026-08-15T12:00:00.000Z',
      },
    } as const;
    expect(parseApiResponse('goals-mark-spent', spentGoalResponse))
      .toBe(spentGoalResponse);
    expect(parseApiResponse('goals-restore', agentApiV1GoalMutationResponse))
      .toBe(agentApiV1GoalMutationResponse);
    expect(parseApiResponse(
      'goals-delete',
      agentApiV1GoalDeleteResponse,
    )).toBe(agentApiV1GoalDeleteResponse);
  });

  it('rejects malformed success responses', () => {
    expect(() => parseApiResponse('accounts', {
      ...agentApiV1AccountsResponse,
      accounts: [{
        ...agentApiV1AccountsResponse.accounts[0],
        accountDocId: 'GB29NWBK60161331926819',
      }],
    })).toThrow(/invalid accounts response/i);
    expect(() => parseApiResponse('accounts-update', {
      ...agentApiV1AccountMutationResponse,
      canUpdateGoalSavingsSource: true,
    })).toThrow(/invalid accounts-update response/i);
    expect(() => parseApiResponse('accounts-remove', {
      ...agentApiV1AccountRemovalResponse,
      unexpected: true,
    })).toThrow(/invalid accounts-remove response/i);
    expect(() => parseApiResponse('investments', {
      ...agentApiV1InvestmentsResponse,
      investmentAccounts: [{
        ...agentApiV1InvestmentsResponse.investmentAccounts[0],
        holdings: [{
          ...agentApiV1InvestmentsResponse.investmentAccounts[0].holdings[0],
          accountKey: 'private-account-key',
        }],
      }],
    })).toThrow(/invalid investments response/i);
    expect(() => parseApiResponse('accounts', {
      ...agentApiV1AccountsResponse,
      accounts: [{
        ...agentApiV1AccountsResponse.accounts[0],
        accountRef: 'account-doc-1',
        currency: 'gbp',
        connectionState: 'stale-ish',
      }],
    })).toThrow(/invalid accounts response/i);
    expect(() => parseApiResponse('accounts', {
      ...agentApiV1AccountsResponse,
      accounts: [{
        ...agentApiV1AccountsResponse.accounts[0],
        accountName: ' Everyday account ',
      }],
    })).toThrow(/invalid accounts response/i);
    expect(() => parseApiResponse('categories', { categories: [] })).toThrow(/invalid categories response/i);
    expect(() => parseApiResponse('budget', {
      ...agentApiV1BudgetResponse,
      categories: [{ ...agentApiV1BudgetResponse.categories[0], assignedPence: '44000' }],
    })).toThrow(/invalid budget response/i);
    expect(() => parseApiResponse('budget-status', {
      ...agentApiV1BudgetActivityStatusResponse,
      activity: {
        ...agentApiV1BudgetActivityStatusResponse.activity,
        categories: agentApiV1BudgetActivityStatusResponse.activity.categories.map((category) => (
          category.id === 'income' ? { ...category, netPence: 1 } : category
        )),
      },
    })).toThrow(/invalid budget-status response/i);
    expect(() => parseApiResponse('budget-update', {
      ...agentApiV1BudgetResponse,
      unexpected: true,
    })).toThrow(/invalid budget-update response/i);
    expect(() => parseApiResponse('categories-create', {
      category: { ...agentApiV1CategoryMutationResponse.category, source: 'default' },
    })).toThrow(/invalid categories-create response/i);
    expect(() => parseApiResponse('line-items-rename', {
      ...agentApiV1LineItemMutationResponse,
      lineItem: { ...agentApiV1LineItemMutationResponse.lineItem, amount: 0 },
    })).toThrow(/invalid line-items-rename response/i);
    expect(() => parseApiResponse('transactions', { transactions: 'not-an-array' })).toThrow(/invalid transactions response/i);
    expect(() => parseApiResponse('transactions', {
      ...agentApiV1TransactionsResponse,
      transactions: [{
        ...agentApiV1TransactionsResponse.transactions[0],
        accountRef: 'account-1',
      }],
    })).toThrow(/invalid transactions response/i);
    expect(() => parseApiResponse('transactions', {
      ...agentApiV1TransactionsResponse,
      refresh: {
        status: 'done-ish',
        reason: 'raw provider failure',
        utcDate: 'today',
      },
    })).toThrow(/invalid transactions response/i);
    expect(() => parseApiResponse('transactions', {
      ...agentApiV1TransactionsResponse,
      refresh: {
        ...agentApiV1TransactionsResponse.refresh,
        utcDate: '2026-02-30',
      },
    })).toThrow(/invalid transactions response/i);
    expect(() => parseApiResponse('assign', { succeeded: [], failed: 'nope' })).toThrow(/invalid assignment response/i);
    expect(() => parseApiResponse('assign', {
      succeeded: [{
        transactionRef: 'sloth_txn_1',
        sharing: {
          isShared: true,
          shareRatio: 0.6,
          sharedAmountPence: 1.5,
          userExclusiveAmountPence: 0,
          partnerExclusiveAmountPence: 0,
          jointBudgetContribution: null,
        },
      }],
      failed: [],
    })).toThrow(/invalid assignment response/i);
    expect(() => parseApiResponse('ask-partner', {
      requestId: 'ter_1',
      publicUrl: 'not a URL',
      message: 'Share this link',
      expiresAt: 'tomorrow',
      status: 'open',
    })).toThrow(/invalid ask-partner response/i);
    expect(() => parseApiResponse('goals-list', {
      currency: 'GBP',
      goals: [{ ...agentApiV1GoalMutationResponse.goal, targetAmount: '12000' }],
    })).toThrow(/invalid goals-list response/i);
    expect(() => parseApiResponse('goals-update', {
      currency: 'GBP',
      goal: { ...agentApiV1GoalMutationResponse.goal, unexpected: true },
    })).toThrow(/invalid goals-update response/i);
    expect(() => parseApiResponse('goals-list', {
      currency: 'GBP',
      goals: [{
        ...agentApiV1GoalMutationResponse.goal,
        isAchieved: false,
      }],
    })).toThrow(/invalid goals-list response/i);
    expect(() => parseApiResponse('goals-update', {
      currency: 'GBP',
      goal: { ...agentApiV1GoalMutationResponse.goal, spentAt: 'not-an-iso-timestamp' },
    })).toThrow(/invalid goals-update response/i);
    expect(() => parseApiResponse('goals-list', {
      currency: 'GBP',
      goals: [{
        ...agentApiV1GoalMutationResponse.goal,
        goalType: 'keep',
        spentAt: '2026-08-15T12:00:00.000Z',
      }],
    })).toThrow(/invalid goals-list response/i);
    expect(() => parseApiResponse('goals-list', {
      currency: 'GBP',
      goals: [{ ...agentApiV1GoalMutationResponse.goal, priority: 0 }],
    })).toThrow(/invalid goals-list response/i);
    expect(() => parseApiResponse('goals-delete', {
      deleted: false,
      deletedGoalId: 'goal-1',
    })).toThrow(/invalid goals-delete response/i);
  });
});
