// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { budgetAuditResponseSchema } from './budgetAudit.js';

// Synthetic financial data only. Shared by paired API and packed CLI tests.
export const budgetAuditFixture = budgetAuditResponseSchema.parse({
  scope: 'personal', asOf: '2026-09-10T12:00:00.000Z',
  current: {
    periodKey: '2026-09', currency: 'GBP',
    period: { startDate: '2026-09-01', endDate: '2026-09-30', dateRangeSource: 'stored' },
    budgetRemainingPence: 12000, accountBalancePence: 10000, differencePence: 2000,
    verificationStatus: 'verified', sourceCheckpointId: 'synthetic-b', sourcePeriodKey: '2026-09',
    sourceCapturedAt: '2026-09-10T10:00:00.000Z', sourceBalanceAt: null, source: 'agent_auto',
    freshnessBasis: 'checkpoint_capture_time', freshnessMaxAgeSeconds: 86400,
  },
  checkpointPeriodKey: null, historyCoverage: 'recorded_checkpoints_only',
  checkpoints: ['synthetic-b', 'synthetic-a'].map((id, index) => ({
    id, scope: 'personal', periodKey: '2026-09', currency: 'GBP',
    budgetRemainingPence: 11000 + index * 1000, accountBalancePence: 10000,
    differencePence: 1000 + index * 1000, verificationStatus: 'verified', selectedAccountCount: 1,
    capturedAt: `2026-09-${String(10 - index).padStart(2, '0')}T10:00:00.000Z`, sourceBalanceAt: null,
    source: index === 0 ? 'agent_auto' : 'backing_accounts_save',
  })), nextCursor: null,
});
