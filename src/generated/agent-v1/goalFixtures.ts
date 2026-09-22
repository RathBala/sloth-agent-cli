// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
// Synthetic conformance fixtures. Never add real account or user data.
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
  funding: { mode: 'automatic', accountRefs: ['sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ'] },
  fundingAccounts: [{ accountRef: 'sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ', label: 'Monzo · Everyday account' }],
  allocations: [{ accountRef: 'sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ', amount: 100 }],
  forecastAllocations: [{ accountRef: 'sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ', amount: 12000 }],
  savedAmount: 100,
  progressPercent: 100 / 12000 * 100,
  hasMissingAccounts: false,
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
    name: 'Robot',
    targetAmount: 100,
    targetMonthKey: null,
    forecastMonthKey: '2026-08',
    goalType: 'spend',
    effectivePriority: 2,
    funding: { mode: 'automatic', accountRefs: ['sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ'] },
    fundingAccounts: [{ accountRef: 'sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ', label: 'Monzo · Everyday account' }],
    allocations: [{ accountRef: 'sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ', amount: 100 }],
    forecastAllocations: [{ accountRef: 'sloth_account_v1_7PZfsvQ1Ktr50Dy-gVlfTZLnZXfLAfWXd98HNcT3tFQ', amount: 100 }],
    savedAmount: 100,
    progressPercent: 100,
    hasMissingAccounts: false,
  },
} as const;
