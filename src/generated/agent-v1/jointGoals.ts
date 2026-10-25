// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';
import { agentGoalAmountSchema, agentGoalMonthKeySchema, agentGoalSchema, goalFundingConfigurationSchema } from './goals.js';

export const shareBasisPointsSchema = z.number().int().min(0).max(10_000);
export const jointGoalConvertSchema = z.object({
  totalAmount: agentGoalAmountSchema,
  viewerShareBasisPoints: shareBasisPointsSchema,
}).strict();
export const jointGoalCreateSchema = jointGoalConvertSchema.extend({
  name: z.string().trim().min(1).max(200),
  goalType: z.enum(['keep', 'spend']),
  targetMonthKey: agentGoalMonthKeySchema.nullable().optional(),
  funding: goalFundingConfigurationSchema.optional(),
  priority: z.number().int().positive().optional(),
});
export const jointGoalUpdateSchema = z.object({
  expectedRevision: z.number().int().positive(),
  totalAmount: agentGoalAmountSchema.optional(),
  viewerShareBasisPoints: shareBasisPointsSchema.optional(),
  name: z.string().trim().min(1).max(200).optional(),
  goalType: z.enum(['keep', 'spend']).optional(),
  targetMonthKey: agentGoalMonthKeySchema.nullable().optional(),
  isSpent: z.boolean().optional(),
  funding: goalFundingConfigurationSchema.optional(),
}).strict();
export const jointGoalDeleteSchema = z.object({ expectedRevision: z.number().int().positive() }).strict();
export const jointGoalProgressSchema = z.object({
  shareBasisPoints: shareBasisPointsSchema,
  targetAmount: z.number().finite().nonnegative(),
  savedAmount: z.number().finite().nonnegative(),
  progressPercent: z.number().finite().min(0).max(100),
  forecastMonthKey: agentGoalMonthKeySchema.nullable(),
  fundingStatus: z.enum(['configured', 'unconfigured', 'incomplete']),
}).strict();
export const jointGoalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  totalAmount: agentGoalAmountSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  goalType: z.enum(['keep', 'spend']),
  targetMonthKey: agentGoalMonthKeySchema.nullable(),
  spentAt: z.string().nullable(),
  revision: z.number().int().positive(),
  viewer: agentGoalSchema.extend({ shareBasisPoints: shareBasisPointsSchema, fundingStatus: jointGoalProgressSchema.shape.fundingStatus }),
  partner: jointGoalProgressSchema,
}).strict();
export const jointGoalsResponseSchema = z.object({
  defaultViewerShareBasisPoints: shareBasisPointsSchema.nullable(),
  goals: z.array(jointGoalSchema),
}).strict();
export const jointGoalMutationResponseSchema = z.object({ goal: jointGoalSchema }).strict();
export type JointGoal = z.infer<typeof jointGoalSchema>;
export type JointGoalConvert = z.infer<typeof jointGoalConvertSchema>;
export type JointGoalCreate = z.infer<typeof jointGoalCreateSchema>;
export type JointGoalUpdate = z.infer<typeof jointGoalUpdateSchema>;
