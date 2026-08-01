import { describe, expect, it } from 'vitest';

import {
  parseApiResponse,
  validateAssignmentPayload,
} from '../src/contracts.js';
import {
  agentApiV1AccountsResponse,
  agentApiV1AssignmentResponse,
  agentApiV1CategoriesResponse,
  agentApiV1ExplanationResponse,
  agentApiV1GoalDeleteResponse,
  agentApiV1GoalMutationResponse,
  agentApiV1GoalsResponse,
  agentApiV1TransactionsResponse,
} from './fixtures/agent-api-v1.js';

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
  });
});

describe('API response validation', () => {
  it('validates documented response envelopes while preserving fields', () => {
    expect(parseApiResponse(
      'accounts',
      agentApiV1AccountsResponse,
    )).toBe(agentApiV1AccountsResponse);
    expect(parseApiResponse(
      'transactions',
      agentApiV1TransactionsResponse,
    )).toBe(agentApiV1TransactionsResponse);
    expect(parseApiResponse(
      'categories',
      agentApiV1CategoriesResponse,
    )).toBe(agentApiV1CategoriesResponse);
    expect(parseApiResponse(
      'assign',
      agentApiV1AssignmentResponse,
    )).toBe(agentApiV1AssignmentResponse);
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
    expect(() => parseApiResponse('transactions', { transactions: 'not-an-array' })).toThrow(/invalid transactions response/i);
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
    expect(() => parseApiResponse('goals-delete', {
      deleted: false,
      deletedGoalId: 'goal-1',
    })).toThrow(/invalid goals-delete response/i);
  });
});
