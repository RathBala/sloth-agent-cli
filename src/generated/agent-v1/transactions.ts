// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';
import { transactionRefreshStatusSchema } from './transactionRefresh.js';

const trimmedStringSchema = z.string().trim().min(1);
const parentCategoryIdDescription = 'Parent category ID for the budget assignment.';
const childLineItemIdDescription = 'Child line-item ID within categoryId. It is valid only for that parent category and the transaction scope; display names such as Other may repeat.';

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  });

export const agentAccountRefSchema = z.string()
  .regex(/^sloth_account_v1_[A-Za-z0-9_-]{43}$/);

export const agentCategorySplitSchema = z.object({
  categoryId: trimmedStringSchema.max(500).describe(parentCategoryIdDescription),
  amountPence: z.number().int().positive(),
  lineItemId: trimmedStringSchema.max(500).optional()
    .describe(childLineItemIdDescription),
}).strict();

export const agentTransactionRefreshStatusSchema = transactionRefreshStatusSchema;

const agentPendingTransactionSchema = z.object({
  pendingRef: z.string().regex(/^sloth_pending_v1_[A-Za-z0-9_-]{43}$/),
  name: z.string(),
  counterpartyName: trimmedStringSchema.max(512).optional(),
  transactionReference: trimmedStringSchema.max(1_024).optional(),
  amount: z.number().finite(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  date: dateSchema,
  status: z.literal('pending'),
  accountRef: agentAccountRefSchema,
  scope: z.enum(['personal', 'joint']),
  writable: z.literal(false),
  writeBlockReason: z.literal('pending'),
}).strict();

export const agentPendingSnapshotSchema = z.discriminatedUnion('availability', [
  z.object({
    availability: z.literal('current'),
    observedAt: z.iso.datetime(),
    transactions: z.array(agentPendingTransactionSchema).max(200),
    truncated: z.boolean(),
  }).strict(),
  z.object({
    availability: z.literal('unavailable'),
    observedAt: z.null(),
    transactions: z.array(agentPendingTransactionSchema).max(0),
    truncated: z.literal(false),
  }).strict(),
]);

export const agentTransactionsResponseSchema = z.object({
  transactions: z.array(z.object({
    transactionRef: trimmedStringSchema,
    id: trimmedStringSchema,
    name: z.string(),
    counterpartyName: trimmedStringSchema.optional(),
    transactionReference: trimmedStringSchema.optional(),
    amount: z.number().finite(),
    currency: trimmedStringSchema,
    date: dateSchema,
    status: z.literal('booked'),
    accountRef: agentAccountRefSchema,
    scope: z.enum(['personal', 'joint']),
    categoryId: z.string().nullable().describe(parentCategoryIdDescription),
    lineItemId: z.string().nullable().describe(childLineItemIdDescription),
    categorySplits: z.array(agentCategorySplitSchema),
    incomeSubtype: z.enum(['pay', 'interest']).nullable(),
    personalBudgetAmountPence: z.number().int().nonnegative(),
    jointBudgetContribution: z.object({
      eligible: z.boolean(),
      included: z.boolean(),
      amountPence: z.number().int().positive(),
      categoryId: z.string().nullable(),
      lineItemId: z.string().nullable(),
      categorySplits: z.array(agentCategorySplitSchema),
      incomeSubtype: z.enum(['pay', 'interest']).nullable(),
    }).nullable(),
    isShared: z.boolean().optional(),
    shareRatio: z.number().optional(),
    sharedAmount: z.number().optional(),
    partnerExclusiveAmount: z.number().optional(),
    userExclusiveAmount: z.number().optional(),
    partnerExplanation: z.string().optional(),
    partnerExplanationUpdatedAt: z.string().optional(),
    partnerExplanationRequestId: z.string().optional(),
    partnerExplanationRequestStatus: z.enum(['pending', 'answered', 'expired']).optional(),
    partnerExplanationRequestExpiresAt: z.string().optional(),
    partnerExplanationSource: z.string().optional(),
  }).strip()),
  nextCursor: z.string().nullable(),
  refresh: agentTransactionRefreshStatusSchema,
  pending: agentPendingSnapshotSchema.optional(),
});

export type AgentTransactionsResponse = z.infer<typeof agentTransactionsResponseSchema>;

// The producer strips internal booked fields; consumers reject any leaked fields.
// Both policies derive their allowed fields and types from the same schema.
export const agentTransactionsWireResponseSchema = agentTransactionsResponseSchema.extend({
  transactions: z.array(agentTransactionsResponseSchema.shape.transactions.element.strict()),
}).strict();

export type AgentPendingSnapshot = z.infer<typeof agentPendingSnapshotSchema>;
export type AgentTransactionRefreshStatus = z.infer<typeof agentTransactionRefreshStatusSchema>;
