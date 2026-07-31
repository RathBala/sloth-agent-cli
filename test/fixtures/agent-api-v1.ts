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
    jointBudgetContribution: null,
  }],
  nextCursor: null,
  refresh: {
    status: 'completed',
    reason: 'refreshed',
    utcDate: '2026-07-31',
  },
} as const;

export const agentApiV1AssignmentResponse = {
  succeeded: [{
    transactionRef: 'ok-ref',
    categoryId: 'groceries',
    lineItemId: null,
    categorySplits: [{ categoryId: 'groceries', amountPence: 2000 }],
    incomeSubtype: null,
    assignmentScope: 'personal',
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

export const agentApiV1Goal = {
  id: 'goal-1',
  name: 'Emergency fund',
  targetAmount: 12_000,
  targetMonthKey: '2027-06',
  isAchieved: false,
  sharedWithPartner: false,
} as const;

export const agentApiV1GoalsResponse = {
  currency: 'GBP',
  goals: [agentApiV1Goal],
} as const;

export const agentApiV1GoalMutationResponse = {
  currency: 'GBP',
  goal: agentApiV1Goal,
} as const;

export const agentApiV1GoalDeleteResponse = {
  deleted: true,
  deletedGoalId: 'goal-1',
} as const;
