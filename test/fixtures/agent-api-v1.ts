export const agentApiV1CategoriesResponse = {
  categories: [{ id: 'groceries', name: 'Groceries', source: 'default' }],
  personalLineItemsByCategoryId: {
    groceries: [{ id: 'weekly', name: 'Weekly shop' }],
  },
  jointLineItemsByCategoryId: {},
} as const;

export const agentApiV1CategoryMutationResponse = {
  category: {
    id: 'custom-1',
    name: 'Holidays',
    iconKey: 'plane',
    categoryType: 'Wants',
    source: 'user',
  },
} as const;

export const agentApiV1LineItemMutationResponse = {
  scope: 'personal',
  categoryId: 'groceries',
  lineItem: { id: 'weekly', name: 'Weekly shop' },
} as const;

export const agentApiV1AccountsResponse = {
  asOf: '2026-08-01T12:00:00.000Z',
  accounts: [{
    accountRef: 'sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ',
    accountName: 'Everyday account',
    institutionName: 'Monzo',
    accountType: 'current',
    ownership: 'personal',
    balanceAmount: 1234.56,
    currency: 'GBP',
    source: 'connected',
    lastBalanceUpdatedAt: '2026-08-01T09:30:00.000Z',
    connectionState: 'active',
    isGoalSavingsSource: true,
  }, {
    accountRef: 'sloth_account_v1_5VeuB4MpR7W5L4uPdHRYSsfNWGqoQYqrKx3GZQiLoFM',
    accountName: null,
    institutionName: 'Shared bank',
    accountType: 'savings',
    ownership: 'joint',
    balanceAmount: null,
    currency: null,
    source: 'connected',
    lastBalanceUpdatedAt: null,
    connectionState: 'expired',
    isGoalSavingsSource: false,
  }],
} as const;

export const agentApiV1AccountMutationResponse = {
  changed: true,
  account: agentApiV1AccountsResponse.accounts[0],
} as const;

export const agentApiV1AccountRemovalResponse = {
  removed: true,
  changed: true,
  accountRef: agentApiV1AccountsResponse.accounts[0].accountRef,
} as const;

export const agentApiV1InvestmentsResponse = {
  asOf: '2026-08-01T12:00:00.000Z',
  investmentAccounts: [{
    ...agentApiV1AccountsResponse.accounts[0],
    accountName: 'Coinbase portfolio',
    institutionName: 'Coinbase',
    accountType: 'investments',
    balanceAmount: 6_515.5,
    holdings: [{
      instrumentType: 'crypto',
      symbol: 'BTC',
      name: 'Bitcoin',
      units: 0.125,
      unitPriceAmount: 52_000,
      marketValueAmount: 6_500,
      currency: 'GBP',
      providerFreshnessAsOf: '2026-08-01T09:25:00.000Z',
      syncedAt: '2026-08-01T09:30:00.000Z',
    }],
  }],
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
    accountRef: agentApiV1AccountsResponse.accounts[0].accountRef,
    scope: 'personal',
    categoryId: null,
    lineItemId: null,
    categorySplits: [],
    incomeSubtype: null,
    personalBudgetAmountPence: 2032,
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
  goalType: 'keep',
  spentAt: null,
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

export const agentApiV1BudgetResponse = {
  scope: 'personal',
  periodKey: '2026-08',
  periodStatus: 'current',
  currency: 'GBP',
  effectiveFromPeriodKey: '2026-08',
  funding: {
    toAssignPence: 12_000,
    nextPeriodReservePence: 5_000,
  },
  categories: [{
    id: 'groceries',
    name: 'Groceries',
    plannedPence: 45_000,
    assignedPence: 44_000,
    lineItems: [{
      id: 'weekly',
      name: 'Weekly shop',
      plannedPence: 35_000,
    }, {
      id: 'topups',
      name: 'Top-ups',
      plannedPence: 10_000,
    }],
  }],
} as const;

export const agentApiV1BudgetStatusResponse = {
  scope: 'personal',
  periodKey: '2026-08',
  periodStatus: 'current',
  currency: 'GBP',
  effectiveFromPeriodKey: '2026-08',
  funding: {
    toAssignPence: 12_000,
    nextPeriodReservePence: 5_000,
  },
  activity: {
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    transactionCount: 3,
    uncategorizedSpentPence: 2_500,
    unmappedSpentPence: 0,
  },
  refresh: {
    status: 'completed',
    reason: 'refreshed',
    utcDate: '2026-08-09',
  },
  categories: [{
    id: 'groceries',
    name: 'Groceries',
    plannedPence: 45_000,
    assignedPence: 44_000,
    spentPence: 49_295,
    availablePence: -5_295,
  }],
} as const;

export const agentApiV1BudgetMovementResponse = {
  moved: true,
  scope: 'personal',
  periodKey: '2026-08',
  currency: 'GBP',
  fromCategoryId: 'activities',
  toCategoryId: 'groceries',
  amountPence: 5_295,
  toAssignPence: 12_000,
  categoryBalances: [
    { categoryId: 'activities', assignedPence: 4_705 },
    { categoryId: 'groceries', assignedPence: 49_295 },
  ],
} as const;
