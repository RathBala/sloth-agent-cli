import fs from 'node:fs';
import { z } from 'zod-v4';
import { UsageError } from './errors.js';
import { budgetPaymentChoicesSchema, wealthIdSchema } from './generated/agent-v1/wealth.js';
import { wealthDocumentLimits, wealthDocumentResponseSchema } from './generated/agent-v1/wealthDocument.js';
import {
  wealthReadResponseSchema, wealthForecastResponseSchema, wealthReviewRequestSchema,
  wealthReviewSubmissionSchema, wealthReviewResponseSchema, wealthMutationResponseSchema,
  wealthDocumentPreviewSchema, propertySaveSchema, mortgageSaveSchema, wealthRemoveSchema,
} from './generated/agent-v1/agentWealth.js';

export type WealthHelpTopic = 'wealth' | 'wealth-read' | 'wealth-forecast' | 'wealth-budget-payments'
  | 'wealth-properties' | 'wealth-properties-save' | 'wealth-properties-remove'
  | 'wealth-mortgages' | 'wealth-mortgages-save' | 'wealth-mortgages-remove'
  | 'wealth-documents' | 'wealth-documents-extract' | 'wealth-documents-review' | 'wealth-documents-save';
export interface WealthCommand { route: string; apply: boolean; input?: string; file?: string; months?: number }
const operations = ['read', 'forecast', 'budget-payments', 'properties save', 'properties remove', 'mortgages save', 'mortgages remove', 'documents extract', 'documents review', 'documents save'];
export function parseWealthArgs(args: string[]): WealthCommand {
  const words = [...args];
  const first = words[0]?.startsWith('--') ? 'read' : words.shift() ?? 'read';
  const route = ['documents', 'properties', 'mortgages'].includes(first) ? `${first} ${words.shift() ?? ''}` : first;
  if (!operations.includes(route)) throw new UsageError('Choose a wealth command. Run sloth-agent wealth --help.');
  let apply = false;
  const values = new Map<string, string>();
  while (words.length) {
    const key = words.shift()!;
    if (key === '--apply') { if (apply) throw new UsageError('--apply was supplied twice'); apply = true; continue; }
    if (!['--input', '--file', '--months'].includes(key) || values.has(key)) throw new UsageError(`Unsupported or repeated wealth option: ${key}`);
    const value = words.shift();
    if (!value || value.startsWith('--')) throw new UsageError(`${key} requires a value`);
    values.set(key, value);
  }
  const allowed = route === 'forecast' ? '--months' : route === 'documents extract' ? '--file' : route.endsWith('save') || route.endsWith('remove') || route.endsWith('review') ? '--input' : null;
  if ([...values.keys()].some(key => key !== allowed)) throw new UsageError(`wealth ${route} accepts only ${allowed ?? 'global options'}`);
  if (apply && !route.endsWith('save') && !route.endsWith('remove') && route !== 'documents extract') throw new UsageError(`wealth ${route} does not accept --apply`);
  if (allowed === '--input' && !values.has('--input')) throw new UsageError(`wealth ${route} requires --input FILE`);
  if (allowed === '--file' && !values.has('--file')) throw new UsageError('wealth documents extract requires --file FILE');
  const months = values.get('--months') ?? '13';
  if (route === 'forecast' && (!/^\d+$/.test(months) || Number(months) < 1 || Number(months) > 1200)) throw new UsageError('--months must be a whole number from 1 to 1200');
  return { route, apply, ...(values.has('--input') ? { input: values.get('--input')! } : {}), ...(values.has('--file') ? { file: values.get('--file')! } : {}), ...(route === 'forecast' ? { months: Number(months) } : {}) };
}
export function wealthHelpTopic(args: string[]): WealthHelpTopic {
  const words = args.filter(word => !word.startsWith('-')).slice(0, 2);
  const topic = `wealth${words.length ? '-' + words.join('-') : ''}`;
  const valid = ['wealth', ...operations.map(operation => 'wealth-' + operation.replaceAll(' ', '-')), 'wealth-properties', 'wealth-mortgages', 'wealth-documents'];
  return (valid.includes(topic) ? topic : 'wealth') as WealthHelpTopic;
}
export function wealthHelpText(topic: string): string {
  const route = topic.replace(/^wealth-?/, '').replaceAll('-', ' ').replace('budget payments', 'budget-payments');
  const index = !route || ['properties', 'mortgages', 'documents'].includes(route);
  const commands = operations.filter(operation => !route || operation.startsWith(route));
  const usage = route === 'forecast' ? 'wealth forecast [--months 1..1200]' : route === 'documents extract' ? 'wealth documents extract --file FILE [--apply]' : ['read', 'budget-payments'].includes(route) ? `wealth ${route}` : `wealth ${route} --input FILE${route === 'documents review' ? '' : ' [--apply]'}`;
  return [
    `Sloth Agent CLI - ${topic.replaceAll('-', ' ').replace('budget payments', 'budget-payments')}`, '',
    ...(index ? ['Commands:', ...commands.map(command => `  sloth-agent wealth ${command}`), 'Run a command with --help for its inputs and behavior.'] : ['Usage:', `  sloth-agent ${usage} [--base-url URL]`, '',
      route === 'budget-payments' ? 'Reads personal and available joint budget payments that can be linked to a mortgage. Returns choices with scope, lineItemId, currency and label. No input or --apply is accepted; nothing is saved.' :
      route === 'forecast' ? 'Optional --months defaults to 13; range 1–1200. Reads saved active scenarios, assumptions and balance overrides. No inputs are saved or activated.' :
      route === 'documents extract' ? 'Required --file: PDF, JPEG, PNG or WebP up to 8 MiB. Without --apply, validates locally without credentials or upload. With --apply, requires agent:write and sends the file for extraction. No financial records or original files are saved.' :
      route === 'documents review' ? 'Required --input JSON: {propertyId,draft} for an existing property, or {newProperty:true,currency,draft} for a new one. Use draft from documents extract. Returns an editable proposal, original records, warnings, actual changes and missing fields. Saves nothing.' :
      route === 'documents save' ? 'Required --input JSON: the editable response from documents review. Edit proposal only; retain propertyId, expected and warnings. Without --apply, contacts Sloth for validation and a current-state preview. With --apply, saves the approved property and mortgage together. Incomplete fields or stale original records prevent saving.' :
      route.endsWith('remove') ? 'Required --input JSON: {propertyId,expected:{property,mortgage},includeMortgage:false}. Copy complete original records from wealth read. Set includeMortgage:true to remove a property with its mortgage. Without --apply, previews the consequence remotely. With --apply, removes the record. No sale or cash proceeds are recorded.' :
      route.endsWith('save') ? `Required --input JSON: {propertyId,${route.startsWith('properties') ? 'property' : 'mortgage'},expected:{property,mortgage}}. Omit id from the record being saved; copy complete original records into expected, using null when absent. Without --apply, validates against saved state remotely. With --apply, saves. Reuse a stable propertyId for retries.` :
      'Reads your private property and mortgage records. Totals use your budget currency; other currencies remain listed but are excluded from totals.',
    ]), '',
    'Access and output:',
    '  Reads, forecasts and previews require agent:read. Extraction and writes require agent:write (Allow changes).',
    '  JSON on stdout; errors on stderr. Money fields ending in Minor are integer minor currency units (GBP pence).',
    '  Dates use YYYY-MM-DD and cannot be future dates. Rates and growth are annual percentages.',
    '  Properties are private and wholly owned. Equity is not available for Goal funding.',
    '  A conflict requires a fresh read and review. Retry a lost response with the same IDs and original records.',
    '  No interactive prompts or hidden draft files. Explicit JSON files contain financial data.',
    '  --base-url overrides SLOTH_AGENT_API_BASE_URL; default https://budget.slothmoney.app.',
    '  -h, --help shows this help. HTTPS is required except for localhost development.', '',
    'Examples:', ...(index ? commands.map(command => `  sloth-agent wealth ${command} --help`) : [
      `  sloth-agent ${route === 'forecast' ? 'wealth forecast --months 24' : route === 'documents extract' ? 'wealth documents extract --file mortgage.pdf --apply' : ['read', 'budget-payments'].includes(route) ? `wealth ${route}` : `wealth ${route} --input ${route === 'documents save' ? 'review' : 'input'}.json`}`,
    ]),
  ].join('\n');
}
interface Descriptor { path: string; method: string; schema: z.ZodType; body?: string | Buffer; contentType?: string; localResult?: unknown }
function jsonFile(file: string): unknown {
  try { if (fs.statSync(file).size > 1024 * 1024) throw new Error(); return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new UsageError('Could not read --input as a JSON file up to 1 MiB'); }
}
function checked<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new UsageError(`Invalid wealth input fields: ${[...new Set(result.error.issues.map(issue => issue.path.join('.') || 'input'))].join(', ')}. Run this command with --help.`);
  return result.data;
}
export function wealthRequest(command: WealthCommand): Descriptor {
  const { route, apply } = command;
  if (route === 'read') return { path: '/wealth', method: 'GET', schema: wealthReadResponseSchema };
  if (route === 'forecast') return { path: `/wealth/forecast?months=${command.months}`, method: 'GET', schema: wealthForecastResponseSchema };
  if (route === 'budget-payments') return { path: '/wealth/budget-payments', method: 'GET', schema: budgetPaymentChoicesSchema };
  if (route === 'documents extract') {
    let bytes: Buffer;
    try { if (fs.statSync(command.file!).size > wealthDocumentLimits.maxBytes) throw new Error(); bytes = fs.readFileSync(command.file!); }
    catch { throw new UsageError('Could not read --file as a document up to 8 MiB'); }
    const mimeType = bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf' : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : undefined;
    if (!mimeType) throw new UsageError('Choose a PDF, JPEG, PNG or WebP document');
    return { path: '/wealth/document/extract', method: 'POST', schema: wealthDocumentResponseSchema, contentType: mimeType, body: bytes,
      ...(!apply ? { localResult: { validated: true, uploaded: false, mimeType, sizeBytes: bytes.length } } : {}) };
  }
  const value = jsonFile(command.input!);
  if (route === 'documents review') return { path: '/wealth/document/review', method: 'POST', schema: wealthReviewResponseSchema, body: JSON.stringify(checked(wealthReviewRequestSchema, value)) };
  if (route === 'documents save') return { path: `/wealth/document${apply ? '' : '/preview'}`, method: apply ? 'PUT' : 'POST', schema: apply ? wealthMutationResponseSchema : wealthDocumentPreviewSchema, body: JSON.stringify(checked(wealthReviewSubmissionSchema, value)) };
  const kind = route.startsWith('properties') ? 'properties' : 'mortgages';
  const schema = route.endsWith('remove') ? wealthRemoveSchema : kind === 'properties' ? propertySaveSchema : mortgageSaveSchema;
  const input = checked(z.object({ propertyId: wealthIdSchema, ...schema.shape }).strict(), value);
  const { propertyId, ...payload } = input;
  return { path: `/wealth/${kind}/${encodeURIComponent(propertyId)}${apply ? '' : route.endsWith('remove') ? '/remove/preview' : '/preview'}`, method: apply ? route.endsWith('remove') ? 'DELETE' : 'PUT' : 'POST', schema: wealthMutationResponseSchema, body: JSON.stringify(payload) };
}
