// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';

const pence = z.number().int().safe();
const date = z.iso.date();
const scope = z.enum(['personal', 'joint']);
export const budgetCashflowQuerySchema = z.object({ scope }).strict();
export const budgetCashflowItemSchema = z.object({
  scope, categoryId: z.string().min(1), categoryName: z.string(),
  lineItemId: z.string().nullable(), name: z.string(),
  plannedPence: pence.nonnegative(), spentPence: pence, remainingPence: pence.nonnegative(),
  timingMethod: z.enum(['historical', 'next_day']), historyPeriodCount: z.number().int().min(0).max(3),
  schedule: z.array(z.object({ date, amountPence: pence.nonnegative() }).strict()),
}).strict();
export const budgetCashflowPeriodSchema = z.object({
  scope, periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), startDate: date, endDate: date,
  dateRangeSource: z.enum(['stored', 'legacy_settings_fallback']),
}).strict();
const common = {
  scope, asOf: z.iso.datetime(),
  limitations: z.array(z.enum(['pending_not_reconciled', 'income_transfers_excluded'])),
};
export const budgetCashflowResponseSchema = z.discriminatedUnion('status', [
  z.object({
    ...common, status: z.literal('unavailable'),
    reason: z.enum(['budget_not_found', 'account_not_configured', 'multiple_backing_accounts',
      'account_unavailable', 'invalid_balance', 'currency_mismatch', 'invalid_period', 'shared_budget_unavailable']),
  }).strict(),
  z.object({
    ...common, status: z.literal('available'), currency: z.string().regex(/^[A-Z]{3}$/),
    period: budgetCashflowPeriodSchema, contributingPeriods: z.array(budgetCashflowPeriodSchema).min(1).max(2),
    account: z.object({ accountRef: z.string().min(1), name: z.string().nullable(), institutionName: z.string().nullable(),
      balanceUpdatedAt: z.iso.datetime().nullable(), balanceStale: z.boolean(),
    }).strict(),
    warnings: z.array(z.enum(['stale_balance', 'incomplete_period_coverage'])),
    startingBalancePence: pence, remainingSpendingPence: pence.nonnegative(), closingBalancePence: pence,
    minimumBalancePence: pence, minimumBalanceDate: date, firstNegativeDate: date.nullable(),
    items: z.array(budgetCashflowItemSchema),
    dailyBalances: z.array(z.object({ date, spendingPence: pence.nonnegative(), balancePence: pence }).strict()).min(1),
  }).strict(),
]);
export type BudgetCashflowQuery = z.infer<typeof budgetCashflowQuerySchema>;
export type BudgetCashflowResponse = z.infer<typeof budgetCashflowResponseSchema>;
export type BudgetCashflowItem = z.infer<typeof budgetCashflowItemSchema>;
export type BudgetCashflowPeriod = z.infer<typeof budgetCashflowPeriodSchema>;
