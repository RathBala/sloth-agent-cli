import { createHash } from 'node:crypto';
import fs from 'node:fs';
import nodePath from 'node:path';

import {
  type CliEnvironment,
  type HelpTopic,
  type ParsedCommand,
  parseArgs,
  resolveBaseUrl,
} from './args.js';
import { ICON_KEYS } from './category-metadata.js';
import {
  type AssignmentPayload,
  type AssignmentOperationResponse,
  parseApiResponse,
  parseAssignmentOperationResponse,
  toLegacyAssignmentResponse,
  validateAssignmentPayload,
  validateBudgetMovementResponse,
  validateBudgetUpdatePayload,
  validateNotificationRulePayload,
  validateReceiptConfirmation,
} from './contracts.js';
import {
  type CredentialStoreFactory,
  createSystemCredentialStore,
  secureStorageUnavailableError,
} from './credential-store.js';
import {
  ApiError,
  CliError,
  ConfigError,
  UsageError,
} from './errors.js';

export const CLI_VERSION = '0.22.1';
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_CONTRACT_PDF_BYTES = 6_000_000;
const API_ORIGIN_HELP_LINES = [
  '',
  'API origin:',
  '  --base-url overrides SLOTH_AGENT_API_BASE_URL; if neither is set, the',
  '  origin defaults to https://budget.slothmoney.app.',
  '  Use an origin-only URL with no credentials, path, query, or fragment.',
  '  HTTPS is required except for localhost development.',
] as const;

interface CliOptions {
  env?: CliEnvironment;
  fetch?: typeof globalThis.fetch;
  getCredentialStore?: CredentialStoreFactory;
  isInteractive?: boolean;
  readSecret?: () => Promise<string>;
  readStdin?: () => Promise<string>;
  sleep?: (milliseconds: number) => Promise<void>;
  writeStdout?: (value: string) => void;
  writeStderr?: (value: string) => void;
}

const ASSIGNMENT_REQUEST_ATTEMPTS = 3;
const ASSIGNMENT_RETRY_DELAY_MS = 500;

export function usageText(): string {
  return [
    'Sloth Agent CLI',
    '',
    'Usage:',
    '  sloth-agent <command> [options]',
    '',
    'Commands:',
    '  sloth-agent auth login [--token-stdin | --from-env] [--base-url URL]',
    '  sloth-agent auth status [--base-url URL]',
    '  sloth-agent auth logout [--base-url URL]',
    '  sloth-agent accounts [list] [--base-url URL]',
    '  sloth-agent accounts update --account-ref REF [fields] [--apply]',
    '  sloth-agent accounts remove --account-ref REF [--apply]',
    '  sloth-agent investments [--account-ref REF] [--base-url URL]',
    '  sloth-agent portfolio [--view mine|partner|household] [--base-url URL]',
    '  sloth-agent budget --scope personal|joint [--period YYYY-MM] [--base-url URL]',
    '  sloth-agent budget status --scope personal|joint [--period YYYY-MM] [--base-url URL]',
    '  sloth-agent budget update --scope personal|joint [--period YYYY-MM]',
    '    --input budget.json [--apply] [--base-url URL]',
    '  sloth-agent budget move --scope personal|joint [--period YYYY-MM]',
    '    --from-category-id ID --to-category-id ID --amount AMOUNT [--apply]',
    '  sloth-agent categories [list] [--base-url URL]',
    '  sloth-agent categories create --name NAME --icon-key KEY --type TYPE [--apply]',
    '  sloth-agent categories rename --category-id ID --name NAME [--apply]',
    '  sloth-agent line-items create --scope personal|joint --category-id ID --name NAME [--apply]',
    '  sloth-agent line-items rename --scope personal|joint --category-id ID --line-item-id ID --name NAME [--apply]',
    '  sloth-agent transactions [--uncategorized[=true|false]] [--shared[=true|false]] [--limit N]',
    '    [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--q TEXT]',
    '    [--account-ref REF] [--category-id ID] [--line-item-id ID]',
    '    [--cursor CURSOR] [--include-pending] [--base-url URL]',
    '  sloth-agent partner status [--limit N] [--cursor CURSOR] [--base-url URL]',
    '  sloth-agent assign --input assignments.json [--apply] [--base-url URL]',
    '  sloth-agent rules [list] [--base-url URL]',
    '  sloth-agent rules get --transaction-ref REF [--base-url URL]',
    '  sloth-agent rules set --transaction-ref REF --input rule.json [--apply]',
    '  sloth-agent rules delete --transaction-ref REF [--apply]',
    '  sloth-agent rules scan-contract --contract FILE.pdf [--apply]',
    '  sloth-agent receipts extract --image FILE [--base-url URL]',
    '  sloth-agent receipts get --transaction-ref REF [--base-url URL]',
    '  sloth-agent receipts attach --transaction-ref REF --input receipt.json [--expected-revision N] [--apply]',
    '  sloth-agent receipts remove --transaction-ref REF --revision N [--apply]',
    '  sloth-agent goals [list] [--base-url URL]',
    '  sloth-agent goals create --name NAME --target-amount AMOUNT',
    '    --type keep|spend --account-ref REF [--target-month YYYY-MM]',
    '    [--priority POSITION] [--apply] [--base-url URL]',
    '  sloth-agent goals update --goal-id ID [fields] [--apply] [--base-url URL]',
    '  sloth-agent goals mark-spent --goal-id ID [--apply] [--base-url URL]',
    '  sloth-agent goals restore --goal-id ID [--apply] [--base-url URL]',
    '  sloth-agent goals delete --goal-id ID [--apply] [--base-url URL]',
    '  sloth-agent scenarios [list] [--base-url URL]',
    '  sloth-agent scenarios create --month YYYY-MM --name NAME --account-ref REF',
    '    [--recurring-amount AMOUNT] [--one-off-amount AMOUNT] [--apply]',
    '  sloth-agent scenarios update --month YYYY-MM [fields] [--apply]',
    '  sloth-agent scenarios activate --month YYYY-MM --option-id ID [--apply]',
    '  sloth-agent scenarios delete --month YYYY-MM [--apply]',
    '  sloth-agent ask-partner --transaction-ref REF [--base-url URL]',
    '',
    'Help:',
    '  Run sloth-agent <command> --help for options, inputs, output, and examples.',
    '  Every nested subcommand has its own help, for example:',
    '  sloth-agent auth login --help',
    '  sloth-agent goals update --help',
    '',
    'Global options:',
    '  -h, --help       Show top-level or command-specific help',
    '  -V, --version    Show the CLI version',
    '  --base-url URL   Use a different API origin',
    '',
    'Environment:',
    '  SLOTH_AGENT_TOKEN         Personal access token from Settings > Developer access',
    '  SLOTH_AGENT_API_BASE_URL  Optional API origin; defaults to https://budget.slothmoney.app',
    '',
    'Access:',
    '  New tokens are view-only. Enable Allow changes in Sloth Money when the',
    '  CLI needs to call write endpoints.',
  ].join('\n');
}

export function authHelpText(): string {
  return [
    'Sloth Agent CLI — auth',
    '',
    'Manage the personal access token used for Agent API requests.',
    '',
    'Commands:',
    '  sloth-agent auth login     Validate and store a personal access token',
    '  sloth-agent auth status    Check the active credential with a live API request',
    '  sloth-agent auth logout    Remove the token from the native credential store',
    '',
    'Help:',
    '  Run sloth-agent auth <command> --help for command-specific details.',
  ].join('\n');
}

export function authLoginHelpText(): string {
  return [
    'Sloth Agent CLI — auth login',
    '',
    'Validate a personal access token, then store it in the native credential store.',
    '',
    'Usage:',
    '  sloth-agent auth login [--token-stdin | --from-env] [--base-url URL]',
    '',
    'Options:',
    '  --token-stdin    Optional. Read the token from stdin.',
    '  --from-env       Optional. Read the token from SLOTH_AGENT_TOKEN.',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    '',
    'Input:',
    '  With no input option, login uses a hidden prompt and requires an interactive TTY.',
    '  --token-stdin and --from-env are mutually exclusive.',
    '  Tokens must start with sloth_pat_v1_ and contain no whitespace.',
    '  Never pass a token as a command argument.',
    '  An existing stored credential is replaced only after remote validation succeeds.',
    '  Remote validation requires agent:read. Commands that write also require',
    '  agent:write, selected with Allow changes when the token is created.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Examples:',
    '  sloth-agent auth login',
    '  sloth-agent auth login --token-stdin',
    '  sloth-agent auth login --from-env',
    '',
    'Output:',
    '  JSON describing the API origin, stored state, and active credential source.',
  ].join('\n');
}

export function authStatusHelpText(): string {
  return [
    'Sloth Agent CLI — auth status',
    '',
    'Check the active credential with a live API request.',
    '',
    'Usage:',
    '  sloth-agent auth status [--base-url URL]',
    '',
    'Options:',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Example:',
    '  sloth-agent auth status',
    '',
    'Output:',
    '  JSON containing origin, source, a masked token suffix, and remoteStatus.',
    '  Checking status updates the token last-used time.',
  ].join('\n');
}

export function authLogoutHelpText(): string {
  return [
    'Sloth Agent CLI — auth logout',
    '',
    'Remove the token for an API origin from the native credential store.',
    '',
    'Usage:',
    '  sloth-agent auth logout [--base-url URL]',
    '',
    'Options:',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Important:',
    '  Logout does not revoke the token remotely or unset SLOTH_AGENT_TOKEN.',
    '  Revoke the token in Sloth Money Settings > Developer access.',
    '',
    'Example:',
    '  sloth-agent auth logout',
    '',
    'Output:',
    '  JSON describing local removal, any environment override, and revocation state.',
  ].join('\n');
}

export function categoriesHelpText(): string {
  return [
    'Sloth Agent CLI — categories',
    '',
    'Read categories and the personal and joint line items within them.',
    '',
    'Commands:',
    '  sloth-agent categories list    List categories; "sloth-agent categories" is equivalent.',
    '  sloth-agent categories create  Preview or create a custom category.',
    '  sloth-agent categories rename  Preview or rename a custom category.',
    '',
    'Help:',
    '  Run sloth-agent categories <command> --help for command-specific details.',
    '',
    'Usage:',
    '  sloth-agent categories [list] [--base-url URL]',
    '',
    'Options:',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Budget taxonomy:',
    '  A category is the broader parent.',
    '  A line item is a child within one category.',
    '  Line-item names such as "Other" may repeat. Preserve the full choice as',
    '  (scope, categoryId, lineItemId), using the personal or joint line-item',
    '  map matching the transaction scope.',
    '  Choose the most specific suitable line item. If none fits, use that',
    '  category\'s "Other" line item.',
    '',
    'Examples:',
    '  sloth-agent categories',
    '  Bills → Other',
    '  Subscriptions → Other',
    '',
    'Access:',
    '  This command is read-only.',
    '',
    'Output:',
    '  categories                       Parent categories',
    '  personalLineItemsByCategoryId    Personal child line items keyed by category ID',
    '  jointLineItemsByCategoryId       Joint child line items keyed by category ID',
  ].join('\n');
}

export function categoriesCreateHelpText(): string {
  return [
    'Sloth Agent CLI — categories create',
    '',
    'Create a custom category.',
    '',
    'Usage:',
    '  sloth-agent categories create --name NAME --icon-key KEY --type TYPE [--apply] [--base-url URL]',
    '',
    'Required inputs:',
    '  --name NAME       Category name, up to 200 characters.',
    `  --icon-key KEY    One of: ${ICON_KEYS.join(', ')}.`,
    '  --type TYPE       Needs, Debts, Savings & Investments, or Wants.',
    '',
    'Write behavior:',
    '  Without --apply, returns a JSON preview and makes no mutation request.',
    '  With --apply, creates the category globally and requires a write-enabled token.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  JSON containing category.id, name, iconKey, categoryType, and source.',
  ].join('\n');
}

