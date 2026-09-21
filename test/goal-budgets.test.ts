import { describe, expect, it } from 'vitest';

import { parseArgs } from '../src/args.js';
import { validateAssignmentPayload, parseApiResponse } from '../src/contracts.js';

describe('temporary budget review', () => {
  it('discovers budgets and filters their lifetime transactions', () => {
    expect(parseArgs(['goal-budgets'])).toEqual({ command: 'goal-budgets' });
    expect(parseArgs(['goal-budgets', '--help'])).toEqual({ command: 'help', topic: 'goal-budgets' });
    expect(parseArgs(['transactions', '--goal-budget-ref', 'gb_test', '--assignment-scope', 'joint'])).toMatchObject({ filters: { goalBudgetRef: 'gb_test', assignmentScope: 'joint' } });
  });
  it('preserves the destination in assignment input and allows explicit return to monthly', () => {
    for (const goalBudgetRef of ['gb_test', null]) {
      expect(validateAssignmentPayload({ assignments: [{ transactionRef: 'sloth_txn_test', goalBudgetRef, categoryId: 'hotel' }] }).assignments[0]).toMatchObject({ goalBudgetRef });
    }
    expect(() => validateAssignmentPayload({ assignments: [{ transactionRef: 'sloth_txn_test', goalBudgetRef: 'bad', categoryId: 'hotel' }] })).toThrow();
  });
  it('validates budget reads against the shared runtime schema', () => {
    expect(parseApiResponse('goal-budgets', { budgets: [] })).toEqual({ budgets: [] });
    expect(() => parseApiResponse('goal-budgets', { budgets: [{ remainingPence: 'wrong' }] })).toThrow();
  });
  it('accepts the destination returned by assignment operations', () => {
    const result = { succeeded: [{ transactionRef: 'tx', goalBudgetRef: 'gb_test', categoryId: 'hotel', lineItemId: null, categorySplits: [], incomeSubtype: null, assignmentScope: 'personal' }], failed: [] };
    expect(parseApiResponse('assign', result)).toEqual(result);
  });

});
