import fs from 'node:fs';

import {
  type CliEnvironment,
  type HelpTopic,
  type ParsedCommand,
  parseArgs,
  resolveBaseUrl,
} from './args.js';
import { ICON_KEYS } from './category-metadata.js';
import {
  parseApiResponse,
  validateAssignmentPayload,
  validateBudgetMovementResponse,
  validateBudgetUpdatePayload,
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

export const CLI_VERSION = '0.11.0';
const REQUEST_TIMEOUT_MS = 60_000;
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
  writeStdout?: (value: string) => void;
  writeStderr?: (value: string) => void;
}

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
    '  sloth-agent budget --scope personal|joint [--period YYYY-MM] [--base-url URL]',
    '  sloth-agent budget update --scope personal|joint [--period YYYY-MM]',
    '    --input budget.json [--apply] [--base-url URL]',
    '  sloth-agent budget move --scope personal|joint [--period YYYY-MM]',
    '    --from-category-id ID --to-category-id ID --amount AMOUNT [--apply]',
    '  sloth-agent categories [list] [--base-url URL]',
    '  sloth-agent categories create --name NAME --icon-key KEY --type TYPE [--apply]',
    '  sloth-agent categories rename --category-id ID --name NAME [--apply]',
    '  sloth-agent line-items create --scope personal|joint --category-id ID --name NAME [--apply]',
    '  sloth-agent line-items rename --scope personal|joint --category-id ID --line-item-id ID --name NAME [--apply]',
    '  sloth-agent transactions [--uncategorized[=true|false]] [--limit N]',
    '    [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--q TEXT]',
    '    [--account-id ID] [--category-id ID] [--line-item-id ID]',
    '    [--cursor CURSOR] [--base-url URL]',
    '  sloth-agent assign --input assignments.json [--apply] [--base-url URL]',
    '  sloth-agent goals [list] [--base-url URL]',
    '  sloth-agent goals create --name NAME --target-amount AMOUNT',
    '    --type keep|spend [--target-month YYYY-MM] [--apply] [--base-url URL]',
    '  sloth-agent goals update --goal-id ID [fields] [--apply] [--base-url URL]',
    '  sloth-agent goals mark-spent --goal-id ID [--apply] [--base-url URL]',
    '  sloth-agent goals restore --goal-id ID [--apply] [--base-url URL]',
    '  sloth-agent goals delete --goal-id ID [--apply] [--base-url URL]',
    '  sloth-agent ask-partner --transaction-ref REF [--base-url URL]',
    '',
    'Help:',
    '  Run sloth-agent <command> --help for options, inputs, output, and examples.',
    '  Auth and goal subcommands also have help, for example:',
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