export function categoriesRenameHelpText(): string {
  return [
    'Sloth Agent CLI — categories rename',
    '',
    'Rename a user-created category. Built-in categories are immutable.',
    '',
    'Usage:',
    '  sloth-agent categories rename --category-id ID --name NAME [--apply] [--base-url URL]',
    '',
    'Required inputs:',
    '  --category-id ID  Custom category document ID.',
    '  --name NAME        New category name, up to 200 characters.',
    '',
    'Write behavior:',
    '  Without --apply, returns a JSON preview and makes no mutation request.',
    '  With --apply, renames the canonical category and requires a write-enabled token.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  JSON containing the renamed category.',
  ].join('\n');
}

function lineItemsMutationHelpText(operation: 'create' | 'rename'): string {
  const rename = operation === 'rename';
  return [
    `Sloth Agent CLI — line-items ${operation}`,
    '',
    rename ? 'Rename a scoped budget line item.' : 'Create a scoped budget line item at zero.',
    '',
    'Usage:',
    rename
      ? '  sloth-agent line-items rename --scope personal|joint --category-id ID --line-item-id ID --name NAME [--apply] [--base-url URL]'
      : '  sloth-agent line-items create --scope personal|joint --category-id ID --name NAME [--apply] [--base-url URL]',
    '',
    'Required inputs:',
    '  --scope SCOPE       personal or joint.',
    '  --category-id ID    Parent category ID.',
    ...(rename ? ['  --line-item-id ID   Existing child line-item ID.'] : []),
    '  --name NAME         Line-item name, up to 200 characters.',
    '',
    'Write behavior:',
    '  Without --apply, returns a JSON preview and makes no mutation request.',
    '  With --apply, updates the current period and explicit future plans.',
    '  Historical snapshots remain unchanged. A write-enabled token is required.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  JSON containing scope, categoryId, and lineItem.id and name.',
  ].join('\n');
}

export function lineItemsCreateHelpText(): string {
  return lineItemsMutationHelpText('create');
}

export function lineItemsRenameHelpText(): string {
  return lineItemsMutationHelpText('rename');
}

