// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';
import { agentAccountRefSchema } from './transactions.js';
const trimmedStringSchema = z.string().trim().min(1);
export const agentGoalAmountSchema = z.number()
  .finite()
  .positive()
  .max(Number.MAX_SAFE_INTEGER / 100)
  .multipleOf(0.01);

export const goalAccountAllocationSchema = z.object({
  accountRef: agentAccountRefSchema,
  amount: z.number().finite().nonnegative().multipleOf(0.01),
}).strict();
export const goalFundingConfigurationSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('automatic'), accountRefs: z.array(agentAccountRefSchema).min(1) }).strict(),
  z.object({ mode: z.literal('explicit'), allocations: z.array(goalAccountAllocationSchema.extend({ amount: agentGoalAmountSchema })).min(1) }).strict(),
]).refine(value => {
  const refs = value.mode === 'automatic' ? value.accountRefs : value.allocations.map(share => share.accountRef);
  return new Set(refs).size === refs.length;
}, { message: 'Choose each funding account once' });
export type GoalFundingConfiguration = z.infer<typeof goalFundingConfigurationSchema>;
export function fundingMatchesTarget(funding: GoalFundingConfiguration, targetAmount: number): boolean {
  return funding.mode === 'automatic' || funding.allocations.reduce((sum, share) => sum + Math.round(share.amount * 100), 0) === Math.round(targetAmount * 100);
}

export const agentGoalMonthKeySchema = z.string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const agentGoalCreateRequestSchema = z.object({
  name: trimmedStringSchema.max(200),
  targetAmount: agentGoalAmountSchema,
  targetMonthKey: agentGoalMonthKeySchema.optional(),
  goalType: z.enum(['keep', 'spend']),
  funding: goalFundingConfigurationSchema,
  priority: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict().refine(value => fundingMatchesTarget(value.funding, value.targetAmount), { message: 'Account shares must total the Goal target', path: ['funding'] });


export const agentGoalUpdateRequestSchema = z.object({
  name: trimmedStringSchema.max(200).optional(),
  targetAmount: agentGoalAmountSchema.optional(),
  targetMonthKey: agentGoalMonthKeySchema.nullable().optional(),
  goalType: z.enum(['keep', 'spend']).optional(),
  isSpent: z.boolean().optional(),
  funding: goalFundingConfigurationSchema.optional(),
  priority: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one goal update is required' },
);


export const agentForecastBasisSchema = z.object({
  calculatedAt: z.iso.datetime(),
  activeScenarioRevision: z.number().int().nonnegative(),
  projectionThroughMonthKey: agentGoalMonthKeySchema,
}).strict();

const plannedGoalFields = {
  name: trimmedStringSchema,
  targetAmount: z.number().finite().positive(),
  targetMonthKey: agentGoalMonthKeySchema.nullable(),
  forecastMonthKey: agentGoalMonthKeySchema.nullable(),
  goalType: z.enum(['keep', 'spend']),
  effectivePriority: z.number().int().positive(),
  funding: goalFundingConfigurationSchema,
  fundingAccounts: z.array(z.object({ accountRef: agentAccountRefSchema, label: trimmedStringSchema.nullable() }).strict()).min(1),
  hasMissingAccounts: z.boolean(),
  savedAmount: z.number().finite().nonnegative(),
  progressPercent: z.number().finite().min(0).max(100),
  allocations: z.array(goalAccountAllocationSchema),
  forecastAllocations: z.array(goalAccountAllocationSchema).nullable(),
} as const;

export const agentGoalSchema = z.object({
  id: trimmedStringSchema.max(500),
  ...plannedGoalFields,
  spentAt: z.iso.datetime().nullable(),
  sharedWithPartner: z.boolean(),
}).strict();

export const agentGoalPreviewSchema = z.object(plannedGoalFields).strict();

export const agentGoalsResponseSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  forecastBasis: agentForecastBasisSchema,
  goals: z.array(agentGoalSchema),
}).strict();

export const agentGoalPreviewResponseSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  forecastBasis: agentForecastBasisSchema,
  goal: agentGoalPreviewSchema,
}).strict();


export const agentGoalMutationResponseSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  forecastBasis: agentForecastBasisSchema,
  goal: agentGoalSchema,
}).strict();


export type AgentGoal = z.infer<typeof agentGoalSchema>;
