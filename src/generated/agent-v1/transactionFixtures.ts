// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
// Synthetic public wire examples. No credentials or production records.
export const agentApiV1TransactionsResponse = {
  transactions: [{
    transactionRef: 'sloth_txn_ref',
    id: 'tx-1',
    name: 'Tesco',
    counterpartyName: 'Tesco Stores',
    transactionReference: 'Weekly groceries',
    amount: -20.32,
    currency: 'GBP',
    date: '2026-05-01',
    status: 'booked',
    accountRef: 'sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ',
    scope: 'personal',
    categoryId: null,
    lineItemId: null,
    categorySplits: [],
    incomeSubtype: null,
    incomePeriodKey: null,
    personalBudgetAmountPence: 2032,
    jointBudgetContribution: null,
  }],
  nextCursor: null,
  refresh: {
    status: 'skipped',
    reason: 'all_fetched_today',
    utcDate: '2026-07-31',
  },
} as const;

export const agentApiV1TransactionsWithPendingResponse = {
  ...agentApiV1TransactionsResponse,
  pending: {
    availability: 'current',
    observedAt: '2026-07-31T06:00:00.000Z',
    transactions: [{
      pendingRef: 'sloth_pending_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ',
      name: 'Tasker on Taskrabbit',
      counterpartyName: 'Tasker',
      transactionReference: 'Taskrabbit booking',
      amount: -50.83,
      currency: 'GBP',
      date: '2026-07-31',
      status: 'pending',
      accountRef: 'sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ',
      scope: 'joint',
      writable: false,
      writeBlockReason: 'pending',
    }],
    truncated: false,
  },
} as const;
