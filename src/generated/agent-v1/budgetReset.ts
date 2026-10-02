// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';

const pence = z.number().int().safe();
const periodKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const fields = {
  scope: z.enum(['personal', 'joint']),
  target: z.enum(['to-assign', 'assigned']),
  periodKey: periodKey.optional(),
};
export const budgetResetPreviewRequestSchema = z.object(fields).strict();
export const budgetResetApplyRequestSchema = z.object({
  ...fields, expectedPreview: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const budgetResetResponseSchema = z.object({
  scope: fields.scope, target: fields.target, periodKey,
  currency: z.string().regex(/^[A-Z]{3}$/),
  previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  applied: z.boolean(), noOp: z.boolean(),
  toAssignBeforePence: pence, toAssignAfterPence: pence,
  categories: z.array(z.object({
    categoryId: z.string().min(1), categoryName: z.string().min(1),
    assignedBeforePence: pence, assignedAfterPence: pence,
  }).strict()).max(400),
}).strict();
export type BudgetResetRequest = z.infer<typeof budgetResetPreviewRequestSchema>;
export type BudgetResetApplyRequest = z.infer<typeof budgetResetApplyRequestSchema>;
export type BudgetResetResponse = z.infer<typeof budgetResetResponseSchema>;
