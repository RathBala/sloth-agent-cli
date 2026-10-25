// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';
import { agentAccountRefSchema } from './transactions.js';
import { agentForecastBasisSchema, agentGoalMonthKeySchema, agentGoalSchema } from './goals.js';

const unique = (values: string[]) => new Set(values).size === values.length;
export const contributionRoutingSchema = z.object({
  goalIds: z.array(z.string().min(1).max(500)).max(500).refine(unique, 'Select each goal once'),
  sourceAccountRefs: z.array(agentAccountRefSchema).min(1).max(100).refine(unique, 'Select each recurring source once'),
}).strict();
export const contributionRoutingWriteSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  routing: contributionRoutingSchema.nullable(),
}).strict();
export const goalFundingMonthSchema = z.object({
  monthKey: agentGoalMonthKeySchema,
  routingIncomplete: z.boolean(),
  accounts: z.record(agentAccountRefSchema, z.object({
    balanceAmount: z.number().finite().nullable(),
    contributionAmount: z.number().finite().nonnegative(),
    spentAmount: z.number().finite().nonnegative(),
    reservedAmount: z.number().finite().nonnegative(),
  }).strict()),
}).strict();
export const contributionRoutingResponseSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  routing: contributionRoutingSchema.nullable(),
  forecastBasis: agentForecastBasisSchema,
  goals: z.array(agentGoalSchema),
  months: z.array(goalFundingMonthSchema),
}).strict();
export type ContributionRoutingWrite = z.infer<typeof contributionRoutingWriteSchema>;
export type ContributionRoutingResponse = z.infer<typeof contributionRoutingResponseSchema>;
