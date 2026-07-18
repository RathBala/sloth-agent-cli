import { describe, expect, it } from 'vitest';

import {
  parseApiResponse,
  validateAssignmentPayload,
} from '../src/contracts.js';

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
        { transactionRef: 'sloth_txn_3', categoryId: null },
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
        { transactionRef: 'sloth_txn_3', categoryId: null },
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
    const transactions = {
      transactions: [{
        transactionRef: 'sloth_txn_1',
        id: 'tx-1',
        name: 'Tesco',
        amount: -20.32,
        currency: 'GBP',
        date: '2026-05-01',
        status: 'booked',
        accountId: 'account-1',
        accountDocId: 'account-doc-1',
        requisitionId: 'req-1',
        scope: 'personal',
        categoryId: null,
        lineItemId: null,
        categorySplits: [],
        incomeSubtype: null,
      }],
      nextCursor: null,
    };

    expect(parseApiResponse('transactions', transactions)).toBe(transactions);
    expect(parseApiResponse('categories', {
      categories: [{ id: 'groceries', name: 'Groceries', source: 'default' }],
      personalLineItemsByCategoryId: {},
      jointLineItemsByCategoryId: {},
    })).toBeTruthy();
    expect(parseApiResponse('ask-partner', {
      requestId: 'ter_1',
      publicUrl: 'https://budget.slothmoney.app/transaction-explanations/token',
      message: 'Share this link',
      expiresAt: '2026-07-21T10:00:00.000Z',
      status: 'open',
    })).toBeTruthy();
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
