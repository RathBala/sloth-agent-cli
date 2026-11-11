// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';

export const agentAssignmentOperationIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const agentAssignmentOperationBaseShape = {
  operationId: agentAssignmentOperationIdSchema,
  status: z.enum(['pending', 'processing', 'completed']),
  itemCount: z.number().int().min(1).max(100),
  completedCount: z.number().int().min(0).max(100),
  failedCount: z.number().int().min(0).max(100),
  expiresAt: z.iso.datetime(),
  pollAfterMs: z.number().int().min(100).max(10_000),
};

export function validateAgentAssignmentOperationCounts(
  receipt: {
    status: 'pending' | 'processing' | 'completed';
    itemCount: number;
    completedCount: number;
    failedCount: number;
  },
  context: z.RefinementCtx,
): void {
  if (receipt.completedCount > receipt.itemCount) {
    context.addIssue({ code: 'custom', message: 'completedCount exceeds itemCount' });
  }
  if (receipt.failedCount > receipt.completedCount) {
    context.addIssue({ code: 'custom', message: 'failedCount exceeds completedCount' });
  }
  if (receipt.status === 'completed' && receipt.completedCount !== receipt.itemCount) {
    context.addIssue({ code: 'custom', message: 'Completed operations require all items' });
  }
}

export const agentAssignmentOperationParamsSchema = z.object({
  operationId: agentAssignmentOperationIdSchema,
}).strict();

export const agentAssignmentOperationReceiptSchema = z
  .object(agentAssignmentOperationBaseShape)
  .strict()
  .superRefine(validateAgentAssignmentOperationCounts);
