// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';

const id = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/);
const name = z.string().trim().min(1).max(120);
const amount = z.number().finite().nonnegative().max(1_000_000_000);
export const goalBudgetRefSchema = z
  .string()
  .regex(/^gb_[A-Za-z0-9_-]+$/)
  .max(1000);
const pence = z.number().int().nonnegative().max(100_000_000_000);
const lineItem = z.object({ id, name, amount: pence }).strict();
const category = z
  .object({
    name,
    icon: z.string().max(50).nullable().optional(),
    targetAmount: pence,
    lineItems: z.array(lineItem).max(100),
  })
  .strict()
  .refine(
    (value) => new Set(value.lineItems.map((item) => item.id)).size === value.lineItems.length,
    'Line items must have unique IDs',
  );

export const goalBudgetConfigurationSchema = z
  .object({
    scope: z.enum(['personal', 'joint']),
    categories: z
      .record(id, category)
      .refine(
        (value) =>
          Object.keys(value).length <= 100 &&
          !Object.keys(value).some((key) =>
            ['income', 'transfer', 'none', '__proto__', 'constructor', 'prototype'].includes(key),
          ),
        'Choose spending categories',
      ),
  })
  .strict();

export const goalBudgetSaveSchema = z
  .object({
    configuration: goalBudgetConfigurationSchema,
  })
  .strict();

export const goalBudgetSummarySchema = z
  .object({
    plannedPence: z.number().int(),
    spentPence: z.number().int(),
    remainingPence: z.number().int(),
    unallocatedPence: z.number().int(),
    categories: z.record(
      z.string(),
      z
        .object({
          spentPence: z.number().int(),
          remainingPence: z.number().int(),
          lineItems: z.record(z.string(), z.number().int()),
        })
        .strict(),
    ),
  })
  .strict();

export const goalBudgetSchema = z
  .object({
    budgetRef: goalBudgetRefSchema,
    goalId: z.string(),
    name: z.string(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    targetAmount: amount,
    targetMonthKey: z.string().nullable(),
    closed: z.boolean(),
    canEdit: z.boolean(),
    configuration: goalBudgetConfigurationSchema,
    summary: goalBudgetSummarySchema,
  })
  .strict();

export const goalBudgetsResponseSchema = z.object({ budgets: z.array(goalBudgetSchema) }).strict();
export type GoalBudgetConfiguration = z.infer<typeof goalBudgetConfigurationSchema>;
export type GoalBudget = z.infer<typeof goalBudgetSchema>;
