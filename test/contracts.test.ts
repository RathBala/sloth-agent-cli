import { describe, expect, it } from 'vitest';

import {
  parseApiResponse,
  validateAssignmentPayload,
  validateJointBudgetSettingsResponse,
} from '../src/contracts.js';
import {
  agentApiV1AssignmentResponse,
  agentApiV1CategoriesResponse,
  agentApiV1ExplanationResponse,
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

  it('validates joint budget settings responses strictly', () => {
    expect(validateJointBudgetSettingsResponse({
      includeSharedPersonalTransactions: true,
      updatedAt: null,
      updatedBy: null,
    })).toEqual({
      includeSharedPersonalTransactions: true,
      updatedAt: null,
      updatedBy: null,
    });
    expect(() => validateJointBudgetSettingsResponse({
      includeSharedPersonalTransactions: 'yes',
      updatedAt: null,
      updatedBy: null,
    })).toThrow(/invalid joint budget settings response/i);
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
  });

  it('rejects malformed success responses', () => {
    expect(() => parseApiResponse('categories', { categories: [] })).toThrow(/invalid categories response/i);
    expect(() => parseApiResponse('transactions', { transactions: 'not-an-array' })).toThrow(/invalid transactions response/i);
    expect(() => parseApiResponse('assign', { succeeded: [], failed: 'nope' })).toThrow(/invalid assignment response/i);
    expect(() => parseApiResponse('ask-partner', {
      requestId: 'ter_1',
      publicUrl: 'not a URL',
      message: 'Share this link',
      expiresAt: 'tomorrow',
      status: 'open',
    })).toThrow(/invalid ask-partner response/i);
  });
});
