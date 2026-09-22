// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import type { BudgetCashflowResponse } from './budgetCashflow.js';

/** Synthetic outcome shared by the browser and installed CLI conformance checks. */
export const budgetCashflowFixture: Extract<BudgetCashflowResponse, { status: 'available' }> = {
  status: 'available', scope: 'personal', asOf: '2026-09-21T12:00:00.000Z', currency: 'GBP',
  limitations: ['pending_not_reconciled', 'income_transfers_excluded'], warnings: [],
  period: { scope: 'personal', periodKey: '2026-09', startDate: '2026-09-01', endDate: '2026-09-23', dateRangeSource: 'stored' },
  contributingPeriods: [{ scope: 'personal', periodKey: '2026-09', startDate: '2026-09-01', endDate: '2026-09-23', dateRangeSource: 'stored' }],
  account: { accountRef: 'sloth_account_v1_fixture', name: 'Everyday account', institutionName: 'Example Bank',
    balanceUpdatedAt: '2026-09-21T11:00:00.000Z', balanceStale: false },
  startingBalancePence: 30000, remainingSpendingPence: 35000, closingBalancePence: -5000,
  minimumBalancePence: -5000, minimumBalanceDate: '2026-09-22', firstNegativeDate: '2026-09-22',
  items: [{ scope: 'personal', categoryId: 'groceries', categoryName: 'Groceries', lineItemId: null, name: 'Groceries',
    plannedPence: 40000, spentPence: 5000, remainingPence: 35000, timingMethod: 'next_day', historyPeriodCount: 0,
    schedule: [{ date: '2026-09-22', amountPence: 35000 }] }],
  dailyBalances: [
    { date: '2026-09-21', spendingPence: 0, balancePence: 30000 },
    { date: '2026-09-22', spendingPence: 35000, balancePence: -5000 },
    { date: '2026-09-23', spendingPence: 0, balancePence: -5000 },
  ],
};