export function lineItemsHelpText(): string {
  return [
    'Sloth Agent CLI — line-items',
    '',
    'Create or rename personal or joint budget line items.',
    '',
    'Commands:',
    '  sloth-agent line-items create  Preview or create a scoped line item.',
    '  sloth-agent line-items rename  Preview or rename a scoped line item.',
    '',
    'Help:',
    '  Run sloth-agent line-items <command> --help for command-specific details.',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function accountsHelpText(): string {
  return [
    'Sloth Agent CLI — accounts',
    '',
    'Read the existing Sloth account inventory known to the authenticated user.',
    '',
    'Commands:',
    '  sloth-agent accounts list    List accounts; "sloth-agent accounts" is equivalent.',
    '  sloth-agent accounts update  Preview or update an owned account.',
    '  sloth-agent accounts remove  Preview or archive an owned manual account.',
    '',
    'Help:',
    '  Run sloth-agent accounts <command> --help for command-specific details.',
    '',
    'Usage:',
    '  sloth-agent accounts [list] [--base-url URL]',
    '',
    'Options:',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Access:',
    '  This command is read-only and does not refresh connected accounts.',
    '',
    'Output:',
    '  asOf                   Server response time',
    '  accounts[].accountRef  Opaque stable account reference',
    '  accounts[].ownership   personal or joint',
    '  accounts[].balanceAmount and currency in the native currency when known',
    '  accounts[].connectionState and lastBalanceUpdatedAt for freshness',
    '  accounts[].isGoalFundingAccount whether Goals may use the account',
  ].join('\n');
}

export function accountsUpdateHelpText(): string {
  return [
    'Sloth Agent CLI — accounts update',
    '',
    'Preview or update an owned account. Manual accounts support their editable fields.',
    '',
    'Usage:',
    '  sloth-agent accounts update --account-ref REF [fields] [--apply] [--base-url URL]',
    '',
    'Required input:',
    '  --account-ref REF                  Opaque accountRef from sloth-agent accounts.',
    '',
    'Update fields (at least one):',
    '  --institution-name NAME            Manual account institution.',
    '  --account-name NAME                Manual account name.',
    '  --currency CODE                    Three-letter currency code.',
    '  --ownership individual|joint       Manual account ownership.',
    '  --balance-amount AMOUNT             Balance-only account balance.',
    '  --account-type savings|investments Balance-only account type.',
    '  --goal-funding-account true|false   Whether Goals may use this account.',
    '  --partner-visibility private|balance|holdings',
    '                                      What this account shares with your partner.',
    '',
    'Write behavior:',
    '  Without --apply, returns a JSON preview without credentials or a network request.',
    '  With --apply, requires agent:write on a write-enabled token and updates saved Sloth metadata.',
    '  Connected accounts support --goal-funding-account and --partner-visibility.',
    '  Sharing exposes planning data only. It does not change ownership or assign the account to Goals.',
    '  Manual current accounts cannot change type, balance, or Goal-funding membership.',
    '  Partner-owned shared accounts cannot be changed.',
    '  Unknown, disconnected, or inaccessible references return Account not found.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  Preview mode returns dryRun, method, endpoint, and payload.',
    '  Apply mode returns changed and the complete persisted account.',
  ].join('\n');
}

export function accountsRemoveHelpText(): string {
  return [
    'Sloth Agent CLI — accounts remove',
    '',
    'Preview or archive an owned manual account while retaining its underlying records.',
    '',
    'Usage:',
    '  sloth-agent accounts remove --account-ref REF [--apply] [--base-url URL]',
    '',
    'Required input:',
    '  --account-ref REF  Opaque accountRef from sloth-agent accounts.',
    '',
    'Write behavior:',
    '  Without --apply, returns a JSON preview without credentials or a network request.',
    '  With --apply, requires agent:write and archives the manual account.',
    '  Connected and partner-owned accounts cannot be removed.',
    '  Repeating an applied removal succeeds with changed false.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  Preview mode returns dryRun, method, and endpoint.',
    '  Apply mode returns removed, changed, and accountRef.',
  ].join('\n');
}

export function investmentsHelpText(): string {
  return [
    'Sloth Agent CLI — investments',
    '',
    'Read linked investment accounts and their cached provider-native holdings.',
    '',
    'Usage:',
    '  sloth-agent investments [--account-ref REF] [--base-url URL]',
    '',
    'Options:',
    '  --account-ref REF  Optional. Return one linked investment account.',
    '  --base-url URL     Optional. Override the API origin.',
    '  -h, --help         Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Access:',
    '  This command requires agent:read and is read-only and cache-only; it never refreshes a brokerage.',
    '  An unknown or non-investment filter returns Investment account not found.',
    '',
    'Output:',
    '  investmentAccounts contains account totals and nested holdings.',
    '  Holding quantities, prices, market values, currencies, and freshness are',
    '  provider-native and are not converted or guaranteed to reconcile to totals.',
  ].join('\n');
}

export function portfolioHelpText(): string {
  return [
    'Sloth Agent CLI — portfolio',
    '',
    'Read your savings and investments from one household planning perspective.',
    '',
    'Usage:',
    '  sloth-agent portfolio [--view mine|partner|household] [--base-url URL]',
    '',
    'Options:',
    '  --view mine|partner|household  Optional. Defaults to mine.',
    '  --base-url URL                 Optional. Override the API origin.',
    '  -h, --help                     Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Access:',
    '  This read-only command waits up to 45 seconds for eligible linked balances to refresh.',
    '  A completed refresh updates the Budget balance audit for configured backing accounts.',
    '  A same-day cached read does not add another audit checkpoint.',
    '  Partner shows only balances or holdings your partner explicitly shared.',
    '  Household combines your accounts with those shared balances and deduplicates joint accounts.',
    '  Shared data supports planning only. It does not assign partner accounts to Goals or change ownership.',
    '',
    'Output:',
    '  totals gives savings, investments, and tracked amounts in the viewer currency.',
    '  accounts includes ownerRole, freshness, sharing level, and permitted holdings.',
    '  refresh reports whether eligible linked balances refreshed or cached data was returned.',
  ].join('\n');
}

export function budgetHelpText(): string {
  return [
    'Sloth Agent CLI — budget',
    '',
    'Read one personal or joint budget period.',
    '',
    'Commands:',
    '  sloth-agent budget         Read one budget period.',
    '  sloth-agent budget status  Read assigned, spent, and available money.',
    '  sloth-agent budget update  Preview or update planned line-item amounts.',
    '  sloth-agent budget move    Preview or move assigned money.',
    '',
    'Help:',
    '  Run sloth-agent budget <command> --help for command-specific details.',
    '',
    'Usage:',
    '  sloth-agent budget --scope personal|joint [--period YYYY-MM] [--base-url URL]',
    '',
    'Options:',
    '  --scope personal|joint  Required. Budget ownership scope.',
    '  --period YYYY-MM        Optional. Month containing the period start; defaults to the current Sloth period.',
    '  --base-url URL          Optional. Override the API origin.',
    '  -h, --help              Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Access:',
    '  This command is read-only and requires agent:read.',
    '',
    'Output:',
    '  JSON containing scope, periodKey, periodStatus, currency, and effectiveFromPeriodKey.',
    '  funding contains current stored to-assign and reserve amounts when that period exists.',
    '  categories[].lineItems contains line-item IDs, names, and planned amounts in pence.',
    '  Categories also include plannedPence and assignedPence.',
  ].join('\n');
}

export function budgetStatusHelpText(): string {
  return [
    'Sloth Agent CLI — budget status',
    '',
    'Read booked activity and any trustworthy budget for one Sloth budget period.',
    '',
    'Usage:',
    '  sloth-agent budget status --scope personal|joint [--period YYYY-MM] [--base-url URL]',
    '',
    'Options:',
    '  --scope personal|joint  Required. Budget ownership scope.',
    '  --period YYYY-MM        Optional. Month containing the period start; defaults to the current Sloth period.',
    '  --base-url URL          Optional. Override the API origin.',
    '  -h, --help              Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Access and freshness:',
    '  This command is read-only, requires agent:read, and never changes the budget.',
    '  Current periods use the normal transaction refresh policy; historical periods are cache-only.',
    '  A completed refresh updates the Budget balance audit for configured backing accounts.',
    '  A same-day cached read does not add another audit checkpoint.',
    '  A historical response returns refresh as null.',
    '',
    'Output:',
    '  activity.categories includes Income, Transfer, None, and ordinary categories.',
    '  moneyInPence and moneyOutPence are nonnegative; netPence is money in minus money out.',
    '  A transaction with no category appears under activity.uncategorized.',
    '  budget contains the period plan and balances, or budget is null when no trustworthy plan exists.',
  ].join('\n');
}

export function budgetUpdateHelpText(): string {
  return [
    'Sloth Agent CLI — budget update',
    '',
    'Preview or update planned line-item amounts for one budget scope.',
    '',
    'Usage:',
    '  sloth-agent budget update --scope personal|joint [--period YYYY-MM] --input FILE [--apply] [--base-url URL]',
    '',
    'Required inputs:',
    '  --scope personal|joint  Budget ownership scope.',
    '  --input FILE            JSON file containing allocations.',
    '',
    'Optional inputs:',
    '  --period YYYY-MM        Defaults to the current Sloth budget period.',
    '  --apply                 Send the update. Without it, only validate and preview.',
    '  --base-url URL          Override the API origin.',
    '  -h, --help              Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Input format:',
    '  {"allocations":[{"categoryId":"groceries","lineItemId":"weekly","plannedPence":45000}]}',
    '  Provide 1 to 100 unique categoryId and lineItemId pairs.',
    '  plannedPence must be a nonnegative whole number of pence.',
    '',
    'Write behavior:',
    '  Without --apply, returns JSON after local validation and does not load credentials',
    '  or contact Sloth Money. A successful preview does not guarantee the remote write.',
    '  With --apply, each supplied amount patches a complete selected-period budget.',
    '  The resulting complete budget overwrites the selected period and every explicit future plan.',
    '  A later update from another period overwrites that period and everything after it.',
    '  Historical periods cannot be changed. Applying requires agent:write.',
    '',
    'Output:',
    '  Preview mode returns dryRun, endpoint, method, and the validated payload.',
    '  Apply mode returns the complete persisted budget response.',
  ].join('\n');
}

export function budgetMoveHelpText(): string {
  return [
    'Sloth Agent CLI — budget move',
    '',
    'Preview or move assigned money between categories or To Assign.',
    '',
    'Usage:',
    '  sloth-agent budget move --scope personal|joint [--period YYYY-MM] --from-category-id ID --to-category-id ID --amount AMOUNT [--apply] [--base-url URL]',
    '',
    'Required inputs:',
    '  --scope personal|joint  Budget ownership scope.',
    '  --from-category-id ID   Source category ID, or to-assign.',
    '  --to-category-id ID     Destination category ID, or to-assign.',
    '  --amount AMOUNT         Positive amount in the budget currency, with up to two decimals.',
    '                          The integer-pence value must be at most 9,007,199,254,740,991.',
    '',
    'Optional inputs:',
    '  --period YYYY-MM        Defaults to the current Sloth budget period.',
    '  --apply                 Send the movement. Without it, only validate and preview.',
    '  --base-url URL          Override the API origin.',
    '  -h, --help              Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Write behavior:',
    '  Without --apply, returns JSON locally without loading credentials or contacting Sloth Money.',
    '  With --apply, atomically subtracts from the source and adds to the destination.',
    '  Use the reserved ID to-assign to move money to or from To Assign.',
    '  The move changes current assigned balances and records budget movement history.',
    '  The source category or To Assign may become negative, so choose the source deliberately.',
    '  It does not change planned amounts or future budget plans.',
    '  Historical periods cannot be changed. Applying requires agent:write.',
    '',
    'Output:',
    '  Preview mode returns dryRun, endpoint, method, and the amountPence payload.',
    '  Apply mode returns the period, currency, movement, To Assign balance, and affected category balances.',
    '',
    'Examples:',
    '  sloth-agent budget move --scope personal --from-category-id activities --to-category-id groceries --amount 52.95',
    '  sloth-agent budget move --scope personal --from-category-id activities --to-category-id groceries --amount 52.95 --apply',
  ].join('\n');
}

export function transactionsHelpText(): string {
  return [
    'Sloth Agent CLI — transactions',
    '',
    'Read transactions, optionally filtered or paginated.',
    '',
    'Usage:',
    '  sloth-agent transactions [options]',
    '',
    'Options:',
    '  --uncategorized[=true|false]  Optional. Filter the selected assignment scope by state;',
    '                                  with no value, use true.',
    '  --shared[=true|false]         Optional. Filter by partner-sharing state; with no value, use true.',
    '  --limit N                     Optional. Integer from 1 to 200; omit for API default.',
    '  --start-date YYYY-MM-DD        Optional. Include transactions on or after this date.',
    '  --end-date YYYY-MM-DD          Optional. Include transactions on or before this date.',
    '  --q TEXT                       Optional. Search transactions by text.',
    '  --account-ref REF              Optional. Filter by the opaque accountRef from sloth-agent accounts.',
    '                                  Copy the exact sloth_account_v1_... value.',
    '  --category-id ID               Optional. Filter by category ID.',
    '  --line-item-id ID              Optional. Filter primary or split assignments by line-item ID.',
    '  --assignment-scope SCOPE        Optional. Filter assignments by personal or joint.',
    '                                  The transaction\'s native scope is used when omitted.',
    '  --cursor CURSOR                Optional. Continue from a previous nextCursor.',
    '  --include-pending               Optional. Include the latest complete pending observation',
    '                                  from the normal linked-bank refresh flow.',
    '  --base-url URL                 Optional. Override the API origin.',
    '  -h, --help                     Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Constraints:',
    '  All filters are omitted by default.',
    '  --end-date must not be before --start-date.',
    '  The first transaction read each UTC day may refresh linked bank data.',
    '  Refresh remotely persists booked transactions and account balances.',
    '  A completed refresh updates the Budget balance audit for configured backing accounts.',
    '  A same-day cached read does not add another audit checkpoint.',
    '  The command waits up to 45 seconds, then returns cached data if refresh continues.',
    '  --include-pending does not force an extra refresh or make pending rows writable.',
    '  Date, text, and account filters apply to pending rows. Assignment, sharing, category,',
    '  line-item, limit, and cursor filters apply only to booked transactions.',
    '',
    'Output:',
    '  JSON containing transactions, nextCursor, and structured refresh status.',
    '  With --include-pending, pending reports availability current or unavailable.',
    '  A current empty list means the latest complete observation had no matching pending rows.',
    '  Unavailable means no pending snapshot was returned; it does not mean there are none.',
    '  Pending rows have opaque pendingRef and accountRef values plus writable: false and',
    '  writeBlockReason: "pending". They cannot be passed to assign or other write commands.',
    '  Every transaction includes accountRef for its originating account.',
    '  Refresh failures do not hide readable cached transactions.',
    '  reason: "quota_exceeded" means the UTC-day provider refresh allowance is exhausted.',
    '  Personal assignments use the top-level categoryId, lineItemId, and categorySplits.',
    '  Joint assignments appear under jointBudgetContribution.',
    '  A transaction can be uncategorised personally while its joint-budget contribution',
    '  is already categorised. To assess its categorisation, inspect both locations.',
    '  Use nextCursor with --cursor',
    '  to request the next page. A null nextCursor means there are no more pages.',
    '',
    'Examples:',
    '  sloth-agent transactions --uncategorized --limit 50',
    '  sloth-agent transactions --assignment-scope joint --uncategorized',
    '  sloth-agent transactions --include-pending --start-date 2026-08-27',
    '  sloth-agent transactions --q "tesco" --start-date 2026-05-01 --end-date 2026-05-31',
  ].join('\n');
}

export function partnerHelpText(): string {
  return [
    'Sloth Agent CLI — partner',
    '',
    'Read partner settlement context and recorded partner payments.',
    '',
    'Commands:',
    '  sloth-agent partner status   Read the current settlement balance and payment activity',
    '',
    'Help:',
    '  Run sloth-agent partner status --help for inputs, output, and examples.',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function partnerStatusHelpText(): string {
  return [
    'Sloth Agent CLI — partner status',
    '',
    'Read the current partner settlement balance and recorded partner payments.',
    '',
    'Usage:',
    '  sloth-agent partner status [--limit N] [--cursor CURSOR] [--base-url URL]',
    '',
    'Options:',
    '  --limit N        Optional. Return 1 to 200 payment records; defaults to 50.',
    '  --cursor CURSOR  Optional. Continue payment activity from a previous nextCursor.',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Read behavior:',
    '  Requires agent:read. This command does not refresh bank accounts or change Sloth Money.',
    '  It calculates settlement from shared booked transactions and recorded partner payments.',
    '',
    'Output:',
    '  JSON containing asOf, partnerStatus, settlement, payments, and nextCursor.',
    '  settlement is null when no partner is connected. Otherwise balance.direction is',
    '  settled when amountPence is 0. The you_owe and partner_owes_you directions have',
    '  a positive amountPence.',
    '  Each payment has an opaque paymentRef, sent or received direction, amountPence,',
    '  currency, and occurredAt. A null nextCursor means there are no more payments.',
    '',
    'Examples:',
    '  sloth-agent partner status',
    '  sloth-agent partner status --limit 100',
  ].join('\n');
}

export function assignHelpText(): string {
  return [
    'Sloth Agent CLI — assign',
    '',
    'Validate, preview, or apply transaction sharing and category assignments from a JSON file.',
    '',
    'Usage:',
    '  sloth-agent assign --input FILE [--apply] [--base-url URL]',
    '',
    'Options:',
    '  --input FILE      Required. JSON assignment file containing 1 to 100 assignments.',
    '  --apply           Optional. Write assignments to Sloth Money.',
    '  --base-url URL    Optional. Override the API origin.',
    '  -h, --help        Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Safety:',
    '  Without --apply, the command checks that the file is valid and returns',
    '  the payload it would send. It does not contact Sloth Money, verify the',
    '  transactionRef or category values, or write anything.',
    '  A successful preview does not guarantee that applying it will succeed.',
    '  With --apply, the CLI submits one durable server operation, then polls authenticated status',
    '  until every item finishes. Transient submission and status failures are retried.',
    '  Re-run the same command with the same assignment input after an interruption;',
    '  the CLI resumes the same operation instead of duplicating its work.',
    '  Operation status and item receipts remain available on the server for seven days.',
    '  Assignments are best-effort; any failed item makes the command exit with code 1',
    '  while the complete terminal result remains available on stdout.',
    '  Applying requires a write-enabled token created with Allow changes.',
    '',
    'Input:',
    '  The top-level object must contain an assignments array.',
    '  Each assignment requires transactionRef and at least one category operation or sharing object.',
    '  Each transactionRef may appear only once in the assignments array.',
    '  sharing.isShared is required. shareRatio is optional from 0 to 1 and is your share.',
    '  userExclusiveAmountPence and partnerExclusiveAmountPence are optional nonnegative integers.',
    '  Omitted split values use saved defaults for a first share and preserve an existing split.',
    '  Set sharing.isShared to false on its own to unshare and retain the dormant joint category.',
    '  Copy the exact transactionRef from transactions output and categoryId from',
    '  categories output. The example values below are placeholders.',
    '  Set categoryId to null to clear an assignment.',
    '  lineItemId is optional and accepts a non-empty string or null.',
    '  When the category has line items, choose the most specific suitable line item.',
    '  If none fits, use that category\'s Other line item from the matching scope.',
    '  categorySplits is optional and accepts a non-empty array or null.',
    '  Each split requires categoryId and a positive integer amountPence;',
    '  a split lineItemId is optional.',
    '  incomeSubtype is optional and accepts "pay", "interest", or null.',
    '  assignmentScope is optional and accepts "personal" or "joint".',
    '  The transaction\'s native scope is used when assignmentScope is omitted for category-only requests.',
    '  Combined requests use Joint when you have no exclusive amount and Personal when you do.',
    '',
    'Workflow:',
    '  sloth-agent categories',
    '  sloth-agent transactions --assignment-scope personal --uncategorized --limit 50',
    '  sloth-agent assign --input assignments.json          Preview only',
    '  sloth-agent assign --input assignments.json --apply  Write assignments',
    '  sloth-agent transactions --assignment-scope personal --limit 50  Read back',
    '',
    'Example:',
    '  {',
    '    "assignments": [',
    '      {',
    '        "transactionRef": "PASTE_THE_EXACT_TRANSACTION_REF_HERE",',
    '        "sharing": { "isShared": true, "shareRatio": 0.6 },',
    '        "assignmentScope": "joint",',
    '        "categoryId": "PASTE_A_CATEGORY_ID_HERE",',
    '        "lineItemId": "PASTE_A_LINE_ITEM_ID_HERE"',
    '      }',
    '    ]',
    '  }',
    '  These are placeholders. Replace all three values with exact IDs from CLI output.',
    '',
    'Output:',
    '  Preview mode returns dryRun, endpoint, and the validated payload.',
    '  Apply mode waits for the durable operation and returns succeeded and failed arrays.',
    '  Successful assignments update the original transaction. See the result in',
    '  Sloth Money → Transactions or read the transaction again through the CLI.',
    '  Assignments do not create a separate list.',
  ].join('\n');
}

export function goalsHelpText(): string {
  return [
    'Sloth Agent CLI — goals',
    '',
    'List, preview, create, update, mark spent, restore, or delete account-funded Goals.',
    '',
    'Commands:',
    '  sloth-agent goals list      List goals; "sloth-agent goals" is equivalent.',
    '  sloth-agent goals create    Preview or create a goal.',
    '  sloth-agent goals update    Preview or update selected goal fields.',
    '  sloth-agent goals mark-spent Preview or mark a Spend goal spent.',
    '  sloth-agent goals restore   Preview or restore a spent goal.',
    '  sloth-agent goals delete    Preview or permanently delete a goal.',
    '',
    'Help:',
    '  Run sloth-agent goals <command> --help for command-specific details.',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function goalsListHelpText(): string {
  return [
    'Sloth Agent CLI — goals list',
    '',
    'List your goals in their display order.',
    '',
    'Usage:',
    '  sloth-agent goals [list] [--base-url URL]',
    '',
    'Options:',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Constraints:',
    '  No filters or singular get are supported.',
    '  This command is read-only.',
    '',
    'Output:',
    '  JSON containing currency, forecastBasis, and goals. Each goal includes its',
    '  effectivePriority, funding account, desired targetMonthKey, and calculated',
    '  forecastMonthKey.',
  ].join('\n');
}

export function goalsCreateHelpText(): string {
  return [
    'Sloth Agent CLI — goals create',
    '',
    'Preview or create a goal.',
    '',
    'Usage:',
    '  sloth-agent goals create --name NAME --target-amount AMOUNT --type keep|spend --account-ref REF [options]',
    '',
    'Options:',
    '  --name NAME                 Required. Goal name, 1 to 200 characters.',
    '  --target-amount AMOUNT      Required. Positive major-unit amount with up to 2 decimals.',
    '  --type keep|spend           Required. Keep reserves funded money; Spend is spent later.',
    '  --account-ref REF           Required. Personal Goal-funding account from accounts list.',
    '  --target-month YYYY-MM      Optional. Desired calendar month; it does not change the forecast.',
    '  --priority POSITION         Optional. One-based priority; defaults to append.',
    '  --apply                     Optional. Create the goal in Sloth Money.',
    '  --base-url URL              Optional. Override the API origin.',
    '  -h, --help                  Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Safety:',
    '  Without --apply, the command authenticates and asks Sloth to calculate the Goal.',
    '  The server performs no writes for a preview.',
    '  Applying requires a write-enabled token created with Allow changes.',
    '  New goals are private to the owner and append unless --priority is supplied.',
    '',
    'Example:',
    '  sloth-agent goals create --name "Emergency fund" --target-amount 12000 --type keep --account-ref REF',
    '  sloth-agent goals create --name "Wedding" --target-amount 22000 --type spend --account-ref REF --target-month 2027-06 --apply',
    '',
    'Output:',
    '  Preview and apply return the Goal, currency, calculated forecastMonthKey,',
    '  effective priority, funding-account details, and forecastBasis.',
  ].join('\n');
}

export function goalsUpdateHelpText(): string {
  return [
    'Sloth Agent CLI — goals update',
    '',
    'Preview or partially update a goal.',
    '',
    'Usage:',
    '  sloth-agent goals update --goal-id ID [fields] [--apply] [--base-url URL]',
    '',
    'Options:',
    '  --goal-id ID                 Required. Goal ID from goals list or create output.',
    '  --name NAME                  Optional. Replacement name, 1 to 200 characters.',
    '  --target-amount AMOUNT       Optional. Positive amount with up to 2 decimals.',
    '  --target-month YYYY-MM       Optional. Replace the target month.',
    '  --clear-target-month         Optional. Remove the target month.',
    '  --type keep|spend            Optional. Change how funded money is treated.',
    '  --account-ref REF            Optional. Reassign to another personal Goal-funding account.',
    '  --priority POSITION          Optional. Positive whole-number position; 1 is highest.',
    '  --apply                      Optional. Write the partial update.',
    '  --base-url URL               Optional. Override the API origin.',
    '  -h, --help                   Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Constraints:',
    '  Provide at least one field to update.',
    '  Priority 1 is highest. The position cannot exceed the current goal count.',
    '  Moving a goal shifts the intervening goals automatically.',
    '  Sloth recalculates the Goal roadmap before saving the update.',
    '  Set and clear target-month options are mutually exclusive.',
    '  Restore a spent goal before changing its type.',
    '  Sharing remains app-managed. Updates to a shared Goal remain visible to the',
    '  connected partner, but its assigned account remains private to the owner.',
    '',
    'Safety:',
    '  Without --apply, the command returns a dry-run preview and does not write.',
    '  Applying requires a write-enabled token created with Allow changes.',
    '',
    'Example:',
    '  sloth-agent goals update --goal-id wedding --type spend --apply',
    '  sloth-agent goals update --goal-id goal-3 --priority 2 --apply',
    '',
    'Output:',
    '  Preview mode returns dryRun, method, endpoint, and payload.',
    '  Apply mode returns the complete persisted Goal, calculated forecastMonthKey,',
    '  effective priority, funding-account details, currency, and forecastBasis.',
  ].join('\n');
}

export function goalsMarkSpentHelpText(): string {
  return [
    'Sloth Agent CLI — goals mark-spent',
    '',
    'Preview or mark a Spend goal spent.',
    '',
    'Usage:',
    '  sloth-agent goals mark-spent --goal-id ID [--apply] [--base-url URL]',
    '',
    'Options:',
    '  --goal-id ID   Required. Spend goal ID from goals list or create output.',
    '  --apply        Optional. Mark the goal spent in Sloth Money.',
    '  --base-url URL Optional. Override the API origin.',
    '  -h, --help     Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Safety and lifecycle:',
    '  Without --apply, the command previews PATCH {"isSpent":true} and does not write.',
    '  Keep goals cannot be marked spent. Change an active goal to Spend first.',
    '  A spent goal is excluded from future goal allocation until restored.',
    '',
    'Example:',
    '  sloth-agent goals mark-spent --goal-id wedding --apply',
    '',
    'Output:',
    '  Preview mode returns dryRun, method, endpoint, and payload.',
    '  Apply mode returns the complete persisted goal and currency.',
  ].join('\n');
}

export function goalsRestoreHelpText(): string {
  return [
    'Sloth Agent CLI — goals restore',
    '',
    'Preview or restore a spent Spend goal.',
    '',
    'Usage:',
    '  sloth-agent goals restore --goal-id ID [--apply] [--base-url URL]',
    '',
    'Options:',
    '  --goal-id ID   Required. Spent goal ID from goals list output.',
    '  --apply        Optional. Restore the goal in Sloth Money.',
    '  --base-url URL Optional. Override the API origin.',
    '  -h, --help     Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Safety and lifecycle:',
    '  Without --apply, the command previews PATCH {"isSpent":false} and does not write.',
    '  Restoring clears spentAt and returns the goal to allocation at its saved priority.',
    '',
    'Example:',
    '  sloth-agent goals restore --goal-id wedding --apply',
    '',
    'Output:',
    '  Preview mode returns dryRun, method, endpoint, and payload.',
    '  Apply mode returns the complete persisted goal and currency.',
  ].join('\n');
}

export function goalsDeleteHelpText(): string {
  return [
    'Sloth Agent CLI — goals delete',
    '',
    'Preview or permanently delete a goal.',
    '',
    'Usage:',
    '  sloth-agent goals delete --goal-id ID [--apply] [--base-url URL]',
    '',
    'Options:',
    '  --goal-id ID    Required. Goal ID from goals list or create output.',
    '  --apply         Optional. Permanently delete the goal.',
    '  --base-url URL  Optional. Override the API origin.',
    '  -h, --help      Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Safety:',
    '  Without --apply, the command returns a dry-run preview and does not write.',
    '  Applying requires a write-enabled token created with Allow changes.',
    '  Applying deletion also removes the goal from forecast assignments and',
    '  removes its goal drift history. This operation cannot be undone.',
    '',
    'Output:',
    '  Preview mode returns dryRun, method, and endpoint.',
    '  Apply mode returns deleted and deletedGoalId.',
  ].join('\n');
}

export function scenariosHelpText(): string {
  return [
    'Sloth Agent CLI - scenarios',
    '',
    'Manage the month-anchored choices used by the Goal forecast.',
    'Each scenario contains options. Its active option controls the forecast calculation.',
    '',
    'Commands:',
    '  sloth-agent scenarios list       List scenarios and their options.',
    '  sloth-agent scenarios create     Create a No/Yes scenario.',
    '  sloth-agent scenarios update     Change a scenario or option.',
    '  sloth-agent scenarios activate   Make an option active.',
    '  sloth-agent scenarios delete     Remove a scenario.',
    '',
    'Help:',
    '  Run sloth-agent scenarios <command> --help for command-specific details.',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function scenariosListHelpText(): string {
  return [
    'Sloth Agent CLI - scenarios list',
    '',
    'List each scenario, its active option, and account contributions.',
    '',
    'Usage:',
    '  sloth-agent scenarios [list] [--base-url URL] [-h]',
    '',
    'Options:',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    '',
    'Behavior:',
    'This command is read-only and requires agent:read.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  JSON with currency, forecastBasis, and scenarios. Each scenario contains',
    '  activeOptionId and options with isActive and account contributions.',
  ].join('\n');
}

export function scenariosCreateHelpText(): string {
  return [
    'Sloth Agent CLI - scenarios create',
    '',
    'Create a month-anchored choice and recalculate the Goal roadmap.',
    '',
    'Usage:',
    '  sloth-agent scenarios create --month YYYY-MM --name NAME --account-ref REF',
    '    [--recurring-amount AMOUNT] [--one-off-amount AMOUNT] [--apply]',
    '    [--base-url URL] [-h]',
    '',
    'Required:',
    '  --month YYYY-MM              Month when this scenario begins.',
    '  --name NAME                  Question shown for the scenario, up to 60 characters.',
    '  --account-ref REF            Exact accountRef from sloth-agent accounts.',
    '',
    'Contribution: provide at least one:',
    '  --recurring-amount AMOUNT    Optional monthly contribution in the budget currency.',
    '  --one-off-amount AMOUNT      Optional contribution for this month.',
    '  AMOUNT accepts zero or a positive decimal with at most two decimal places.',
    '  At least one supplied amount must be positive.',
    '',
    'Options:',
    '  --apply          Optional. Save the scenario; otherwise preview it.',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    '',
    'Provide at least one positive contribution. A recurring contribution continues',
    'until a later active scenario changes it. Creation adds No and Yes options and',
    'activates Yes. It records a forecast assumption and does not move money.',
    '',
    'Write behavior:',
    '  Without --apply, Sloth authenticates, calculates the result, and performs zero writes.',
    '  With --apply, Sloth saves the scenario using a write-enabled token with Allow changes.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  JSON with changed, forecastBasis, the proposed or saved scenario, and',
    '  recalculated Goals. Preview and apply use the same output contract.',
    '',
    'Example:',
    '  sloth-agent scenarios create --month 2026-09 \\',
    '    --name "Deposit £100 into the shopping pot each month?" \\',
    '    --account-ref PASTE_THE_EXACT_ACCOUNT_REF_HERE --recurring-amount 100',
  ].join('\n');
}

export function scenariosUpdateHelpText(): string {
  return [
    'Sloth Agent CLI - scenarios update',
    '',
    'Change a scenario, one option, or an account contribution.',
    '',
    'Usage:',
    '  sloth-agent scenarios update --month YYYY-MM [fields] [--apply]',
    '    [--base-url URL] [-h]',
    '',
    'Required:',
    '  --month YYYY-MM                 Scenario month.',
    '',
    'Fields:',
    '  --name NAME                     Rename the scenario, up to 60 characters.',
    '  --option-id ID                  Select an option ID, up to 200 characters.',
    '  --option-label LABEL            Rename it, up to 60 characters; requires --option-id.',
    '  --account-ref REF               Account for contribution changes.',
    '  --recurring-amount AMOUNT       Set a monthly contribution; cannot be used',
    '                                  with --clear-recurring.',
    '  --clear-recurring               Inherit the earlier recurring amount.',
    '  --one-off-amount AMOUNT         Set this month\'s one-off contribution.',
    '  Amounts accept zero or a positive decimal with at most two decimal places.',
    '  Contribution fields require --account-ref, and --account-ref requires one',
    '  of those fields. Provide at least one field that changes the scenario.',
    '',
    'Options:',
    '  --apply          Optional. Save the change; otherwise preview it.',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    '',
    'Contribution changes use the active option when --option-id is omitted.',
    'For recurring contributions, zero explicitly stops the earlier recurring amount.',
    '--clear-recurring removes this override so the earlier recurring amount continues.',
    '',
    'Write behavior:',
    '  Without --apply, Sloth authenticates, calculates the result, and performs zero writes.',
    '  With --apply, Sloth saves the change using a write-enabled token with Allow changes.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  JSON with changed, forecastBasis, the proposed or saved scenario, and',
    '  recalculated Goals. Preview and apply use the same output contract.',
  ].join('\n');
}

export function scenariosActivateHelpText(): string {
  return [
    'Sloth Agent CLI - scenarios activate',
    '',
    'Select the option that controls the forecast and recalculates Goals.',
    '',
    'Usage:',
    '  sloth-agent scenarios activate --month YYYY-MM --option-id ID [--apply]',
    '    [--base-url URL] [-h]',
    '',
    'Required:',
    '  --month YYYY-MM   Scenario month.',
    '  --option-id ID    Exact option ID from scenarios list, up to 200 characters.',
    '',
    'Options:',
    '  --apply          Optional. Save the active option; otherwise preview it.',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    '',
    'Write behavior:',
    'Without --apply, Sloth calculates the result and performs zero writes.',
    'With --apply, Sloth saves the active option using a write-enabled token with Allow changes.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  JSON with changed, forecastBasis, the selected scenario, and recalculated Goals.',
  ].join('\n');
}

export function scenariosDeleteHelpText(): string {
  return [
    'Sloth Agent CLI - scenarios delete',
    '',
    'Remove one scenario. Sloth recalculates Goals without it.',
    '',
    'Usage:',
    '  sloth-agent scenarios delete --month YYYY-MM [--apply] [--base-url URL] [-h]',
    '',
    'Required:',
    '  --month YYYY-MM   Scenario month.',
    '',
    'Options:',
    '  --apply          Optional. Remove the scenario; otherwise preview deletion.',
    '  --base-url URL   Optional. Override the API origin.',
    '  -h, --help       Show this help.',
    '',
    'Write behavior:',
    'Without --apply, Sloth calculates the result and performs zero writes.',
    'With --apply, Sloth removes the scenario using a write-enabled token with Allow changes.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  JSON with changed, forecastBasis, deletedMonthKey, and recalculated Goals.',
  ].join('\n');
}

export function askPartnerHelpText(): string {
  return [
    'Sloth Agent CLI — ask-partner',
    '',
    'Create a shareable link asking a partner to clarify a transaction.',
    '',
    'Usage:',
    '  sloth-agent ask-partner --transaction-ref REF [--base-url URL]',
    '',
    'Options:',
    '  --transaction-ref REF   Required. Stable transactionRef from transaction output.',
    '  --base-url URL          Optional. Override the API origin.',
    '  -h, --help              Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Write behavior:',
    '  Running this command creates the request immediately. There is no preview mode.',
    '  Creating the request requires a write-enabled token created with Allow changes.',
    '',
    'Example:',
    '  sloth-agent ask-partner --transaction-ref PASTE_THE_EXACT_TRANSACTION_REF_HERE',
    '  The value shown is a placeholder. Copy the exact transactionRef from',
    '  sloth-agent transactions output.',
    '',
    'Output:',
    '  JSON containing requestId, publicUrl, message, expiresAt, and status.',
  ].join('\n');
}

export function rulesHelpText(): string {
  return [
    'Sloth Agent CLI — rules',
    '',
    'Manage notifications for future payments that match an existing transaction.',
    'Rules do not create transactions or recurring predictions.',
    '',
    'Commands:',
    '  sloth-agent rules list           List every saved notification rule.',
    '  sloth-agent rules get            Read the rule for one transaction.',
    '  sloth-agent rules set            Preview or save a rule for one transaction.',
    '  sloth-agent rules delete         Preview or remove a rule.',
    '  sloth-agent rules scan-contract  Validate or scan a PDF for its renewal date.',
    '',
    'Use the exact transactionRef returned by sloth-agent transactions.',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function rulesGetHelpText(): string {
  return [
    'Sloth Agent CLI — rules get',
    '',
    'Read the saved notification rule for one existing transaction.',
    '',
    'Usage:',
    '  sloth-agent rules get --transaction-ref REF',
    '',
    'Required:',
    '  --transaction-ref REF  The exact transactionRef from sloth-agent transactions.',
    '',
    'Behavior:',
    '  This command is read-only and requires an agent:read token.',
    '',
    'Output:',
    '  JSON containing the saved rule, or rule: null when no rule exists.',
    '',
    'Example:',
    '  sloth-agent rules get --transaction-ref PASTE_THE_EXACT_TRANSACTION_REF_HERE',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function receiptsHelpText(): string {
  return [
    'Sloth Agent CLI — receipts',
    '',
    'Extract, review, read, attach, or remove receipt items for a booked transaction.',
    '',
    'Commands:',
    '  sloth-agent receipts extract   Extract a transient draft from an image',
    '  sloth-agent receipts get       Read saved receipt items',
    '  sloth-agent receipts attach    Preview or save reviewed JSON',
    '  sloth-agent receipts remove    Preview or remove saved receipt items',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Receipt items are evidence only. They do not change categories, sharing, or budgets.',
  ].join('\n');
}

export function receiptsExtractHelpText(): string {
  return [
    'Sloth Agent CLI — receipts extract',
    '',
    'Usage:',
    '  sloth-agent receipts extract --image FILE [--base-url URL]',
    '',
    'Required input:',
    '  --image FILE   JPEG, PNG, or WebP image up to 8 MB.',
    '',
    'This sends the image for one extraction request and does not save it or the draft.',
    'Review the returned JSON before using receipts attach.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Output:',
    '  JSON containing draft.currency, draft.receiptItems, and draft.warnings.',
  ].join('\n');
}

export function receiptsGetHelpText(): string {
  return [
    'Sloth Agent CLI — receipts get',
    '',
    'Usage:',
    '  sloth-agent receipts get --transaction-ref REF [--base-url URL]',
    '',
    '  --transaction-ref REF   Exact transactionRef from transactions output.',
    '',
    'This command is read-only. Output contains receipt or null.',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function rulesSetHelpText(): string {
  return [
    'Sloth Agent CLI — rules set',
    '',
    'Preview or save notification conditions for one existing transaction.',
    '',
    'Usage:',
    '  sloth-agent rules set --transaction-ref REF --input FILE [--apply]',
    '',
    'Required:',
    '  --transaction-ref REF  The exact transactionRef from sloth-agent transactions.',
    '  --input FILE            A JSON rule file such as rule.json.',
    '',
    'Input:',
    '  {',
    '    "amountChange": {',
    '      "enabled": true,',
    '      "comparison": "increase",',
    '      "baselinePence": 3184',
    '    },',
    '    "renewalReminder": {',
    '      "enabled": true,',
    '      "renewalDate": "2027-07-30",',
    '      "leadDays": 30',
    '    },',
    '    "delivery": { "email": true }',
    '  }',
    '',
    '  comparison accepts increase or any. baselinePence is a positive integer.',
    '  renewalDate is YYYY-MM-DD or null when its reminder is disabled.',
    '  leadDays is an integer from 1 to 365. At least one condition must be enabled.',
    '  In-app notifications are always included. delivery.email adds email delivery.',
    '',
    'Write behavior:',
    '  Without --apply, Sloth validates the file and prints a local preview.',
    '  With --apply, Sloth replaces the saved rule using a write-enabled token.',
    '',
    'Example:',
    '  sloth-agent rules set --transaction-ref PASTE_THE_EXACT_TRANSACTION_REF_HERE \\',
    '    --input rule.json --apply',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function receiptsAttachHelpText(): string {
  return [
    'Sloth Agent CLI — receipts attach',
    '',
    'Usage:',
    '  sloth-agent receipts attach --transaction-ref REF --input FILE [--expected-revision N] [--apply]',
    '',
    'Required inputs:',
    '  --transaction-ref REF   Exact transactionRef from transactions output.',
    '  --input FILE            Reviewed JSON with schemaVersion, currency, and receiptItems.',
    '                          Each item has id, label, and signed amountPence; use negative for discounts.',
    '  --expected-revision N   Required when replacing saved evidence; omit for a new receipt.',
    '',
    'Write behavior:',
    '  Without --apply, prints the exact request and makes no API call.',
    '  With --apply, saves only the reviewed JSON. Images and extraction drafts are not saved.',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function rulesDeleteHelpText(): string {
  return [
    'Sloth Agent CLI — rules delete',
    '',
    'Preview or remove the notification rule for one existing transaction.',
    '',
    'Usage:',
    '  sloth-agent rules delete --transaction-ref REF [--apply]',
    '',
    'Required:',
    '  --transaction-ref REF  The exact transactionRef from sloth-agent transactions.',
    '',
    'Write behavior:',
    '  Without --apply, Sloth prints a local deletion preview.',
    '  With --apply, Sloth removes the rule using a write-enabled token.',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function rulesScanContractHelpText(): string {
  return [
    'Sloth Agent CLI — rules scan-contract',
    '',
    'Validate or scan a contract PDF for its renewal date.',
    '',
    'Usage:',
    '  sloth-agent rules scan-contract --contract FILE.pdf [--apply]',
    '',
    'Required:',
    '  --contract FILE.pdf  A PDF no larger than 6 MB.',
    '',
    'Behavior:',
    '  Without --apply, the PDF is validated locally and is not sent anywhere.',
    '  With --apply, the PDF is sent using a write-enabled token.',
    '',
    'Contract privacy:',
    '  Sloth extracts a renewal date and then discards the file. It is not stored.',
    '',
    'Output:',
    '  JSON containing renewalDate and confidence: high, medium, or low.',
    '',
    'Example:',
    '  sloth-agent rules scan-contract --contract contract.pdf --apply',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function receiptsRemoveHelpText(): string {
  return [
    'Sloth Agent CLI — receipts remove',
    '',
    'Usage:',
    '  sloth-agent receipts remove --transaction-ref REF --revision N [--apply]',
    '',
    '  --revision N   Current positive revision from receipts get.',
    '',
    'Without --apply, prints a preview. With --apply, removes saved receipt items.',
    ...API_ORIGIN_HELP_LINES,
  ].join('\n');
}

export function commandHelpText(topic: HelpTopic): string {
  const helpByTopic: Record<HelpTopic, () => string> = {
    auth: authHelpText,
    'auth-login': authLoginHelpText,
    'auth-status': authStatusHelpText,
    'auth-logout': authLogoutHelpText,
    accounts: accountsHelpText,
    'accounts-update': accountsUpdateHelpText,
    'accounts-remove': accountsRemoveHelpText,
    investments: investmentsHelpText,
    portfolio: portfolioHelpText,
    budget: budgetHelpText,
    'budget-status': budgetStatusHelpText,
    'budget-move': budgetMoveHelpText,
    'budget-update': budgetUpdateHelpText,
    categories: categoriesHelpText,
    'categories-create': categoriesCreateHelpText,
    'categories-rename': categoriesRenameHelpText,
    'line-items': lineItemsHelpText,
    'line-items-create': lineItemsCreateHelpText,
    'line-items-rename': lineItemsRenameHelpText,
    transactions: transactionsHelpText,
    partner: partnerHelpText,
    'partner-status': partnerStatusHelpText,
    assign: assignHelpText,
    rules: rulesHelpText,
    'rules-get': rulesGetHelpText,
    'rules-set': rulesSetHelpText,
    'rules-delete': rulesDeleteHelpText,
    'rules-scan-contract': rulesScanContractHelpText,
    receipts: receiptsHelpText,
    'receipts-extract': receiptsExtractHelpText,
    'receipts-get': receiptsGetHelpText,
    'receipts-attach': receiptsAttachHelpText,
    'receipts-remove': receiptsRemoveHelpText,
    goals: goalsHelpText,
    'goals-list': goalsListHelpText,
    'goals-create': goalsCreateHelpText,
    'goals-update': goalsUpdateHelpText,
    'goals-mark-spent': goalsMarkSpentHelpText,
    'goals-restore': goalsRestoreHelpText,
    'goals-delete': goalsDeleteHelpText,
    scenarios: scenariosHelpText,
    'scenarios-list': scenariosListHelpText,
    'scenarios-create': scenariosCreateHelpText,
    'scenarios-update': scenariosUpdateHelpText,
    'scenarios-activate': scenariosActivateHelpText,
    'scenarios-delete': scenariosDeleteHelpText,
    'ask-partner': askPartnerHelpText,
  };
  return helpByTopic[topic]();
}

function writeJson(write: (value: string) => void, data: unknown): void {
  write(`${JSON.stringify(data, null, 2)}\n`);
}

function redact(value: string, token: string | undefined): string {
  return token ? value.split(token).join('[REDACTED]') : value;
}

function environmentToken(environment: CliEnvironment): string | undefined {
  const token = environment.SLOTH_AGENT_TOKEN;
  return token?.trim() ? token : undefined;
}

async function defaultReadSecret(): Promise<string> {
  const { default: password } = await import('@inquirer/password');
  return password({
    message: 'Personal access token:',
    mask: '*',
  }, {
    output: process.stderr,
  });
}

async function defaultReadStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function validateLoginToken(value: string): string {
  if (!value.startsWith('sloth_pat_v1_') || /\s/.test(value)) {
    throw new UsageError(
      'Personal access token must use the sloth_pat_v1_ prefix and contain no whitespace',
    );
  }
  return value;
}

function stripStdinLineEnding(value: string): string {
  if (value.endsWith('\r\n')) return value.slice(0, -2);
  if (value.endsWith('\n')) return value.slice(0, -1);
  return value;
}

async function loadCredentialStore(
  getCredentialStore: CredentialStoreFactory,
): Promise<Awaited<ReturnType<CredentialStoreFactory>>> {
  try {
    return await getCredentialStore();
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw secureStorageUnavailableError();
  }
}

async function resolveCredential(
  environment: CliEnvironment,
  origin: string,
  getCredentialStore: CredentialStoreFactory,
): Promise<{ source: 'environment' | 'keychain'; token: string }> {
  const token = environmentToken(environment);
  if (token) return { source: 'environment', token };

  const credentialStore = await loadCredentialStore(getCredentialStore);
  const storedToken = await credentialStore.get(origin);
  if (!storedToken) {
    throw new ConfigError(
      `No credential found for ${origin}. Run "sloth-agent auth login" or set SLOTH_AGENT_TOKEN.`,
    );
  }
  return { source: 'keychain', token: storedToken };
}

function readAssignmentFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Failed to read assignment JSON: ${message}`);
  }
}

function readBudgetFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Failed to read budget JSON: ${message}`);
  }
}

function readNotificationRuleFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Failed to read notification rule JSON: ${message}`);
  }
}

function readContractPdf(filePath: string): Buffer {
  let file: Buffer;
  try {
    file = fs.readFileSync(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Failed to read contract PDF: ${message}`);
  }
  if (file.length === 0 || file.length > MAX_CONTRACT_PDF_BYTES || file.subarray(0, 4).toString() !== '%PDF') {
    throw new UsageError('Contract must be a PDF no larger than 6 MB');
  }
  return file;
}

function readReceiptFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Failed to read receipt JSON: ${message}`);
  }
}

function readReceiptImage(filePath: string): { body: Buffer; mimeType: string } {
  const extension = filePath.toLowerCase().split('.').pop();
  const mimeType = extension === 'jpg' || extension === 'jpeg'
    ? 'image/jpeg'
    : extension === 'png'
      ? 'image/png'
      : extension === 'webp'
        ? 'image/webp'
        : null;
  if (!mimeType) throw new UsageError('Receipt image must be JPEG, PNG, or WebP');
  try {
    const body = fs.readFileSync(filePath);
    if (body.length === 0) throw new UsageError('Receipt image is empty');
    if (body.length > 8 * 1024 * 1024) throw new UsageError('Receipt image must be 8 MB or smaller');
    return { body, mimeType };
  } catch (error) {
    if (error instanceof UsageError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Failed to read receipt image: ${message}`);
  }
}

function buildTransactionsQuery(
  filters: Extract<ParsedCommand, { command: 'transactions' }>['filters'],
): string {
  const params = new URLSearchParams();
  if (filters.uncategorized !== undefined) {
    params.set('uncategorized', String(filters.uncategorized));
  }
  if (filters.includePending !== undefined) {
    params.set('includePending', String(filters.includePending));
  }
  if (filters.shared !== undefined) params.set('shared', String(filters.shared));
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.startDate !== undefined) params.set('startDate', filters.startDate);
  if (filters.endDate !== undefined) params.set('endDate', filters.endDate);
  if (filters.q !== undefined) params.set('q', filters.q);
  if (filters.accountRef !== undefined) params.set('accountRef', filters.accountRef);
  if (filters.categoryId !== undefined) params.set('categoryId', filters.categoryId);
  if (filters.lineItemId !== undefined) params.set('lineItemId', filters.lineItemId);
  if (filters.assignmentScope !== undefined) {
    params.set('assignmentScope', filters.assignmentScope);
  }
  if (filters.cursor !== undefined) params.set('cursor', filters.cursor);
  return params.toString();
}

async function parseHttpResponse(
  response: Response,
  token: string,
): Promise<unknown> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      if (response.ok) throw new ApiError('Agent API returned invalid JSON', response.status);
    }
  }

  if (!response.ok) {
    const message = (
      data
      && typeof data === 'object'
      && 'error' in data
      && typeof data.error === 'string'
    )
      ? data.error
      : `Agent API request failed with status ${response.status}`;
    const code = (
      data
      && typeof data === 'object'
      && 'code' in data
      && typeof data.code === 'string'
    ) ? data.code : undefined;
    throw new ApiError(redact(message, token), response.status, code);
  }
  return data;
}

function requestHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'User-Agent': `sloth-agent/${CLI_VERSION}`,
  };
}

function assignmentIdempotencyKey(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function isRetryableAssignmentRequestError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status !== undefined
      && [408, 425, 429, 499, 500, 502, 503, 504].includes(error.status);
  }
  return error instanceof TypeError
    || (error instanceof Error && error.name === 'AbortError');
}

async function withAssignmentRequestRecovery<T>(
  request: () => Promise<T>,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ASSIGNMENT_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (!isRetryableAssignmentRequestError(error) || attempt === ASSIGNMENT_REQUEST_ATTEMPTS) {
        throw error;
      }
      await sleep(ASSIGNMENT_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}

async function parseAssignmentOperationHttpResponse(
  response: Response,
  token: string,
  expectedStatus: number,
): Promise<AssignmentOperationResponse> {
  const data = await parseHttpResponse(response, token);
  if (response.status !== expectedStatus) {
    throw new ApiError(
      `Agent API returned status ${response.status}; expected ${expectedStatus}`,
      response.status,
    );
  }
  return parseAssignmentOperationResponse(data);
}

function assertAssignmentOperationMatchesPayload(
  operation: AssignmentOperationResponse,
  payload: AssignmentPayload,
  expectedOperationId?: string,
): void {
  if (
    operation.itemCount !== payload.assignments.length
    || (expectedOperationId !== undefined && operation.operationId !== expectedOperationId)
    || (
      operation.status === 'completed'
      && operation.results?.some((result, index) => (
        result.transactionRef !== payload.assignments[index]?.transactionRef
      ))
    )
  ) {
    throw new ApiError(
      'Assignment operation response did not match the submitted assignment order',
    );
  }
}

async function applyAssignments(
  fetchImplementation: typeof globalThis.fetch,
  sleep: (milliseconds: number) => Promise<void>,
  baseUrl: string,
  token: string,
  payload: AssignmentPayload,
): Promise<unknown> {
  const endpoint = `${baseUrl}/api/agent/v1/transaction-assignments`;
  const idempotencyKey = assignmentIdempotencyKey(payload);
  let operation: AssignmentOperationResponse;
  try {
    operation = await withAssignmentRequestRecovery(async () => {
      const response = await fetchImplementation(endpoint, {
        method: 'POST',
        headers: {
          ...requestHeaders(token),
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return parseAssignmentOperationHttpResponse(response, token, 202);
    }, sleep);
  } catch (error) {
    if (!isRetryableAssignmentRequestError(error)) throw error;
    throw new ApiError(
      'Assignment submission could not be confirmed. '
      + 'Re-run the same command with the same assignment input to resume it.',
    );
  }
  assertAssignmentOperationMatchesPayload(operation, payload);
  const operationId = operation.operationId;

  while (operation.status !== 'completed') {
    await sleep(operation.pollAfterMs);
    const statusEndpoint = `${endpoint}/${encodeURIComponent(operationId)}`;
    try {
      const nextOperation = await withAssignmentRequestRecovery(async () => {
        const response = await fetchImplementation(statusEndpoint, {
          method: 'GET',
          headers: requestHeaders(token),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        return parseAssignmentOperationHttpResponse(response, token, 200);
      }, sleep);
      assertAssignmentOperationMatchesPayload(nextOperation, payload, operationId);
      operation = nextOperation;
    } catch (error) {
      if (!isRetryableAssignmentRequestError(error)) throw error;
      throw new ApiError(
        'Assignment status could not be recovered. '
        + 'Re-run the same command with the same assignment input to resume it.',
      );
    }
  }

  return toLegacyAssignmentResponse(operation);
}

async function validateCredentialRemotely(
  fetchImplementation: typeof globalThis.fetch,
  origin: string,
  token: string,
): Promise<void> {
  const response = await fetchImplementation(`${origin}/api/agent/v1/categories`, {
    method: 'GET',
    headers: requestHeaders(token),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  parseApiResponse('categories', await parseHttpResponse(response, token));
}

function maskedTokenSuffix(token: string): string {
  return token.length > 4 ? `…${token.slice(-4)}` : '…';
}

function classifyRemoteStatus(error: unknown): (
  'invalid_or_expired'
  | 'payment_required'
  | 'insufficient_scope'
  | 'unreachable'
) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'invalid_or_expired';
    if (error.status === 402) return 'payment_required';
    if (error.status === 403) return 'insufficient_scope';
  }
  return 'unreachable';
}

function hasFailures(value: unknown): boolean {
  if (!value || typeof value !== 'object' || !('failed' in value)) return false;
  return Array.isArray(value.failed) && value.failed.length > 0;
}

type ScenarioMutationCommand = Extract<ParsedCommand, {
  command:
    | 'scenarios-create'
    | 'scenarios-update'
    | 'scenarios-activate'
    | 'scenarios-delete';
}>;

interface ScenarioRequestDescriptor {
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

function scenarioRequestDescriptor(
  parsed: ScenarioMutationCommand,
  baseUrl: string,
): ScenarioRequestDescriptor {
  const previewEndpoint = `${baseUrl}/api/agent/v1/scenarios/preview`;

  switch (parsed.command) {
    case 'scenarios-create': {
      const scenario = {
        monthKey: parsed.monthKey,
        name: parsed.name,
        accountRef: parsed.accountRef,
        ...(parsed.recurringAmount === undefined
          ? {}
          : { recurringAmount: parsed.recurringAmount }),
        ...(parsed.oneOffAmount === undefined
          ? {}
          : { oneOffAmount: parsed.oneOffAmount }),
      };
      return parsed.apply
        ? { endpoint: `${baseUrl}/api/agent/v1/scenarios`, method: 'POST', body: scenario }
        : {
          endpoint: previewEndpoint,
          method: 'POST',
          body: { action: 'create', scenario },
        };
    }
    case 'scenarios-update': {
      const updates = {
        ...(parsed.name === undefined ? {} : { name: parsed.name }),
        ...(parsed.optionId === undefined ? {} : { optionId: parsed.optionId }),
        ...(parsed.optionLabel === undefined ? {} : { optionLabel: parsed.optionLabel }),
        ...(parsed.accountRef === undefined ? {} : { accountRef: parsed.accountRef }),
        ...(parsed.recurringAmount === undefined
          ? {}
          : { recurringAmount: parsed.recurringAmount }),
        ...(parsed.oneOffAmount === undefined ? {} : { oneOffAmount: parsed.oneOffAmount }),
      };
      return parsed.apply
        ? {
          endpoint: `${baseUrl}/api/agent/v1/scenarios/${encodeURIComponent(parsed.monthKey)}`,
          method: 'PATCH',
          body: updates,
        }
        : {
          endpoint: previewEndpoint,
          method: 'POST',
          body: { action: 'update', monthKey: parsed.monthKey, updates },
        };
    }
    case 'scenarios-activate':
      return parsed.apply
        ? {
          endpoint: `${baseUrl}/api/agent/v1/scenarios/${encodeURIComponent(parsed.monthKey)}/activate`,
          method: 'POST',
          body: { optionId: parsed.optionId },
        }
        : {
          endpoint: previewEndpoint,
          method: 'POST',
          body: { action: 'activate', monthKey: parsed.monthKey, optionId: parsed.optionId },
        };
    case 'scenarios-delete':
      return parsed.apply
        ? {
          endpoint: `${baseUrl}/api/agent/v1/scenarios/${encodeURIComponent(parsed.monthKey)}`,
          method: 'DELETE',
        }
        : {
          endpoint: previewEndpoint,
          method: 'POST',
          body: { action: 'delete', monthKey: parsed.monthKey },
        };
  }
}

export async function runCli(
  argv: string[] = process.argv.slice(2),
  options: CliOptions = {},
): Promise<number> {
  const environment = options.env ?? process.env;
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const getCredentialStore = options.getCredentialStore ?? createSystemCredentialStore;
  const isInteractive = options.isInteractive
    ?? Boolean(process.stdin.isTTY && process.stderr.isTTY);
  const readSecret = options.readSecret ?? defaultReadSecret;
  const readStdin = options.readStdin ?? defaultReadStdin;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  const writeStdout = options.writeStdout ?? ((value: string) => process.stdout.write(value));
  const writeStderr = options.writeStderr ?? ((value: string) => process.stderr.write(value));
  let token: string | undefined;

  try {
    const parsed = parseArgs(argv);
    if (parsed.command === 'help') {
      writeStdout(`${parsed.topic ? commandHelpText(parsed.topic) : usageText()}\n`);
      return 0;
    }
    if (parsed.command === 'version') {
      writeStdout(`${CLI_VERSION}\n`);
      return 0;
    }

    const baseUrl = resolveBaseUrl(environment, parsed.baseUrl);

    if (parsed.command === 'auth-login') {
      if (parsed.input === 'prompt' && !isInteractive) {
        throw new UsageError(
          'Interactive login requires a TTY. Use --token-stdin or --from-env.',
        );
      }

      let rawToken: string;
      if (parsed.input === 'environment') {
        const tokenFromEnvironment = environmentToken(environment);
        if (!tokenFromEnvironment) {
          throw new ConfigError('SLOTH_AGENT_TOKEN is required with --from-env');
        }
        rawToken = tokenFromEnvironment;
      } else {
        rawToken = await (parsed.input === 'stdin' ? readStdin() : readSecret());
        if (parsed.input === 'stdin') rawToken = stripStdinLineEnding(rawToken);
      }

      token = validateLoginToken(rawToken);
      await validateCredentialRemotely(fetchImplementation, baseUrl, token);
      const credentialStore = await loadCredentialStore(getCredentialStore);
      await credentialStore.set(baseUrl, token);
      const environmentOverrideActive = environmentToken(environment) !== undefined;
      writeJson(writeStdout, {
        activeSource: environmentOverrideActive ? 'environment' : 'keychain',
        environmentOverrideActive,
        origin: baseUrl,
        stored: true,
      });
      return 0;
    }

    if (parsed.command === 'auth-status') {
      const credential = await resolveCredential(environment, baseUrl, getCredentialStore);
      token = credential.token;
      let remoteStatus: 'valid' | ReturnType<typeof classifyRemoteStatus> = 'valid';
      let exitCode = 0;
      try {
        await validateCredentialRemotely(fetchImplementation, baseUrl, token);
      } catch (error) {
        remoteStatus = classifyRemoteStatus(error);
        exitCode = 1;
      }
      writeJson(writeStdout, {
        origin: baseUrl,
        remoteStatus,
        source: credential.source,
        tokenSuffix: maskedTokenSuffix(token),
      });
      return exitCode;
    }

    if (parsed.command === 'auth-logout') {
      const credentialStore = await loadCredentialStore(getCredentialStore);
      const localCredentialRemoved = await credentialStore.delete(baseUrl);
      writeJson(writeStdout, {
        environmentOverrideActive: environmentToken(environment) !== undefined,
        localCredentialRemoved,
        origin: baseUrl,
        remoteRevoked: false,
        revocationInstructions: 'Revoke the token in Sloth Money Settings > Developer access.',
      });
      return 0;
    }

    if (parsed.command === 'accounts-update' && !parsed.apply) {
      const endpoint = `${baseUrl}/api/agent/v1/accounts/${encodeURIComponent(parsed.accountRef)}`;
      writeJson(writeStdout, {
        dryRun: true,
        endpoint,
        method: 'PATCH',
        payload: parsed.update,
      });
      return 0;
    }
    if (parsed.command === 'accounts-remove' && !parsed.apply) {
      const endpoint = `${baseUrl}/api/agent/v1/accounts/${encodeURIComponent(parsed.accountRef)}`;
      writeJson(writeStdout, {
        dryRun: true,
        endpoint,
        method: 'DELETE',
      });
      return 0;
    }

    const budgetUpdatePayload = parsed.command === 'budget-update'
      ? validateBudgetUpdatePayload(readBudgetFile(parsed.input))
      : undefined;
    if (parsed.command === 'budget-update' && !parsed.apply) {
      writeJson(writeStdout, {
        dryRun: true,
        endpoint: `${baseUrl}/api/agent/v1/budgets`,
        method: 'PATCH',
        payload: {
          scope: parsed.scope,
          ...(parsed.periodKey === undefined ? {} : { periodKey: parsed.periodKey }),
          ...budgetUpdatePayload,
        },
      });
      return 0;
    }
    const budgetMovementPayload = parsed.command === 'budget-move'
      ? {
        scope: parsed.scope,
        ...(parsed.periodKey === undefined ? {} : { periodKey: parsed.periodKey }),
        fromCategoryId: parsed.fromCategoryId,
        toCategoryId: parsed.toCategoryId,
        amountPence: parsed.amountPence,
      }
      : undefined;
    if (parsed.command === 'budget-move' && !parsed.apply) {
      writeJson(writeStdout, {
        dryRun: true,
        endpoint: `${baseUrl}/api/agent/v1/budget-movements`,
        method: 'POST',
        payload: budgetMovementPayload,
      });
      return 0;
    }
    const assignmentPayload = parsed.command === 'assign'
      ? validateAssignmentPayload(readAssignmentFile(parsed.input))
      : undefined;
    if (parsed.command === 'assign' && !parsed.apply) {
      writeJson(writeStdout, {
        dryRun: true,
        endpoint: `${baseUrl}/api/agent/v1/transaction-assignments`,
        payload: assignmentPayload,
      });
      return 0;
    }
    const receiptConfirmation = parsed.command === 'receipts-attach'
      ? validateReceiptConfirmation(readReceiptFile(parsed.input))
      : undefined;
    if (parsed.command === 'receipts-attach' && !parsed.apply) {
      writeJson(writeStdout, {
        dryRun: true,
        endpoint: `${baseUrl}/api/agent/v1/receipts/confirmed`,
        method: 'PUT',
        payload: {
          transactionRef: parsed.transactionRef,
          expectedRevision: parsed.expectedRevision ?? null,
          receipt: receiptConfirmation,
        },
      });
      return 0;
    }
    if (parsed.command === 'receipts-remove' && !parsed.apply) {
      writeJson(writeStdout, {
        dryRun: true,
        endpoint: `${baseUrl}/api/agent/v1/receipts/confirmed`,
        method: 'DELETE',
        payload: {
          transactionRef: parsed.transactionRef,
          expectedRevision: parsed.revision,
        },
      });
      return 0;
    }

    const notificationRulePayload = parsed.command === 'rules-set'
      ? validateNotificationRulePayload(readNotificationRuleFile(parsed.input))
      : undefined;
    const notificationRuleEndpoint = (
      parsed.command === 'rules-get'
      || parsed.command === 'rules-set'
      || parsed.command === 'rules-delete'
    )
      ? `${baseUrl}/api/agent/v1/notification-rules/for-transaction?${new URLSearchParams({
        transactionRef: parsed.transactionRef,
      }).toString()}`
      : undefined;
    if (parsed.command === 'rules-set' && !parsed.apply) {
      writeJson(writeStdout, {
        dryRun: true,
        endpoint: notificationRuleEndpoint,
        method: 'PUT',
        payload: { transactionRef: parsed.transactionRef, ...notificationRulePayload! },
      });
      return 0;
    }
    if (parsed.command === 'rules-delete' && !parsed.apply) {
      writeJson(writeStdout, {
        dryRun: true,
        endpoint: notificationRuleEndpoint,
        method: 'DELETE',
      });
      return 0;
    }
    if (parsed.command === 'rules-scan-contract' && !parsed.apply) {
      const contract = readContractPdf(parsed.contract);
      writeJson(writeStdout, {
        dryRun: true,
        endpoint: `${baseUrl}/api/agent/v1/notification-rules/extract-renewal`,
        method: 'POST',
        contract: { bytes: contract.length, mimeType: 'application/pdf' },
      });
      return 0;
    }

    const credential = await resolveCredential(environment, baseUrl, getCredentialStore);
    token = credential.token;
    const headers = requestHeaders(token);

    if (parsed.command === 'receipts-extract') {
      const image = readReceiptImage(parsed.image);
      const response = await fetchImplementation(`${baseUrl}/api/agent/v1/receipts/extract`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': image.mimeType },
        body: image.body as unknown as BodyInit,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse(
        parsed.command,
        await parseHttpResponse(response, token),
      );
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'receipts-get') {
      const query = new URLSearchParams({ transactionRef: parsed.transactionRef });
      const response = await fetchImplementation(
        `${baseUrl}/api/agent/v1/receipts/confirmed?${query.toString()}`,
        {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      const data = parseApiResponse(parsed.command, await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'receipts-attach') {
      const response = await fetchImplementation(`${baseUrl}/api/agent/v1/receipts/confirmed`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionRef: parsed.transactionRef,
          expectedRevision: parsed.expectedRevision ?? null,
          receipt: receiptConfirmation!,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse(parsed.command, await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'receipts-remove') {
      const response = await fetchImplementation(`${baseUrl}/api/agent/v1/receipts/confirmed`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionRef: parsed.transactionRef,
          expectedRevision: parsed.revision,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse(parsed.command, await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'accounts-update') {
      const endpoint = `${baseUrl}/api/agent/v1/accounts/${encodeURIComponent(parsed.accountRef)}`;
      const response = await fetchImplementation(endpoint, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.update),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse(
        parsed.command,
        await parseHttpResponse(response, token),
      );
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'accounts-remove') {
      const endpoint = `${baseUrl}/api/agent/v1/accounts/${encodeURIComponent(parsed.accountRef)}`;
      const response = await fetchImplementation(endpoint, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse(
        parsed.command,
        await parseHttpResponse(response, token),
      );
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'budget-update') {
      const payload = {
        scope: parsed.scope,
        ...(parsed.periodKey === undefined ? {} : { periodKey: parsed.periodKey }),
        ...budgetUpdatePayload!,
      };
      const response = await fetchImplementation(`${baseUrl}/api/agent/v1/budgets`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse(
        parsed.command,
        await parseHttpResponse(response, token),
      );
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'budget-move') {
      const response = await fetchImplementation(`${baseUrl}/api/agent/v1/budget-movements`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetMovementPayload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = validateBudgetMovementResponse(
        await parseHttpResponse(response, token),
        budgetMovementPayload!,
      );
      writeJson(writeStdout, data);
      return 0;
    }

    if (
      parsed.command === 'categories-create'
      || parsed.command === 'categories-rename'
      || parsed.command === 'line-items-create'
      || parsed.command === 'line-items-rename'
    ) {
      const isCategory = parsed.command.startsWith('categories-');
      const isCreate = parsed.command.endsWith('-create');
      const resourceId = parsed.command === 'categories-rename'
        ? parsed.categoryId
        : parsed.command === 'line-items-rename'
          ? parsed.lineItemId
          : null;
      const endpoint = isCreate
        ? `${baseUrl}/api/agent/v1/${isCategory ? 'categories' : 'line-items'}`
        : `${baseUrl}/api/agent/v1/${isCategory ? 'categories' : 'line-items'}/${encodeURIComponent(
          resourceId!,
        )}`;
      const payload = parsed.command === 'categories-create'
        ? { name: parsed.name, iconKey: parsed.iconKey, categoryType: parsed.categoryType }
        : parsed.command === 'categories-rename'
          ? { name: parsed.name }
          : { scope: parsed.scope, categoryId: parsed.categoryId, name: parsed.name };
      const method = isCreate ? 'POST' : 'PATCH';
      if (!parsed.apply) {
        writeJson(writeStdout, { dryRun: true, endpoint, method, payload });
        return 0;
      }
      const response = await fetchImplementation(endpoint, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse(parsed.command, await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'goals-create') {
      const endpoint = `${baseUrl}/api/agent/v1/goals${parsed.apply ? '' : '/preview'}`;
      const payload = {
        name: parsed.name,
        targetAmount: parsed.targetAmount,
        ...(parsed.targetMonthKey === undefined
          ? {}
          : { targetMonthKey: parsed.targetMonthKey }),
        goalType: parsed.goalType,
        fundingAccountRef: parsed.fundingAccountRef,
        ...(parsed.priority === undefined ? {} : { priority: parsed.priority }),
      };

      const response = await fetchImplementation(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse(
        parsed.apply ? 'goals-create' : 'goals-preview',
        await parseHttpResponse(response, token),
      );
      writeJson(writeStdout, data);
      return 0;
    }

    if (
      parsed.command === 'goals-update'
      || parsed.command === 'goals-mark-spent'
      || parsed.command === 'goals-restore'
    ) {
      const endpoint = `${baseUrl}/api/agent/v1/goals/${encodeURIComponent(parsed.goalId)}`;
      const payload = parsed.command === 'goals-update'
        ? {
          ...(parsed.name === undefined ? {} : { name: parsed.name }),
          ...(parsed.targetAmount === undefined
            ? {}
            : { targetAmount: parsed.targetAmount }),
          ...(parsed.targetMonthKey === undefined
            ? {}
            : { targetMonthKey: parsed.targetMonthKey }),
          ...(parsed.goalType === undefined
            ? {}
            : { goalType: parsed.goalType }),
          ...(parsed.fundingAccountRef === undefined
            ? {}
            : { fundingAccountRef: parsed.fundingAccountRef }),
          ...(parsed.priority === undefined
            ? {}
            : { priority: parsed.priority }),
        }
        : { isSpent: parsed.command === 'goals-mark-spent' };
      if (!parsed.apply) {
        writeJson(writeStdout, {
          dryRun: true,
          endpoint,
          method: 'PATCH',
          payload,
        });
        return 0;
      }

      const response = await fetchImplementation(endpoint, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse(
        parsed.command,
        await parseHttpResponse(response, token),
      );
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'goals-delete') {
      const endpoint = `${baseUrl}/api/agent/v1/goals/${encodeURIComponent(parsed.goalId)}`;
      if (!parsed.apply) {
        writeJson(writeStdout, {
          dryRun: true,
          endpoint,
          method: 'DELETE',
        });
        return 0;
      }

      const response = await fetchImplementation(endpoint, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse(
        'goals-delete',
        await parseHttpResponse(response, token),
      );
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'scenarios-list') {
      const response = await fetchImplementation(
        `${baseUrl}/api/agent/v1/scenarios`,
        {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      writeJson(
        writeStdout,
        parseApiResponse('scenarios-list', await parseHttpResponse(response, token)),
      );
      return 0;
    }

    if (
      parsed.command === 'scenarios-create'
      || parsed.command === 'scenarios-update'
      || parsed.command === 'scenarios-activate'
      || parsed.command === 'scenarios-delete'
    ) {
      const request = scenarioRequestDescriptor(parsed, baseUrl);
      const response = await fetchImplementation(request.endpoint, {
        method: request.method,
        headers: request.body === undefined
          ? headers
          : { ...headers, 'Content-Type': 'application/json' },
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      writeJson(
        writeStdout,
        parseApiResponse(
          'scenarios-mutation',
          await parseHttpResponse(response, token),
        ),
      );
      return 0;
    }

    if (parsed.command === 'assign') {
      const payload = assignmentPayload!;
      const data = await applyAssignments(fetchImplementation, sleep, baseUrl, token, payload);
      writeJson(writeStdout, data);
      return hasFailures(data) ? 1 : 0;
    }

    if (parsed.command === 'rules-list') {
      const response = await fetchImplementation(`${baseUrl}/api/agent/v1/notification-rules`, {
        method: 'GET', headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      writeJson(writeStdout, parseApiResponse('rules-list', await parseHttpResponse(response, token)));
      return 0;
    }

    if (parsed.command === 'rules-get') {
      const response = await fetchImplementation(notificationRuleEndpoint!, {
        method: 'GET', headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      writeJson(writeStdout, parseApiResponse('rules-get', await parseHttpResponse(response, token)));
      return 0;
    }

    if (parsed.command === 'rules-set') {
      const response = await fetchImplementation(notificationRuleEndpoint!, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionRef: parsed.transactionRef, ...notificationRulePayload! }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      writeJson(writeStdout, parseApiResponse('rules-set', await parseHttpResponse(response, token)));
      return 0;
    }

    if (parsed.command === 'rules-delete') {
      const response = await fetchImplementation(notificationRuleEndpoint!, {
        method: 'DELETE', headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      writeJson(writeStdout, parseApiResponse('rules-delete', await parseHttpResponse(response, token)));
      return 0;
    }

    if (parsed.command === 'rules-scan-contract') {
      const contract = readContractPdf(parsed.contract);
      const response = await fetchImplementation(
        `${baseUrl}/api/agent/v1/notification-rules/extract-renewal`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: nodePath.basename(parsed.contract),
            mimeType: 'application/pdf',
            contentBase64: contract.toString('base64'),
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      writeJson(writeStdout, parseApiResponse('rules-scan-contract', await parseHttpResponse(response, token)));
      return 0;
    }

    if (parsed.command === 'ask-partner') {
      const response = await fetchImplementation(
        `${baseUrl}/api/agent/v1/transaction-explanation-requests`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transactionRef: parsed.transactionRef }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      const data = parseApiResponse('ask-partner', await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'goals-list') {
      const response = await fetchImplementation(
        `${baseUrl}/api/agent/v1/goals`,
        {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      const data = parseApiResponse(
        'goals-list',
        await parseHttpResponse(response, token),
      );
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'budget' || parsed.command === 'budget-status') {
      const query = new URLSearchParams({ scope: parsed.scope });
      if (parsed.periodKey !== undefined) {
        query.set('periodKey', parsed.periodKey);
      }
      const response = await fetchImplementation(
        `${baseUrl}/api/agent/v1/${parsed.command === 'budget' ? 'budgets' : 'budget-status'}?${query.toString()}`,
        {
          method: 'GET',
          headers: parsed.command === 'budget-status'
            ? { ...headers, Prefer: 'wait=45' }
            : headers,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      const data = parseApiResponse(parsed.command, await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return 0;
    }

    if (parsed.command === 'partner-status') {
      const query = new URLSearchParams();
      if (parsed.limit !== undefined) query.set('limit', String(parsed.limit));
      if (parsed.cursor !== undefined) query.set('cursor', parsed.cursor);
      const suffix = query.size > 0 ? `?${query.toString()}` : '';
      const response = await fetchImplementation(
        `${baseUrl}/api/agent/v1/partner-status${suffix}`,
        {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      const data = parseApiResponse('partner-status', await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return 0;
    }

    const path = parsed.command === 'accounts'
      ? '/api/agent/v1/accounts'
      : parsed.command === 'portfolio'
        ? `/api/agent/v1/portfolio?${new URLSearchParams({ view: parsed.view }).toString()}`
      : parsed.command === 'investments'
        ? `/api/agent/v1/investments${parsed.accountRef
          ? `?${new URLSearchParams({ accountRef: parsed.accountRef }).toString()}`
          : ''}`
      : parsed.command === 'categories'
        ? '/api/agent/v1/categories'
        : `/api/agent/v1/transactions${(() => {
        const query = buildTransactionsQuery(parsed.filters);
        return query ? `?${query}` : '';
      })()}`;
    const response = await fetchImplementation(`${baseUrl}${path}`, {
      method: 'GET',
      headers: parsed.command === 'transactions' || parsed.command === 'portfolio'
        ? { ...headers, Prefer: 'wait=45' }
        : headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = parseApiResponse(parsed.command, await parseHttpResponse(response, token));
    writeJson(writeStdout, data);
    return 0;
  } catch (error) {
    const exitCode = error instanceof CliError ? error.exitCode : 1;
    const message = error instanceof Error ? error.message : String(error);
    const prefix = error instanceof ApiError && error.code ? `${error.code}: ` : '';
    writeStderr(`${prefix}${redact(message, token)}\n`);
    return exitCode;
  }
}
