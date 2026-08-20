import { describe, expect, it } from 'vitest';

import {
  parseApiResponse,
  validateAssignmentPayload,
  validateBudgetUpdatePayload,
} from '../src/contracts.js';
import {
  agentApiV1AccountsResponse,
  agentApiV1AccountMutationResponse,
  agentApiV1AccountRemovalResponse,
  agentApiV1AssignmentResponse,
  agentApiV1BudgetMovementResponse,
  agentApiV1BudgetResponse,
  agentApiV1BudgetStatusResponse,
  agentApiV1CategoriesResponse,
  agentApiV1CategoryMutationResponse,
  agentApiV1ExplanationResponse,
  agentApiV1GoalDeleteResponse,
  agentApiV1GoalMutationResponse,
  agentApiV1GoalsResponse,
  agentApiV1LineItemMutationResponse,
  agentApiV1InvestmentsResponse,
  agentApiV1TransactionsResponse,
} from './fixtures/agent-api-v1.js';

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
    expect(parseApiResponse('budget-status', agentApiV1BudgetStatusResponse))
      .toBe(agentApiV1BudgetStatusResponse);
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
      'goals-update',
      agentApiV1GoalMutationResponse,
    )).toBe(agentApiV1GoalMutationResponse);
    const spentGoalResponse = {
      currency: 'GBP',
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
      ...agentApiV1BudgetStatusResponse,
      activity: {
        ...agentApiV1BudgetStatusResponse.activity,
        rawTransactions: [],
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
