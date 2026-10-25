// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import type { z } from 'zod-v4';
import type { wealthReadResponseSchema } from './agentWealth.js';

export const wealthReadFixture: z.infer<typeof wealthReadResponseSchema> = {
  asOf: '2026-08-31T12:00:00Z',
  currency: 'GBP',
  properties: [
    {
      id: 'home',
      name: 'Maple House',
      currency: 'GBP',
      valueMinor: 40000000,
      valuationDate: '2026-08-15',
      annualGrowthPercent: 0,
    },
  ],
  mortgages: [
    {
      id: 'home',
      propertyId: 'home',
      statementDate: '2026-08-31',
      type: 'repayment',
      parts: [
        {
          id: 'part',
          type: 'repayment',
          balanceMinor: 25000000,
          annualRatePercent: 4.8,
          monthlyPaymentMinor: 150000,
        },
      ],
    },
  ],
  summary: {
    savingsMinor: 100000,
    investmentsMinor: 0,
    propertyMinor: 40000000,
    mortgageMinor: 25000000,
    equityMinor: 15000000,
    assetsMinor: 40100000,
    trackedNetWorthMinor: 15100000,
  },
  excludedCurrencyAccountCount: 0,
  excludedCurrencyPropertyCount: 0,
  excludedCurrencyHoldingCount: 0,
  unavailableReasons: [],
  balanceAsOf: [],
};
