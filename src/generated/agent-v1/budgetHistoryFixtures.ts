// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import type { BudgetHistoryResponse } from './budgetHistory.js';

/** Synthetic public-boundary example; never production account data. */
export const budgetHistoryFixture: BudgetHistoryResponse = {
  scope: 'personal', periodKey: '2026-09',
  period: { startDate: '2026-09-01', endDate: '2026-09-30', dateRangeSource: 'stored', provisional: false },
  metadata: { targetSource: 'snapshot', effectiveFromPeriodKey: '2026-09', createdAt: null,
    capturedAt: '2026-09-01T00:00:00Z', updatedAt: null, updatedBy: 'unknown' },
  historyCoverage: 'recorded_saves_only',
  entries: [{ saveId: '00000000-0000-4000-8000-000000000001', savedAt: '2026-09-01T00:00:00Z',
    requestedPeriodKey: '2026-09', source: 'ui', entryPoint: 'set_budget', actor: 'self', currentSnapshotUpdated: true,
    changes: [{ path: ['categories', 'groceries', 'lineItems', 'weekly', 'plannedPence'], before: 40000, after: 45000 }] }],
  nextCursor: null,
};
