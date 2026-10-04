// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';

const periodKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const budgetHistoryCursorSchema = z.string().uuid();
export const budgetHistoryQuerySchema = z.object({
  scope: z.enum(['personal', 'joint']),
  periodKey: periodKey.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: budgetHistoryCursorSchema.optional(),
}).strict();

export const budgetHistorySourceSchema = z.enum(['ui', 'agent', 'system', 'unknown']);
const value = z.union([z.string(), z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER), z.array(z.string()), z.null()]);
export const budgetHistoryChangeSchema = z.object({
  path: z.array(z.string().min(1)).min(1).max(6),
  before: value,
  after: value,
}).strict();

export const budgetHistoryEntrySchema = z.object({
  saveId: budgetHistoryCursorSchema,
  savedAt: z.iso.datetime(),
  requestedPeriodKey: periodKey,
  source: budgetHistorySourceSchema,
  entryPoint: z.enum(['set_budget', 'budget_health', 'line_item_create', 'line_item_rename']).nullable(),
  actor: z.enum(['self', 'other', 'unknown']),
  currentSnapshotUpdated: z.boolean(),
  changes: z.array(budgetHistoryChangeSchema),
}).strict();

export const budgetHistoryResponseSchema = z.object({
  scope: z.enum(['personal', 'joint']),
  periodKey,
  period: z.object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    dateRangeSource: z.enum(['stored', 'settings']),
    provisional: z.boolean(),
  }).strict(),
  metadata: z.object({
    targetSource: z.enum(['snapshot', 'plan', 'unavailable']),
    effectiveFromPeriodKey: periodKey.nullable(),
    createdAt: z.iso.datetime().nullable(),
    capturedAt: z.iso.datetime().nullable(),
    updatedAt: z.iso.datetime().nullable(),
    updatedBy: z.enum(['self', 'other', 'unknown']),
  }).strict(),
  historyCoverage: z.literal('recorded_saves_only'),
  entries: z.array(budgetHistoryEntrySchema).max(100),
  nextCursor: budgetHistoryCursorSchema.nullable(),
}).strict();

export type BudgetHistoryQuery = z.infer<typeof budgetHistoryQuerySchema>;
export type BudgetHistoryResponse = z.infer<typeof budgetHistoryResponseSchema>;
export type BudgetHistoryChange = z.infer<typeof budgetHistoryChangeSchema>;
export type BudgetHistorySource = z.infer<typeof budgetHistorySourceSchema>;
export type BudgetHistoryEntryPoint = z.infer<typeof budgetHistoryEntrySchema>['entryPoint'];
