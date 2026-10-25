// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Enter a valid date.');
export const propertyWriteSchema = z.object({
  name: z.string().trim().min(1).max(80), currency: z.string().regex(/^[A-Z]{3}$/),
  valueMinor: money, valuationDate: date, annualGrowthPercent: z.number().gt(-100).max(100),
}).strict();
export const mortgagePartSchema = z.object({
  id, type: z.enum(['repayment', 'interest-only']), balanceMinor: money,
  annualRatePercent: z.number().min(0).max(100), monthlyPaymentMinor: money,
}).strict();
export const mortgageWriteSchema = z.object({
  propertyId: id, statementDate: date, type: z.enum(['repayment', 'interest-only', 'mixed']),
  parts: z.array(mortgagePartSchema).min(1).max(2),
  budgetPayment: z.object({ scope: z.enum(['personal', 'joint']), lineItemId: id }).strict().optional(),
}).strict().refine(value => value.type === 'mixed'
  ? value.parts.length === 2 && new Set(value.parts.map(part => part.type)).size === 2
  : value.parts.length === 1 && value.parts[0]?.type === value.type, 'Check the mortgage parts.')
  .refine(value => new Set(value.parts.map(part => part.id)).size === value.parts.length, 'Mortgage parts must have different identities.');
export const propertySchema = propertyWriteSchema.extend({ id });
export const mortgageSchema = mortgageWriteSchema.safeExtend({ id }).refine(value => value.id === value.propertyId, 'The mortgage identity must match its property.');
export const wealthResponseSchema = z.object({ properties: z.array(propertySchema), mortgages: z.array(mortgageSchema) }).strict()
  .refine(value => value.mortgages.every(mortgage => value.properties.some(property => property.id === mortgage.propertyId)), 'A linked property is missing.');
export const wealthIdSchema = id;
export const budgetPaymentChoicesSchema = z.object({ choices: z.array(z.object({
  scope: z.enum(['personal', 'joint']), lineItemId: id, label: z.string(), currency: z.string(),
})) });
export type BudgetPaymentChoice = z.infer<typeof budgetPaymentChoicesSchema>['choices'][number];
export type Property = z.infer<typeof propertySchema>;
export type Mortgage = z.infer<typeof mortgageSchema>;
export type PropertyWrite = z.infer<typeof propertyWriteSchema>;
export type MortgageWrite = z.infer<typeof mortgageWriteSchema>;
export type WealthSnapshot = z.infer<typeof wealthResponseSchema>;
