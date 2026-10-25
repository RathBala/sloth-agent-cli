// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.
import { z } from 'zod-v4';
import {
  mortgageSchema,
  mortgageWriteSchema,
  propertySchema,
  propertyWriteSchema,
  wealthIdSchema,
} from './wealth.js';

export const wealthDocumentLimits = {
  maxBytes: 8 * 1024 * 1024,
  mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
} as const;

export const wealthDocumentDraftSchema = z.object({
  currency: propertyWriteSchema.shape.currency.nullable(),
  property: z.object({
    name: propertyWriteSchema.shape.name.nullable(),
    valueMinor: propertyWriteSchema.shape.valueMinor.nullable(),
    valuationDate: propertyWriteSchema.shape.valuationDate.nullable(),
  }).strict(),
  mortgage: z.object({
    statementDate: mortgageWriteSchema.shape.statementDate.nullable(),
    type: mortgageWriteSchema.shape.type.nullable(),
    parts: z.array(z.object({
      type: z.enum(['repayment', 'interest-only']),
      balanceMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
      annualRatePercent: z.number().min(0).max(100).nullable(),
      monthlyPaymentMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
    }).strict()).max(2),
  }).strict(),
  warnings: z.array(z.enum(['future_terms', 'proposed_terms', 'unclear_fields', 'multiple_properties', 'no_supported_details', 'valuation_date_from_document'])).max(6),
}).strict();

export const wealthDocumentResponseSchema = z.object({ draft: wealthDocumentDraftSchema }).strict();
export const wealthDocumentSaveSchema = z.object({
  propertyId: wealthIdSchema,
  property: propertyWriteSchema,
  mortgage: mortgageWriteSchema.nullable(),
  expected: z.object({ property: propertySchema.nullable(), mortgage: mortgageSchema.nullable() }).strict(),
}).strict().refine(value => (!value.mortgage || value.mortgage.propertyId === value.propertyId)
  && (!value.expected.property || value.expected.property.id === value.propertyId)
  && (!value.expected.mortgage || value.expected.mortgage.propertyId === value.propertyId), 'Choose the linked property.');

export type WealthDocumentDraft = z.infer<typeof wealthDocumentDraftSchema>;
export type WealthDocumentSave = z.infer<typeof wealthDocumentSaveSchema>;
