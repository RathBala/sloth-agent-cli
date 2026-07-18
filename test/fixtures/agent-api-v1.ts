export const agentApiV1CategoriesResponse = {
  categories: [{ id: 'groceries', name: 'Groceries', source: 'default' }],
  personalLineItemsByCategoryId: {
    groceries: [{ id: 'weekly', name: 'Weekly shop' }],
  },
  jointLineItemsByCategoryId: {},
} as const;

export const agentApiV1TransactionsResponse = {
  transactions: [{
    transactionRef: 'sloth_txn_ref',
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
} as const;

export const agentApiV1AssignmentResponse = {
  succeeded: [{
    transactionRef: 'ok-ref',
    categoryId: 'groceries',
    lineItemId: null,
    categorySplits: [{ categoryId: 'groceries', amountPence: 2000 }],
    incomeSubtype: null,
  }],
  failed: [{
    transactionRef: 'bad-ref',
    error: 'Invalid lineItemId for joint category groceries',
  }],
} as const;

export const agentApiV1ExplanationResponse = {
  requestId: 'ter_1',
  publicUrl: 'https://budget.slothmoney.app/transaction-explanations/token-1',
  message: 'Share this partner clarification link',
  expiresAt: '2026-07-21T10:00:00.000Z',
  status: 'open',
} as const;