export function accountsHelpText(): string {
  return [
    'Sloth Agent CLI — accounts',
    '',
    'Read the existing Sloth account inventory known to the authenticated user.',
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
    '  accounts[].isGoalSavingsSource whether the owner uses it for goal savings',
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
    '  --goal-savings-source true|false   Goal-savings membership.',
    '',
    'Write behavior:',
    '  Without --apply, returns a JSON preview without credentials or a network request.',
    '  With --apply, requires agent:write on a write-enabled token and updates saved Sloth metadata.',
    '  Connected accounts support only --goal-savings-source.',
    '  Manual current accounts cannot change type, balance, or goal-savings membership.',
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

export function budgetHelpText(): string {
  return [
    'Sloth Agent CLI — budget',
    '',
    'Read one personal or joint budget period.',
    '',
    'Usage:',
    '  sloth-agent budget --scope personal|joint [--period YYYY-MM] [--base-url URL]',
    '',
    'Options:',
    '  --scope personal|joint  Required. Budget ownership scope.',
    '  --period YYYY-MM        Optional. Defaults to the current Sloth budget period.',
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
    '  --limit N                     Optional. Integer from 1 to 200; omit for API default.',
    '  --start-date YYYY-MM-DD        Optional. Include transactions on or after this date.',
    '  --end-date YYYY-MM-DD          Optional. Include transactions on or before this date.',
    '  --q TEXT                       Optional. Search transactions by text.',
    '  --account-id ID                Optional. Filter by account ID.',
    '  --category-id ID               Optional. Filter by category ID.',
    '  --line-item-id ID              Optional. Filter primary or split assignments by line-item ID.',
    '  --assignment-scope SCOPE        Optional. Filter assignments by personal or joint.',
    '                                  Personal is used when omitted.',
    '  --cursor CURSOR                Optional. Continue from a previous nextCursor.',
    '  --base-url URL                 Optional. Override the API origin.',
    '  -h, --help                     Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Constraints:',
    '  All filters are omitted by default.',
    '  --end-date must not be before --start-date.',
    '  The first transaction read each UTC day may refresh linked bank data.',
    '  Refresh remotely persists booked transactions and account balances.',
    '  The command waits up to 45 seconds, then returns cached data if refresh continues.',
    '',
    'Output:',
    '  JSON containing transactions, nextCursor, and structured refresh status.',
    '  Refresh failures do not hide readable cached transactions.',
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
    '  sloth-agent transactions --q "tesco" --start-date 2026-05-01 --end-date 2026-05-31',
  ].join('\n');
}

export function assignHelpText(): string {
  return [
    'Sloth Agent CLI — assign',
    '',
    'An assignment categorises an existing transaction e.g. assigning category Groceries to a transaction.',
    'Validate, preview, or apply category assignments from a JSON file.',
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
    '  With --apply, assignments are best-effort; any failed item makes the command',
    '  exit with code 1 while the complete result remains available on stdout.',
    '  Applying requires a write-enabled token created with Allow changes.',
    '',
    'Input:',
    '  The top-level object must contain an assignments array.',
    '  Each assignment requires transactionRef and a categoryId or non-empty categorySplits.',
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
    '  Personal is used when assignmentScope is omitted.',
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
    '        "assignmentScope": "personal",',
    '        "categoryId": "PASTE_A_CATEGORY_ID_HERE",',
    '        "lineItemId": "PASTE_A_LINE_ITEM_ID_HERE"',
    '      }',
    '    ]',
    '  }',
    '  These are placeholders. Replace all three values with exact IDs from CLI output.',
    '',
    'Output:',
    '  Preview mode returns dryRun, endpoint, and the validated payload.',
    '  Apply mode returns succeeded and failed assignment arrays.',
    '  Successful assignments update the original transaction. See the result in',
    '  Sloth Money → Transactions or read the transaction again through the CLI.',
    '  Assignments do not create a separate list.',
  ].join('\n');
}

export function goalsHelpText(): string {
  return [
    'Sloth Agent CLI — goals',
    '',
    'List, create, update, mark spent, restore, or delete your savings goals.',
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
    '  JSON containing currency and goals. Each goal contains id, name, priority,',
    '  targetAmount, targetMonthKey, goalType, nullable spentAt, and',
    '  sharedWithPartner.',
  ].join('\n');
}

export function goalsCreateHelpText(): string {
  return [
    'Sloth Agent CLI — goals create',
    '',
    'Preview or create a goal.',
    '',
    'Usage:',
    '  sloth-agent goals create --name NAME --target-amount AMOUNT --type keep|spend [options]',
    '',
    'Options:',
    '  --name NAME                 Required. Goal name, 1 to 200 characters.',
    '  --target-amount AMOUNT      Required. Positive major-unit amount with up to 2 decimals.',
    '  --type keep|spend           Required. Keep reserves funded money; Spend is spent later.',
    '  --target-month YYYY-MM      Optional. Target calendar month.',
    '  --apply                     Optional. Create the goal in Sloth Money.',
    '  --base-url URL              Optional. Override the API origin.',
    '  -h, --help                  Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Safety:',
    '  Without --apply, the command returns a dry-run preview and does not write.',
    '  Applying requires a write-enabled token created with Allow changes.',
    '  New goals are private to the owner and appended to the existing goal order.',
    '',
    'Example:',
    '  sloth-agent goals create --name "Emergency fund" --target-amount 12000 --type keep',
    '  sloth-agent goals create --name "Wedding" --target-amount 22000 --type spend --target-month 2027-06 --apply',
    '',
    'Output:',
    '  Preview mode returns dryRun, method, endpoint, and payload.',
    '  Apply mode returns the persisted goal and currency from the 201 response.',
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
    '  --priority POSITION          Optional. Positive whole-number position; 1 is highest.',
    '  --apply                      Optional. Write the partial update.',
    '  --base-url URL               Optional. Override the API origin.',
    '  -h, --help                   Show this help.',
    ...API_ORIGIN_HELP_LINES,
    '',
    'Constraints:',
    '  Provide at least one field to update.',
    '  Priority must be updated on its own.',
    '  Priority 1 is highest. The position cannot exceed the current goal count.',
    '  Moving a goal shifts the intervening goals automatically.',
    '  Forecast assignments and shared progress refresh when the owner next opens',
    '  the Forecast screen.',
    '  Set and clear target-month options are mutually exclusive.',
    '  Restore a spent goal before changing its type.',
    '  Change active shared pot target amounts in the Sloth Budget app, where',
    '  account balances can be reconciled across goals in priority order.',
    '  Sharing remains app-managed. Updates to an already shared goal remain visible',
    '  to the connected partner.',
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
    '  Apply mode returns the complete persisted goal and currency.',
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
    budget: budgetHelpText,
    'budget-move': budgetMoveHelpText,
    'budget-update': budgetUpdateHelpText,
    categories: categoriesHelpText,
    'categories-create': categoriesCreateHelpText,
    'categories-rename': categoriesRenameHelpText,
    'line-items-create': lineItemsCreateHelpText,
    'line-items-rename': lineItemsRenameHelpText,
    transactions: transactionsHelpText,
    assign: assignHelpText,
    goals: goalsHelpText,
    'goals-list': goalsListHelpText,
    'goals-create': goalsCreateHelpText,
    'goals-update': goalsUpdateHelpText,
    'goals-mark-spent': goalsMarkSpentHelpText,
    'goals-restore': goalsRestoreHelpText,
    'goals-delete': goalsDeleteHelpText,
    'ask-partner': askPartnerHelpText,
  };
  return helpByTopic[topic]();
}

function writeJson(write: (value: string) => void, data: unknown): void {
  write(`${JSON.stringify(data, null, 2)}\n`);
}

function withListedGoalPriorities(value: unknown): unknown {
  const response = value as Record<string, unknown> & {
    goals: Array<Record<string, unknown>>;
  };
  return {
    ...response,
    goals: response.goals.map((goal, index) => ({
      ...goal,
      priority: index + 1,
    })),
  };
}

function withUpdatedGoalPriority(value: unknown, priority: number): unknown {
  const response = value as Record<string, unknown> & {
    goal: Record<string, unknown>;
  };
  return {
    ...response,
    goal: { ...response.goal, priority },
  };
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

function buildTransactionsQuery(
  filters: Extract<ParsedCommand, { command: 'transactions' }>['filters'],
): string {
  const params = new URLSearchParams();
  if (filters.uncategorized !== undefined) {
    params.set('uncategorized', String(filters.uncategorized));
  }
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.startDate !== undefined) params.set('startDate', filters.startDate);
  if (filters.endDate !== undefined) params.set('endDate', filters.endDate);
  if (filters.q !== undefined) params.set('q', filters.q);
  if (filters.accountId !== undefined) params.set('accountId', filters.accountId);
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
    throw new ApiError(redact(message, token), response.status);
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

    const credential = await resolveCredential(environment, baseUrl, getCredentialStore);
    token = credential.token;
    const headers = requestHeaders(token);

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
      const endpoint = `${baseUrl}/api/agent/v1/goals`;
      const payload = {
        name: parsed.name,
        targetAmount: parsed.targetAmount,
        ...(parsed.targetMonthKey === undefined
          ? {}
          : { targetMonthKey: parsed.targetMonthKey }),
        goalType: parsed.goalType,
      };
      if (!parsed.apply) {
        writeJson(writeStdout, {
          dryRun: true,
          endpoint,
          method: 'POST',
          payload,
        });
        return 0;
      }

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
        'goals-create',
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
      writeJson(
        writeStdout,
        parsed.command !== 'goals-update' || parsed.priority === undefined
          ? data
          : withUpdatedGoalPriority(data, parsed.priority),
      );
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

    if (parsed.command === 'assign') {
      const payload = validateAssignmentPayload(readAssignmentFile(parsed.input));
      const endpoint = `${baseUrl}/api/agent/v1/transaction-assignments`;
      if (!parsed.apply) {
        writeJson(writeStdout, { dryRun: true, endpoint, payload });
        return 0;
      }
      const response = await fetchImplementation(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse('assign', await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return hasFailures(data) ? 1 : 0;
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
      writeJson(writeStdout, withListedGoalPriorities(data));
      return 0;
    }

    if (parsed.command === 'budget') {
      const query = new URLSearchParams({ scope: parsed.scope });
      if (parsed.periodKey !== undefined) query.set('periodKey', parsed.periodKey);
      const response = await fetchImplementation(
        `${baseUrl}/api/agent/v1/budgets?${query.toString()}`,
        {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      const data = parseApiResponse('budget', await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return 0;
    }

    const path = parsed.command === 'accounts'
      ? '/api/agent/v1/accounts'
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
      headers: parsed.command === 'transactions'
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
    writeStderr(`${redact(message, token)}\n`);
    return exitCode;
  }
}
