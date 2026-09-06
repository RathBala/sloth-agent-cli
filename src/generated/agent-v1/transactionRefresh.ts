// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';

export type TransactionRefreshSource =
  | 'agent_auto'
  | 'agent_portfolio'
  | 'app_auto'
  | 'balance_retry'
  | 'transaction_retry'
  | 'dashboard_auto'
  | 'dashboard_manual'
  | 'transactions_auto'
  | 'transactions_manual'
  | 'manage_accounts_background'
  | 'savings_investments_auto'
  | 'account_selection_completion'
  | 'unspecified';

export const transactionRefreshStatusValues = [
  'skipped',
  'completed',
  'in_progress',
  'partial',
  'failed',
] as const;

export const transactionRefreshReasonValues = [
  'all_fetched_today',
  'no_api_connections',
  'no_selected_accounts',
  'refreshed',
  'wait_timeout',
  'account_failures',
  'partial_already_attempted',
  'quota_exceeded',
  'checkpoint_failed',
  'refresh_error',
] as const;

const transactionRefreshReasonSchema = z.enum(transactionRefreshReasonValues);
const transactionRefreshUtcDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  });

const refreshStatusSchema = <Status extends typeof transactionRefreshStatusValues[number]>(
  status: Status,
) => z.object({
  status: z.literal(status),
  reason: transactionRefreshReasonSchema,
  utcDate: transactionRefreshUtcDateSchema,
}).strict();

export const transactionRefreshStatusSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('completed'),
    reason: transactionRefreshReasonSchema,
    utcDate: transactionRefreshUtcDateSchema,
    checkpointId: z.string().min(1),
  }).strict(),
  refreshStatusSchema('skipped'),
  refreshStatusSchema('in_progress'),
  refreshStatusSchema('partial'),
  refreshStatusSchema('failed'),
]);

export type TransactionRefreshStatus = z.infer<typeof transactionRefreshStatusSchema>;
