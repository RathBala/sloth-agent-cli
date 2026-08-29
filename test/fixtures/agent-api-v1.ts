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
    isGoalFundingAccount: true,
    partnerVisibility: 'private',
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
    isGoalFundingAccount: false,
    partnerVisibility: 'balance',
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

export const agentApiV1PortfolioResponse = {
  asOf: '2026-08-01T12:00:00.000Z',
  currency: 'GBP',
  view: 'household',
  hasPartner: true,
  totals: { savingsAmount: 7800, investmentsAmount: 10934.4, trackedAmount: 18734.4 },
  excludedCurrencyAccountCount: 0,
  refresh: { status: 'skipped', reason: 'all_balances_fresh', utcDate: '2026-08-01' },
  accounts: [{
    accountRef: agentApiV1AccountsResponse.accounts[1].accountRef,
    ownerRole: 'partner',
    accountName: 'Stocks & Shares ISA',
    institutionName: 'Vanguard',
    accountType: 'investments',
    ownership: 'personal',
    balanceAmount: 10934.4,
    currency: 'GBP',
    source: 'connected',
    lastBalanceUpdatedAt: '2026-08-01T09:30:00.000Z',
    connectionState: 'active',
    partnerVisibility: 'holdings',
    isGoalFundingAccount: null,
    holdings: [{
      instrumentType: 'etf',
      symbol: 'VUAG',
      name: 'Vanguard S&P 500 UCITS ETF',
      units: 12.345,
      unitPriceAmount: 88.57,
      marketValueAmount: 10934.4,
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
    checkpointId: 'agent-refresh-run',
  },
} as const;

export const agentApiV1TransactionsWithPendingResponse = {
  ...agentApiV1TransactionsResponse,
  refresh: {
    status: 'completed',
    reason: 'refreshed',
    utcDate: '2026-07-31',
    checkpointId: 'agent-refresh-run',
  },
  pending: {
    availability: 'current',
    observedAt: '2026-07-31T06:00:00.000Z',
    transactions: [{
      pendingRef: `sloth_pending_v1_${'A'.repeat(43)}`,
      name: 'Tasker on Taskrabbit',
      amount: -50.83,
      currency: 'GBP',
      date: '2026-07-31',
      status: 'pending',
      accountRef: agentApiV1AccountsResponse.accounts[0].accountRef,
      scope: 'joint',
      writable: false,
      writeBlockReason: 'pending',
    }],
    truncated: false,
  },
} as const;

export const agentApiV1PartnerStatusResponse = {
  asOf: '2026-08-25T12:00:00.000Z',
  partnerStatus: 'connected',
  settlement: {
    currency: 'GBP',
    balance: { direction: 'settled', amountPence: 0 },
  },
  payments: [{
    paymentRef: `sloth_partner_payment_v1_${'A'.repeat(43)}`,
    direction: 'received',
    amountPence: 9709,
    currency: 'GBP',
    occurredAt: '2026-08-25T09:30:00.000Z',
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
    assignmentScope: 'personal',
  }],
  failed: [{
    transactionRef: 'bad-ref',
    error: 'Invalid lineItemId for joint category groceries',
  }],
} as const;

export const agentApiV1AssignmentOperationReceipt = {
  operationId: 'a'.repeat(64),
  status: 'pending',
  itemCount: 2,
  completedCount: 0,
  failedCount: 0,
  expiresAt: '2026-08-08T12:00:00.000Z',
  pollAfterMs: 250,
} as const;

export const agentApiV1AssignmentOperationStatus = {
  ...agentApiV1AssignmentOperationReceipt,
  status: 'completed',
  completedCount: 2,
  failedCount: 1,
  results: [
    {
      status: 'succeeded',
      ...agentApiV1AssignmentResponse.succeeded[0],
    },
    {
      status: 'failed',
      ...agentApiV1AssignmentResponse.failed[0],
    },
  ],
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
  forecastMonthKey: '2027-08',
  goalType: 'keep',
  spentAt: null,
  sharedWithPartner: false,
  effectivePriority: 1,
  fundingAccountRef: agentApiV1AccountsResponse.accounts[0].accountRef,
  fundingAccountLabel: 'Monzo · Everyday account',
} as const;

export const agentApiV1ForecastBasis = {
  calculatedAt: '2026-08-21T10:00:00.000Z',
  activeScenarioRevision: 7,
  projectionThroughMonthKey: '2126-07',
} as const;

export const agentApiV1GoalsResponse = {
  currency: 'GBP',
  forecastBasis: agentApiV1ForecastBasis,
  goals: [agentApiV1Goal],
} as const;

export const agentApiV1GoalMutationResponse = {
  currency: 'GBP',
  forecastBasis: agentApiV1ForecastBasis,
  goal: agentApiV1Goal,
} as const;

export const agentApiV1GoalPreviewResponse = {
  currency: 'GBP',
  forecastBasis: agentApiV1ForecastBasis,
  goal: {
    name: 'Emergency fund',
    targetAmount: 12_000,
    targetMonthKey: '2027-06',
    forecastMonthKey: '2027-08',
    goalType: 'spend',
    effectivePriority: 2,
    fundingAccountRef: agentApiV1AccountsResponse.accounts[0].accountRef,
    fundingAccountLabel: 'Monzo · Everyday account',
  },
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
    checkpointId: 'agent-budget-refresh-run',
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

export const agentApiV1BudgetActivityStatusResponse = {
  scope: 'personal',
  periodKey: '2026-07',
  periodStatus: 'historical',
  currency: 'GBP',
  period: {
    startDate: '2026-06-30',
    endDate: '2026-07-29',
    dateRangeSource: 'stored',
  },
  refresh: null,
  activity: {
    transactionCount: 4,
    categories: [{
      id: 'income',
      name: 'Income',
      moneyInPence: 300_000,
      moneyOutPence: 0,
      netPence: 300_000,
    }, {
      id: 'transfer',
      name: 'Transfer',
      moneyInPence: 5_000,
      moneyOutPence: 5_000,
      netPence: 0,
    }, {
      id: 'none',
      name: 'None',
      moneyInPence: 0,
      moneyOutPence: 0,
      netPence: 0,
    }],
    uncategorized: {
      moneyInPence: 0,
      moneyOutPence: 2_500,
      netPence: -2_500,
    },
  },
  budget: null,
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

export const agentApiV1NotificationRule = {
  id: 'rule_opaque',
  transactionRef: 'sloth_txn_opaque',
  merchantName: 'Pact Coffee',
  currency: 'GBP',
  sourceAmountPence: 3184,
  amountChange: {
    enabled: true,
    comparison: 'increase',
    baselinePence: 3184,
  },
  renewalReminder: {
    enabled: true,
    renewalDate: '2027-07-30',
    leadDays: 30,
    remindOn: '2027-06-30',
  },
  delivery: { inApp: true, email: true },
  createdAt: null,
  updatedAt: '2026-08-20T08:00:00.000Z',
} as const;

export const agentApiV1RenewalExtractionResponse = {
  renewalDate: null,
  confidence: 'low',
} as const;

export const agentApiV1Scenario = {
  monthKey: '2026-09',
  name: 'Deposit into the shopping pot each month?',
  activeOptionId: 'yes',
  options: [{
    id: 'no',
    label: 'No',
    isActive: false,
    contributions: [],
  }, {
    id: 'yes',
    label: 'Yes',
    isActive: true,
    contributions: [{
      accountRef: agentApiV1AccountsResponse.accounts[0].accountRef,
      accountLabel: 'Monzo · Everyday account',
      accountType: 'current',
      recurringAmount: 100,
      oneOffAmount: 0,
    }],
  }],
} as const;

export const agentApiV1ScenariosResponse = {
  currency: 'GBP',
  forecastBasis: { ...agentApiV1ForecastBasis, activeScenarioRevision: 8 },
  scenarios: [agentApiV1Scenario],
} as const;

export const agentApiV1ScenarioMutationResponse = {
  currency: 'GBP',
  changed: true,
  forecastBasis: { ...agentApiV1ForecastBasis, activeScenarioRevision: 8 },
  scenario: agentApiV1Scenario,
  deletedMonthKey: null,
  goals: [agentApiV1GoalMutationResponse.goal],
} as const;
