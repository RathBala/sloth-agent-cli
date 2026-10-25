// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';
import {
  propertySchema,
  mortgageSchema,
  wealthIdSchema,
  mortgagePartSchema,
} from './wealth.js';
import { wealthDocumentDraftSchema } from './wealthDocument.js';

export const wealthExpectedSchema = z
  .object({
    property: propertySchema.nullable(),
    mortgage: mortgageSchema.nullable(),
  })
  .strict();
export const wealthReviewRequestSchema = z
  .object({
    propertyId: wealthIdSchema.optional(),
    newProperty: z.literal(true).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    draft: wealthDocumentDraftSchema,
  })
  .strict()
  .refine(
    (value) => !!value.propertyId !== !!value.newProperty,
    'Choose an existing property or explicitly create a new property.',
  );
export const wealthProposalSchema = z
  .object({
    property: propertySchema.extend({
      name: propertySchema.shape.name.nullable(),
      valueMinor: propertySchema.shape.valueMinor.nullable(),
      valuationDate: propertySchema.shape.valuationDate.nullable(),
    }),
    mortgage: z
      .object({
        id: wealthIdSchema,
        propertyId: wealthIdSchema,
        type: z.enum(['repayment', 'interest-only', 'mixed']).nullable(),
        statementDate: z.string().nullable(),
        parts: z
          .array(
            mortgagePartSchema.extend({
              balanceMinor: mortgagePartSchema.shape.balanceMinor.nullable(),
              annualRatePercent:
                mortgagePartSchema.shape.annualRatePercent.nullable(),
              monthlyPaymentMinor:
                mortgagePartSchema.shape.monthlyPaymentMinor.nullable(),
            }),
          )
          .max(2),
        budgetPayment: z
          .object({
            scope: z.enum(['personal', 'joint']),
            lineItemId: wealthIdSchema,
          })
          .strict()
          .optional(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const wealthReviewInputSchema = z
  .object({
    propertyId: wealthIdSchema,
    expected: wealthExpectedSchema,
    proposal: wealthProposalSchema,
    warnings: wealthDocumentDraftSchema.shape.warnings,
  })
  .strict()
  .refine(
    (value) =>
      value.propertyId === value.proposal.property.id &&
      (!value.proposal.mortgage ||
        (value.proposal.mortgage.id === value.propertyId &&
          value.proposal.mortgage.propertyId === value.propertyId)) &&
      (!value.expected.property ||
        value.expected.property.id === value.propertyId) &&
      (!value.expected.mortgage ||
        value.expected.mortgage.id === value.propertyId),
    'Choose the linked property.',
  );
export const wealthChangeSchema = z
  .object({ path: z.string(), before: z.json(), after: z.json() })
  .strict();
export const wealthReviewResponseSchema = wealthReviewInputSchema.safeExtend({
  canApply: z.boolean(),
  missingFields: z.array(z.string()),
  changes: z.array(wealthChangeSchema),
});
export const wealthForecastQuerySchema = z
  .object({ months: z.coerce.number().int().min(1).max(1200).default(13) })
  .strict();
export const wealthRemoveSchema = z
  .object({
    expected: wealthExpectedSchema,
    includeMortgage: z.boolean().default(false),
  })
  .strict();
export const propertySaveSchema = z
  .object({
    property: propertySchema.omit({ id: true }),
    expected: wealthExpectedSchema,
  })
  .strict();
export const mortgageSaveSchema = z
  .object({
    mortgage: mortgageSchema.omit({ id: true }),
    expected: wealthExpectedSchema,
  })
  .strict();
export type WealthReviewInput = z.infer<typeof wealthReviewInputSchema>;
export type WealthReviewResponse = z.infer<typeof wealthReviewResponseSchema>;
export type WealthExpected = z.infer<typeof wealthExpectedSchema>;

export const wealthReviewSubmissionSchema = wealthReviewInputSchema.safeExtend({
  canApply: z.boolean().optional(),
  missingFields: z.array(z.string()).optional(),
  changes: z.array(wealthChangeSchema).optional(),
  noOp: z.boolean().optional(),
});
const signedMinor = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
export const wealthSummarySchema = z
  .object({
    savingsMinor: signedMinor,
    investmentsMinor: signedMinor,
    propertyMinor: signedMinor,
    mortgageMinor: signedMinor,
    equityMinor: signedMinor,
    assetsMinor: signedMinor,
    trackedNetWorthMinor: signedMinor,
  })
  .strict();
export const wealthReadResponseSchema = z
  .object({
    asOf: z.iso.datetime(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    properties: z.array(propertySchema),
    mortgages: z.array(mortgageSchema),
    summary: wealthSummarySchema,
    excludedCurrencyAccountCount: z.number().int().nonnegative(),
    excludedCurrencyHoldingCount: z.number().int().nonnegative(),
    excludedCurrencyPropertyCount: z.number().int().nonnegative(),
    unavailableReasons: z.array(
      z.enum([
        'account_balance_unavailable',
        'holding_value_unavailable',
        'calculation_unavailable',
      ]),
    ),
    balanceAsOf: z.array(
      z
        .object({ accountRef: z.string(), asOf: z.iso.datetime().nullable() })
        .strict(),
    ),
  })
  .strict();
export const wealthForecastRowSchema = z
  .object({
    monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    savingsDepositMinor: signedMinor,
    investmentsDepositMinor: signedMinor,
    goalSpendingMinor: signedMinor,
    savingsMinor: signedMinor,
    investmentsMinor: signedMinor,
    liquidTotalMinor: signedMinor,
    interestEarnedMinor: signedMinor,
    unrealisedGainsMinor: signedMinor,
    propertyMinor: signedMinor,
    mortgageMinor: signedMinor,
    equityMinor: signedMinor,
    manualHoldingCostMinor: signedMinor,
    trackedNetWorthMinor: signedMinor,
    savingsOverridden: z.boolean(),
    investmentsOverridden: z.boolean(),
    commentary: z.string(),
  })
  .strict();
export const wealthForecastResponseSchema = z
  .object({
    asOf: z.iso.datetime(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    forecastBasis: z
      .object({
        calculatedAt: z.iso.datetime(),
        activeScenarioRevision: z.number().int().nonnegative(),
        projectionThroughMonthKey: z.string(),
      })
      .strict(),
    assumptions: z
      .object({
        interestAnnualPercent: z.number().finite(),
        investmentAnnualPercent: z.number().finite(),
      })
      .strict(),
    rows: z.array(wealthForecastRowSchema).max(1200),
    unavailableReasons: z.array(z.string()),
    excludedCurrencyAccountCount: z.number().int().nonnegative(),
    excludedCurrencyHoldingCount: z.number().int().nonnegative(),
    excludedCurrencyPropertyCount: z.number().int().nonnegative(),
    balanceAsOf: wealthReadResponseSchema.shape.balanceAsOf,
  })
  .strict();
export const wealthMutationResponseSchema = z
  .object({
    applied: z.boolean(),
    noOp: z.boolean(),
    expected: wealthExpectedSchema,
    result: wealthExpectedSchema,
  })
  .strict();
export const wealthDocumentPreviewSchema =
  wealthReviewResponseSchema.safeExtend({ noOp: z.boolean() });
