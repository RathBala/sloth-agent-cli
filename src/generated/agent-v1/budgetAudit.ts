// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';

const scope = z.enum(['personal', 'joint']);
const periodKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const pence = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const timestamp = z.iso.datetime().nullable();
export const budgetAuditCursorSchema = z.string().regex(/^[A-Za-z0-9_-]+$/).max(1024);
export const budgetAuditQuerySchema = z.object({
  scope,
  // This filters recorded checkpoints only. Now always uses the current period.
  periodKey: periodKey.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: budgetAuditCursorSchema.optional(),
}).strict();

export const budgetAuditVerificationSchema = z.enum([
  'verified', 'not_configured', 'multiple_backing_accounts', 'missing_account',
  'disconnected_account', 'currency_mismatch', 'ineligible_account', 'stale_balance',
]);
export const budgetAuditSourceSchema = z.enum([
  'agent_auto', 'agent_portfolio', 'app_auto', 'balance_retry', 'transaction_retry',
  'dashboard_auto', 'dashboard_manual', 'transactions_auto', 'transactions_manual',
  'manage_accounts_background', 'savings_investments_auto', 'account_selection_completion',
  'unspecified', 'backing_accounts_save', 'manual_balance', 'unknown',
]);

const amounts = {
  budgetRemainingPence: pence.nullable(),
  accountBalancePence: pence.nullable(),
  // Signed: budget remaining minus account balance. Never infer a missing value.
  differencePence: pence.nullable(),
  verificationStatus: budgetAuditVerificationSchema,
};
function validAmounts(row: { budgetRemainingPence: number | null; accountBalancePence: number | null; differencePence: number | null; verificationStatus: string }): boolean {
  if (row.verificationStatus !== 'verified' && (row.accountBalancePence !== null || row.differencePence !== null)) return false;
  if (row.verificationStatus === 'verified' && row.accountBalancePence === null) return false;
  const difference = row.budgetRemainingPence === null || row.accountBalancePence === null
    ? null : row.budgetRemainingPence - row.accountBalancePence;
  return row.differencePence === difference;
}

export const budgetAuditCheckpointSchema = z.object({
  id: z.string().min(1).max(500),
  scope, periodKey, currency: z.string().regex(/^[A-Z]{3}$/),
  ...amounts,
  selectedAccountCount: z.number().int().nonnegative(),
  capturedAt: timestamp,
  sourceBalanceAt: timestamp,
  source: budgetAuditSourceSchema,
}).strict().refine(validAmounts, 'Inconsistent audit amounts');

export const budgetAuditResponseSchema = z.object({
  scope,
  asOf: z.iso.datetime(),
  current: z.object({
    periodKey, currency: z.string().regex(/^[A-Z]{3}$/),
    period: z.object({ startDate: z.iso.date(), endDate: z.iso.date(), dateRangeSource: z.enum(['stored', 'legacy_settings_fallback']) }).strict(),
    ...amounts,
    sourceCheckpointId: z.string().nullable(),
    sourcePeriodKey: periodKey.nullable(),
    sourceCapturedAt: timestamp,
    sourceBalanceAt: timestamp,
    source: budgetAuditSourceSchema.nullable(),
    freshnessBasis: z.literal('checkpoint_capture_time'),
    freshnessMaxAgeSeconds: z.literal(86400),
  }).strict().refine(validAmounts, 'Inconsistent current audit amounts'),
  checkpointPeriodKey: periodKey.nullable(),
  historyCoverage: z.literal('recorded_checkpoints_only'),
  checkpoints: z.array(budgetAuditCheckpointSchema).max(100),
  nextCursor: budgetAuditCursorSchema.nullable(),
}).strict().refine(row => row.checkpoints.every(checkpoint => checkpoint.scope === row.scope
  && (row.checkpointPeriodKey === null || checkpoint.periodKey === row.checkpointPeriodKey)), 'Checkpoint scope or period mismatch');

export type BudgetAuditQuery = z.infer<typeof budgetAuditQuerySchema>;
export type BudgetAuditResponse = z.infer<typeof budgetAuditResponseSchema>;
export type BudgetAuditCheckpoint = z.infer<typeof budgetAuditCheckpointSchema>;
