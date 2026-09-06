// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';

const pence = z.number().int().safe();
const positivePence = pence.nonnegative();
const categoryId = z.string().trim().min(1).max(500).refine(value => !value.includes('/') && Array.from(value).every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127));
export const budgetFundingAllocationSchema = z.object({ categoryId, amountPence: positivePence }).strict();
export const budgetFundingOverridesSchema = z.object({
  allocations: z.array(budgetFundingAllocationSchema).max(400).refine(rows => new Set(rows.map(row => row.categoryId)).size === rows.length, 'Category IDs must be unique'),
}).strict();
const requestFields = {
  scope: z.enum(['personal', 'joint']),
  periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  mode: z.enum(['auto', 'manual', 'fund-ahead']),
  allocations: budgetFundingOverridesSchema.shape.allocations.optional(),
};
const validateMode = (value: { mode: string; allocations?: unknown[] | undefined }) => value.mode !== 'fund-ahead' || value.allocations === undefined;
export const budgetFundingPreviewRequestSchema = z.object(requestFields).strict().refine(validateMode, 'Fund-ahead does not accept allocations');
export const budgetFundingApplyRequestSchema = z.object({
  ...requestFields, expectedPreview: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().refine(validateMode, 'Fund-ahead does not accept allocations');
export const budgetFundingResponseSchema = z.object({
  scope: requestFields.scope,
  periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  mode: requestFields.mode,
  previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  applied: z.boolean(),
  canApply: z.boolean(),
  noOp: z.boolean(),
  preparationRequired: z.boolean(),
  allocations: z.array(z.object({
    categoryId, categoryName: z.string().min(1), targetPence: positivePence,
    assignedBeforePence: pence, assignedAfterPence: pence,
    suggestedPence: positivePence, amountPence: positivePence,
  }).strict()).max(400),
  totalAssignedPence: positivePence,
  shortfallPence: positivePence,
  toAssignBeforePence: pence,
  toAssignAfterPence: pence,
  reserveBeforePence: pence,
  reserveAfterPence: pence,
  reservedPence: positivePence,
}).strict();
export type BudgetFundingRequest = z.infer<typeof budgetFundingPreviewRequestSchema>;
export type BudgetFundingApplyRequest = z.infer<typeof budgetFundingApplyRequestSchema>;
export type BudgetFundingResponse = z.infer<typeof budgetFundingResponseSchema>;

export const budgetPeriodPreparationRequestSchema = z.object({
  scope: requestFields.scope, periodKey: requestFields.periodKey,
}).strict();
export const budgetPeriodPreparationResponseSchema = z.object({
  prepared: z.literal(true), carried: z.boolean(), periodKey: budgetFundingResponseSchema.shape.periodKey,
  decision: z.enum(['attempt_new_period', 'attempt_existing_period', 'skip_carryover_marker', 'skip_established_allocations']),
  currentPeriodExists: z.boolean(), hasToAssign: z.boolean(), hasReserve: z.boolean(),
  nonzeroCategoryCount: positivePence, categoryBalanceCount: positivePence,
}).strict();
