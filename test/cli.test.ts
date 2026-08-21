import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CLI_VERSION,
  runCli,
} from '../src/cli.js';
import {
  agentApiV1AccountsResponse,
  agentApiV1AccountMutationResponse,
  agentApiV1AccountRemovalResponse,
  agentApiV1AssignmentResponse,
  agentApiV1BudgetMovementResponse,
  agentApiV1BudgetResponse,
  agentApiV1BudgetStatusResponse,
  agentApiV1CategoriesResponse,
  agentApiV1CategoryMutationResponse,
  agentApiV1ExplanationResponse,
  agentApiV1GoalDeleteResponse,
  agentApiV1GoalMutationResponse,
  agentApiV1GoalsResponse,
  agentApiV1LineItemMutationResponse,
  agentApiV1InvestmentsResponse,
  agentApiV1TransactionsResponse,
} from './fixtures/agent-api-v1.js';

const tempDirectories: string[] = [];
const passwordPrompt = vi.hoisted(() => vi.fn());

vi.mock('@inquirer/password', () => ({
  default: passwordPrompt,
}));

afterEach(() => {
  vi.restoreAllMocks();
  passwordPrompt.mockReset();
  for (const directory of tempDirectories) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
  tempDirectories.length = 0;
});

function createIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    writeStdout(value: string) {
      stdout.push(value);
    },
    writeStderr(value: string) {
      stderr.push(value);
    },
  };
}

function writeAssignments(payload: unknown): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sloth-agent-test-'));
  tempDirectories.push(directory);
  const filePath = path.join(directory, 'assignments.json');
  fs.writeFileSync(filePath, JSON.stringify(payload));
  return filePath;
}

function writeNotificationRule(payload: unknown): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sloth-agent-rule-test-'));
  tempDirectories.push(directory);
  const filePath = path.join(directory, 'rule.json');
  fs.writeFileSync(filePath, JSON.stringify(payload));
  return filePath;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CLI execution', () => {
  it('previews notification rule writes locally without credentials or network', async () => {
    const io = createIo();
    const fetchMock = vi.fn();
    const input = writeNotificationRule({
      amountChange: { enabled: true, comparison: 'increase', baselinePence: 3184 },
      renewalReminder: { enabled: true, renewalDate: '2027-07-30', leadDays: 30 },
      delivery: { inApp: true, email: true },
    });
    expect(await runCli([
      'rules', 'set', '--transaction-ref', 'sloth_txn_example', '--input', input,
    ], { env: {}, fetch: fetchMock as typeof fetch, ...io })).toBe(0);
    expect(JSON.parse(io.stdout.join(''))).toMatchObject({
      dryRun: true,
      method: 'PUT',
      payload: { transactionRef: 'sloth_txn_example', delivery: { inApp: true, email: true } },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prints help and version without requiring a token', async () => {
    const helpIo = createIo();
    expect(await runCli(['--help'], { env: {}, ...helpIo })).toBe(0);
    expect(helpIo.stdout.join('')).toContain('sloth-agent transactions');
    expect(helpIo.stdout.join('')).toContain('[--account-ref REF] [--account-id ID]');
    expect(helpIo.stdout.join('')).toContain('sloth-agent accounts');
    expect(helpIo.stdout.join('')).toContain('Every nested subcommand has its own help');
    expect(helpIo.stdout.join('')).toContain('view-only');
    expect(helpIo.stderr).toEqual([]);

    const fetchMock = vi.fn();
    const getCredentialStore = vi.fn();
    const helpCases: Array<[string[], string[]]> = [
      [['auth', '--help'], ['auth login', 'auth status', 'auth logout']],
      [['auth', 'login', '--help'], [
        '--token-stdin',
        '--from-env',
        'hidden prompt',
        'sloth_pat_v1_',
        'only after remote validation succeeds',
        'Allow changes',
        'agent:write',
      ]],
      [['auth', 'status', '--help'], ['live API request', 'remoteStatus']],
      [['auth', 'logout', '--help'], ['does not revoke', 'SLOTH_AGENT_TOKEN']],
      [['categories', '--help'], [
        'categories list',
        'categories create',
        'categories rename',
        'A category is the broader parent.',
        'Bills → Other',
        '(scope, categoryId, lineItemId)',
        'Choose the most specific suitable line item',
        'read-only',
      ]],
      [['budget', '--help'], [
        'sloth-agent budget         Read one budget period.',
        'budget status', 'budget update', 'budget move',
        '--scope personal|joint', '--period YYYY-MM', 'read-only',
        'periodStatus', 'funding', 'categories[].lineItems',
      ]],
      [['budget', 'status', '--help'], [
        '--scope personal|joint', 'current Sloth budget period', 'read-only',
        'spentPence', 'availablePence', 'uncategorizedSpentPence', 'refresh',
      ]],
      [['budget', 'update', '--help'], [
        '--input FILE', 'plannedPence', 'Without --apply',
        'selected period and every explicit future plan', 'Historical periods cannot be changed',
      ]],
      [['budget', 'move', '--help'], [
        '--from-category-id ID', '--to-category-id ID', '--amount AMOUNT',
        '9,007,199,254,740,991', 'To Assign', 'Without --apply', 'current assigned balances',
        'does not change planned amounts',
      ]],
      [['categories', 'create', '--help'], [
        '--name NAME', '--icon-key KEY', '--type TYPE', 'Without --apply',
        'shopping-cart', 'plane', 'no mutation request', 'write-enabled token',
      ]],
      [['categories', 'rename', '--help'], [
        '--category-id ID', 'Built-in categories are immutable', 'Without --apply',
      ]],
      [['line-items', 'create', '--help'], [
        '--scope', '--category-id ID', 'at zero', 'explicit future plans',
        'Historical snapshots remain unchanged',
      ]],
      [['line-items', 'rename', '--help'], [
        '--line-item-id ID', '--name NAME', 'Without --apply', 'write-enabled token',
      ]],
      [['line-items', '--help'], [
        'line-items create', 'line-items rename', 'command-specific details',
      ]],
      [['accounts', '--help'], [
        'accounts list',
        'accounts update',
        'accounts remove',
        'existing Sloth account inventory',
        'read-only',
        'native currency',
        'connectionState',
        'accountRef',
        'isGoalSavingsSource',
      ]],
      [['accounts', 'update', '--help'], [
        '--account-ref REF', '--institution-name NAME', '--ownership individual|joint',
        '--balance-amount AMOUNT', '--goal-savings-source true|false',
        'Without --apply', 'write-enabled token', 'Partner-owned', 'Manual accounts',
        'agent:write', 'Account not found',
      ]],
      [['accounts', 'remove', '--help'], [
        '--account-ref REF', 'archive', 'retaining its underlying records',
        'Without --apply', 'changed false',
      ]],
      [['investments', '--help'], [
        '--account-ref REF', 'cache-only', 'provider-native', 'holdings', 'read-only',
        'agent:read', 'Investment account not found',
      ]],
      [['transactions', '--help'], [
        '--uncategorized[=true|false]',
        '--shared[=true|false]',
        'selected assignment scope',
        'native scope is used when omitted',
        '--limit N',
        'Integer from 1 to 200',
        '--cursor CURSOR',
        '--line-item-id ID',
        '--account-ref REF',
        'sloth-agent accounts',
        'sloth_account_v1_',
        'must not be before --start-date',
        'waits up to 45 seconds',
        'remotely persists booked transactions',
        'refresh status',
        'Every transaction includes accountRef',
        'top-level categoryId, lineItemId, and categorySplits',
        'jointBudgetContribution',
        'uncategorised personally while its joint-budget contribution',
        'is already categorised. To assess its categorisation, inspect both locations.',
      ]],
      [['assign', '--help'], [
        'sharing',
        'shareRatio',
        'userExclusiveAmountPence',
        'partnerExclusiveAmountPence',
        '--input FILE',
        'Required',
        'Without --apply',
        'does not contact Sloth Money',
        'A successful preview does not guarantee that applying it will succeed.',
        'categorySplits',
        'non-empty array or null',
        'lineItemId is optional',
        'native scope is used when assignmentScope is omitted',
        'choose the most specific suitable line item',
        'category\'s Other line item',
        'PASTE_THE_EXACT_TRANSACTION_REF_HERE',
        'PASTE_A_LINE_ITEM_ID_HERE',
        'These are placeholders.',
        'sloth-agent categories',
        'sloth-agent transactions --assignment-scope personal --uncategorized --limit 50',
        'sloth-agent transactions --assignment-scope personal --limit 50',
        'Sloth Money → Transactions',
        'succeeded and failed',
        'Assignments do not create a separate list.',
        '1 to 100',
        'write-enabled token',
      ]],
      [['rules', '--help'], [
        'rules list',
        'rules get',
        'rules set',
        'rules delete',
        'rules scan-contract',
        'do not create transactions or recurring predictions',
      ]],
      [['rules', 'get', '--help'], [
        '--transaction-ref REF',
        'exact transactionRef',
        'read-only',
      ]],
      [['rules', 'set', '--help'], [
        '--transaction-ref REF',
        '--input FILE',
        'baselinePence',
        'renewalDate',
        'delivery',
        'Without --apply',
        'write-enabled token',
        'rule.json',
      ]],
      [['rules', 'delete', '--help'], [
        '--transaction-ref REF',
        'Without --apply',
        'write-enabled token',
      ]],
      [['rules', 'scan-contract', '--help'], [
        '--contract FILE.pdf',
        '6 MB',
        'Without --apply',
        'not sent',
        'not stored',
        'renewalDate',
        'confidence',
      ]],
      [['goals', '--help'], [
        'goals list',
        'goals create',
        'goals update',
        'goals mark-spent',
        'goals restore',
        'goals delete',
      ]],
      [['goals', 'list', '--help'], [
        'read-only',
        'No filters',
        'currency',
        'goals',
      ]],
      [['goals', 'create', '--help'], [
        '--name NAME',
        'Required',
        '--target-amount AMOUNT',
        '--type keep|spend',
        '--target-month YYYY-MM',
        'Without --apply',
        'write-enabled token',
        'Allow changes',
        '201',
      ]],
      [['goals', 'update', '--help'], [
        '--goal-id ID',
        'Required',
        '--type keep|spend',
        '--clear-target-month',
        '--priority POSITION',
        'Priority 1 is highest',
        'shifts the intervening goals',
        'Forecast screen',
        'at least one field',
        'Without --apply',
        'write-enabled token',
        'Allow changes',
        'Change active shared pot target amounts',
      ]],
      [['goals', 'mark-spent', '--help'], [
        '--goal-id ID',
        'Required',
        'Without --apply',
        '{"isSpent":true}',
        'Keep goals cannot be marked spent',
        'until restored',
      ]],
      [['goals', 'restore', '--help'], [
        '--goal-id ID',
        'Required',
        'Without --apply',
        '{"isSpent":false}',
        'clears spentAt',
        'saved priority',
      ]],
      [['goals', 'delete', '--help'], [
        '--goal-id ID',
        'Required',
        'forecast assignments',
        'drift history',
        'Without --apply',
        'write-enabled token',
        'Allow changes',
      ]],
      [['ask-partner', '--help'], [
        '--transaction-ref REF',
        'Required',
        'PASTE_THE_EXACT_TRANSACTION_REF_HERE',
        'placeholder',
        'creates the request immediately',
        'no preview mode',
        'write-enabled token',
        'Allow changes',
      ]],
    ];

    for (const [argv, expectedText] of helpCases) {
      const commandHelpIo = createIo();
      expect(await runCli(argv, {
        env: {},
        fetch: fetchMock,
        getCredentialStore,
        ...commandHelpIo,
      })).toBe(0);
      for (const text of expectedText) {
        expect(commandHelpIo.stdout.join('')).toContain(text);
      }
      if (argv[0] !== 'auth' || argv.length > 2) {
        expect(commandHelpIo.stdout.join('')).toContain(
          '--base-url overrides SLOTH_AGENT_API_BASE_URL',
        );
        expect(commandHelpIo.stdout.join('')).toContain(
          'HTTPS is required except for localhost',
        );
      }
      expect(commandHelpIo.stderr).toEqual([]);
    }

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCredentialStore).not.toHaveBeenCalled();

    const versionIo = createIo();
    expect(await runCli(['--version'], { env: {}, ...versionIo })).toBe(0);
    expect(versionIo.stdout.join('').trim()).toBe(CLI_VERSION);
  });

  it('refuses interactive login without a TTY', async () => {
    const io = createIo();
    const fetchMock = vi.fn();
    const getCredentialStore = vi.fn();

    expect(await runCli(['auth', 'login'], {
      env: {},
      fetch: fetchMock,
      getCredentialStore,
      isInteractive: false,
      ...io,
    })).toBe(2);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCredentialStore).not.toHaveBeenCalled();
    expect(io.stdout).toEqual([]);
    expect(io.stderr.join('')).toMatch(/TTY.*--token-stdin.*--from-env/i);
  });

  it('validates stdin login remotely before storing it', async () => {
    const io = createIo();
    const secret = 'sloth_pat_v1_stdin-secret';
    const credentialStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1CategoriesResponse,
    ));

    expect(await runCli(['auth', 'login', '--token-stdin'], {
      env: {},
      fetch: fetchMock,
      getCredentialStore: async () => credentialStore,
      readStdin: async () => `${secret}\n`,
      ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(credentialStore.set).toHaveBeenCalledWith(
      'https://budget.slothmoney.app',
      secret,
    );
    expect(io.stderr).toEqual([]);
    expect(JSON.parse(io.stdout.join(''))).toEqual({
      activeSource: 'keychain',
      environmentOverrideActive: false,
      origin: 'https://budget.slothmoney.app',
      stored: true,
    });
    expect(`${io.stdout.join('')}${io.stderr.join('')}`).not.toContain(secret);
  });

  it('writes the default hidden prompt to stderr so stdout stays JSON-only', async () => {
    const io = createIo();
    const secret = 'sloth_pat_v1_prompt-secret';
    passwordPrompt.mockResolvedValue(secret);

    expect(await runCli(['auth', 'login'], {
      env: {},
      fetch: vi.fn().mockResolvedValue(jsonResponse(agentApiV1CategoriesResponse)),
      getCredentialStore: async () => ({
        delete: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
      }),
      isInteractive: true,
      ...io,
    })).toBe(0);

    expect(passwordPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        mask: '*',
        message: 'Personal access token:',
      }),
      { output: process.stderr },
    );
    expect(JSON.parse(io.stdout.join(''))).toMatchObject({ stored: true });
    expect(`${io.stdout.join('')}${io.stderr.join('')}`).not.toContain(secret);
  });

  it('does not replace a stored credential when remote login validation fails', async () => {
    const io = createIo();
    const secret = 'sloth_pat_v1_rejected-secret';
    const credentialStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      error: `Rejected ${secret}`,
    }, 401));

    expect(await runCli(['auth', 'login', '--from-env'], {
      env: { SLOTH_AGENT_TOKEN: secret },
      fetch: fetchMock,
      getCredentialStore: async () => credentialStore,
      ...io,
    })).toBe(1);

    expect(credentialStore.set).not.toHaveBeenCalled();
    expect(io.stdout).toEqual([]);
    expect(io.stderr.join('')).toContain('[REDACTED]');
    expect(io.stderr.join('')).not.toContain(secret);
  });

  it('rejects malformed login tokens before making a request', async () => {
    for (const secret of [
      '',
      'wrong_prefix',
      'sloth_pat_v1_has whitespace',
      ' sloth_pat_v1_leading-space',
      'sloth_pat_v1_trailing-space ',
      'sloth_pat_v1_extra-lines\n\n',
    ]) {
      const io = createIo();
      const fetchMock = vi.fn();
      const getCredentialStore = vi.fn();

      expect(await runCli(['auth', 'login', '--token-stdin'], {
        env: {},
        fetch: fetchMock,
        getCredentialStore,
        readStdin: async () => secret,
        ...io,
      })).toBe(2);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(getCredentialStore).not.toHaveBeenCalled();
      if (secret) {
        expect(`${io.stdout.join('')}${io.stderr.join('')}`).not.toContain(secret);
      }
      expect(io.stderr.join('')).not.toContain('SLOTH_AGENT_TOKEN is required');
    }
  });

  it('imports an environment token while reporting that it remains active', async () => {
    const io = createIo();
    const secret = 'sloth_pat_v1_environment-secret';
    const credentialStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    expect(await runCli(['auth', 'login', '--from-env'], {
      env: { SLOTH_AGENT_TOKEN: secret },
      fetch: vi.fn().mockResolvedValue(jsonResponse(agentApiV1CategoriesResponse)),
      getCredentialStore: async () => credentialStore,
      ...io,
    })).toBe(0);

    expect(credentialStore.set).toHaveBeenCalledWith(
      'https://budget.slothmoney.app',
      secret,
    );
    expect(JSON.parse(io.stdout.join(''))).toMatchObject({
      activeSource: 'environment',
      environmentOverrideActive: true,
      stored: true,
    });
    expect(`${io.stdout.join('')}${io.stderr.join('')}`).not.toContain(secret);
  });

  it('never accepts a token value in argv', async () => {
    const io = createIo();
    const secret = 'sloth_pat_v1_argv-secret';

    expect(await runCli(['auth', 'login', '--token', secret], {
      env: {},
      ...io,
    })).toBe(2);

    expect(`${io.stdout.join('')}${io.stderr.join('')}`).not.toContain(secret);
  });

  it('uses the production API by default and emits JSON', async () => {
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1CategoriesResponse,
    ));

    expect(await runCli(['categories'], {
      env: { SLOTH_AGENT_TOKEN: 'sloth_pat_v1_secret' },
      fetch: fetchMock,
      ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/categories',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sloth_pat_v1_secret',
          'User-Agent': `sloth-agent/${CLI_VERSION}`,
        }),
      }),
    );
    expect(JSON.parse(io.stdout.join(''))).toEqual(
      agentApiV1CategoriesResponse,
    );
  });

  it('lists accounts with one cache-only GET and JSON-only stdout', async () => {
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1AccountsResponse,
    ));
    const getCredentialStore = vi.fn();

    expect(await runCli(['accounts'], {
      env: { SLOTH_AGENT_TOKEN: 'sloth_pat_v1_secret' },
      fetch: fetchMock,
      getCredentialStore,
      ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/accounts',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer sloth_pat_v1_secret',
          'User-Agent': `sloth-agent/${CLI_VERSION}`,
        }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Prefer');
    expect(getCredentialStore).not.toHaveBeenCalled();
    expect(JSON.parse(io.stdout.join(''))).toEqual(agentApiV1AccountsResponse);
    expect(io.stderr).toEqual([]);
  });

  it('previews and applies full manual account updates', async () => {
    const accountRef = agentApiV1AccountsResponse.accounts[0].accountRef;
    const previewIo = createIo();
    const previewFetch = vi.fn();
    const previewCredentialStore = vi.fn();
    expect(await runCli([
      'accounts', 'update', '--account-ref', accountRef,
      '--institution-name', 'Hargreaves Lansdown',
      '--account-name', 'Stocks & Shares ISA',
      '--currency', 'gbp',
      '--ownership', 'individual',
      '--balance-amount', '12500.75',
      '--account-type', 'investments',
      '--goal-savings-source', 'false',
    ], {
      env: {},
      fetch: previewFetch,
      getCredentialStore: previewCredentialStore,
      ...previewIo,
    })).toBe(0);
    expect(previewFetch).not.toHaveBeenCalled();
    expect(previewCredentialStore).not.toHaveBeenCalled();
    expect(JSON.parse(previewIo.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: `https://budget.slothmoney.app/api/agent/v1/accounts/${accountRef}`,
      method: 'PATCH',
      payload: {
        institutionName: 'Hargreaves Lansdown',
        accountName: 'Stocks & Shares ISA',
        currency: 'GBP',
        ownership: 'personal',
        balanceAmount: 12500.75,
        accountType: 'investments',
        isGoalSavingsSource: false,
      },
    });

    const applyIo = createIo();
    const applyFetch = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1AccountMutationResponse,
    ));
    expect(await runCli([
      'accounts', 'update', '--account-ref', accountRef,
      '--goal-savings-source', 'true', '--apply',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: applyFetch,
      ...applyIo,
    })).toBe(0);
    expect(applyFetch).toHaveBeenCalledWith(
      `https://budget.slothmoney.app/api/agent/v1/accounts/${accountRef}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isGoalSavingsSource: true }),
      }),
    );
    expect(JSON.parse(applyIo.stdout.join(''))).toEqual(
      agentApiV1AccountMutationResponse,
    );
  });

  it('previews and applies idempotent manual account removal', async () => {
    const accountRef = agentApiV1AccountsResponse.accounts[0].accountRef;
    const previewIo = createIo();
    const previewFetch = vi.fn();
    const previewCredentialStore = vi.fn();
    expect(await runCli([
      'accounts', 'remove', '--account-ref', accountRef,
    ], {
      env: {},
      fetch: previewFetch,
      getCredentialStore: previewCredentialStore,
      ...previewIo,
    })).toBe(0);
    expect(previewFetch).not.toHaveBeenCalled();
    expect(previewCredentialStore).not.toHaveBeenCalled();
    expect(JSON.parse(previewIo.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: `https://budget.slothmoney.app/api/agent/v1/accounts/${accountRef}`,
      method: 'DELETE',
    });

    const applyIo = createIo();
    const applyFetch = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1AccountRemovalResponse,
    ));
    expect(await runCli([
      'accounts', 'remove', '--account-ref', accountRef, '--apply',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: applyFetch,
      ...applyIo,
    })).toBe(0);
    expect(applyFetch).toHaveBeenCalledWith(
      `https://budget.slothmoney.app/api/agent/v1/accounts/${accountRef}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(JSON.parse(applyIo.stdout.join(''))).toEqual(
      agentApiV1AccountRemovalResponse,
    );
  });

  it('lists a validated cache-only investment portfolio with an optional account filter', async () => {
    const accountRef = agentApiV1InvestmentsResponse.investmentAccounts[0].accountRef;
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(agentApiV1InvestmentsResponse));

    expect(await runCli(['investments', '--account-ref', accountRef], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://budget.slothmoney.app/api/agent/v1/investments?accountRef=${encodeURIComponent(accountRef)}`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(JSON.parse(io.stdout.join(''))).toEqual(agentApiV1InvestmentsResponse);
    expect(io.stderr).toEqual([]);
  });

  it('lists goals as validated JSON', async () => {
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1GoalsResponse,
    ));

    expect(await runCli(['goals'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/goals',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(JSON.parse(io.stdout.join(''))).toEqual({
      ...agentApiV1GoalsResponse,
      goals: [{ ...agentApiV1GoalsResponse.goals[0], priority: 1 }],
    });
    expect(io.stderr).toEqual([]);
  });

  it('previews and applies goal creation', async () => {
    const previewIo = createIo();
    const previewFetch = vi.fn();
    const argv = [
      'goals',
      'create',
      '--name',
      'Emergency fund',
      '--target-amount',
      '12000',
      '--target-month',
      '2027-06',
      '--type',
      'spend',
    ];

    expect(await runCli(argv, {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: previewFetch,
      ...previewIo,
    })).toBe(0);

    expect(previewFetch).not.toHaveBeenCalled();
    expect(JSON.parse(previewIo.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/goals',
      method: 'POST',
      payload: {
        name: 'Emergency fund',
        targetAmount: 12_000,
        targetMonthKey: '2027-06',
        goalType: 'spend',
      },
    });

    const applyIo = createIo();
    const applyFetch = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1GoalMutationResponse,
      201,
    ));
    expect(await runCli([...argv, '--apply'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: applyFetch,
      ...applyIo,
    })).toBe(0);

    expect(applyFetch).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/goals',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Emergency fund',
          targetAmount: 12_000,
          targetMonthKey: '2027-06',
          goalType: 'spend',
        }),
      }),
    );
    expect(JSON.parse(applyIo.stdout.join(''))).toEqual(
      agentApiV1GoalMutationResponse,
    );
  });

  it('previews and applies a partial goal update', async () => {
    const argv = [
      'goals',
      'update',
      '--goal-id',
      'goal 1',
      '--target-amount',
      '15000',
      '--target-month',
      '2027-12',
      '--type=spend',
    ];
    const previewIo = createIo();
    const previewFetch = vi.fn();

    expect(await runCli(argv, {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: previewFetch,
      ...previewIo,
    })).toBe(0);

    expect(previewFetch).not.toHaveBeenCalled();
    expect(JSON.parse(previewIo.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/goals/goal%201',
      method: 'PATCH',
      payload: {
        targetAmount: 15_000,
        targetMonthKey: '2027-12',
        goalType: 'spend',
      },
    });

    const applyIo = createIo();
    const applyFetch = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1GoalMutationResponse,
    ));
    expect(await runCli([...argv, '--apply'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: applyFetch,
      ...applyIo,
    })).toBe(0);

    expect(applyFetch).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/goals/goal%201',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          targetAmount: 15_000,
          targetMonthKey: '2027-12',
          goalType: 'spend',
        }),
      }),
    );
    expect(JSON.parse(applyIo.stdout.join(''))).toEqual(
      agentApiV1GoalMutationResponse,
    );
  });

  it.each([
    ['mark-spent', true],
    ['restore', false],
  ] as const)('previews and applies goals %s', async (action, isSpent) => {
    const argv = ['goals', action, '--goal-id', 'goal 1'];
    const response = {
      ...agentApiV1GoalMutationResponse,
      goal: {
        ...agentApiV1GoalMutationResponse.goal,
        goalType: 'spend',
        spentAt: isSpent ? '2026-08-15T12:00:00.000Z' : null,
      },
    };
    const previewIo = createIo();
    const previewFetch = vi.fn();

    expect(await runCli(argv, {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: previewFetch,
      ...previewIo,
    })).toBe(0);

    expect(previewFetch).not.toHaveBeenCalled();
    expect(JSON.parse(previewIo.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/goals/goal%201',
      method: 'PATCH',
      payload: { isSpent },
    });

    const applyIo = createIo();
    const applyFetch = vi.fn().mockResolvedValue(jsonResponse(
      response,
    ));
    expect(await runCli([...argv, '--apply'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: applyFetch,
      ...applyIo,
    })).toBe(0);

    expect(applyFetch).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/goals/goal%201',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isSpent }),
      }),
    );
    expect(JSON.parse(applyIo.stdout.join(''))).toEqual(response);
  });

  it.each([
    {
      argv: ['goals', 'mark-spent', '--goal-id', 'goal-1', '--apply'],
      message: 'Only Spend goals can be marked spent',
    },
    {
      argv: ['goals', 'update', '--goal-id', 'goal-1', '--type', 'keep', '--apply'],
      message: 'Restore the goal before changing its type',
    },
  ])('prints Agent API lifecycle conflict: $message', async ({ argv, message }) => {
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      { error: message },
      409,
    ));

    expect(await runCli(argv, {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(1);

    expect(io.stdout).toEqual([]);
    expect(io.stderr.join('')).toBe(`${message}\n`);
  });

  it('previews and applies a goal priority move', async () => {
    const argv = [
      'goals',
      'update',
      '--goal-id',
      'goal 3',
      '--priority',
      '2',
    ];
    const previewIo = createIo();
    const previewFetch = vi.fn();

    expect(await runCli(argv, {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: previewFetch,
      ...previewIo,
    })).toBe(0);

    expect(previewFetch).not.toHaveBeenCalled();
    expect(JSON.parse(previewIo.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/goals/goal%203',
      method: 'PATCH',
      payload: { priority: 2 },
    });

    const applyIo = createIo();
    const applyFetch = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1GoalMutationResponse,
    ));
    expect(await runCli([...argv, '--apply'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: applyFetch,
      ...applyIo,
    })).toBe(0);

    expect(applyFetch).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/goals/goal%203',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ priority: 2 }),
      }),
    );
    expect(JSON.parse(applyIo.stdout.join(''))).toEqual({
      ...agentApiV1GoalMutationResponse,
      goal: { ...agentApiV1GoalMutationResponse.goal, priority: 2 },
    });
  });

  it('previews and applies goal deletion', async () => {
    const argv = [
      'goals',
      'delete',
      '--goal-id',
      'goal 1',
    ];
    const previewIo = createIo();
    const previewFetch = vi.fn();

    expect(await runCli(argv, {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: previewFetch,
      ...previewIo,
    })).toBe(0);

    expect(previewFetch).not.toHaveBeenCalled();
    expect(JSON.parse(previewIo.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/goals/goal%201',
      method: 'DELETE',
    });

    const applyIo = createIo();
    const applyFetch = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1GoalDeleteResponse,
    ));
    expect(await runCli([...argv, '--apply'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: applyFetch,
      ...applyIo,
    })).toBe(0);

    expect(applyFetch).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/goals/goal%201',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
    expect(JSON.parse(applyIo.stdout.join(''))).toEqual(
      agentApiV1GoalDeleteResponse,
    );
  });

  it('prefers the environment token without loading native storage', async () => {
    const io = createIo();
    const getCredentialStore = vi.fn().mockRejectedValue(
      new Error('native storage should not load'),
    );
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1CategoriesResponse,
    ));

    expect(await runCli(['categories'], {
      env: { SLOTH_AGENT_TOKEN: 'environment-token' },
      fetch: fetchMock,
      getCredentialStore,
      ...io,
    })).toBe(0);

    expect(getCredentialStore).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer environment-token',
        }),
      }),
    );
  });

  it('resolves stored credentials by normalized API origin', async () => {
    const io = createIo();
    const credentialStore = {
      delete: vi.fn(),
      get: vi.fn().mockResolvedValue('stored-token'),
      set: vi.fn(),
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1CategoriesResponse,
    ));

    expect(await runCli([
      'categories',
      '--base-url',
      'https://api.example.com/',
    ], {
      env: {},
      fetch: fetchMock,
      getCredentialStore: async () => credentialStore,
      ...io,
    })).toBe(0);

    expect(credentialStore.get).toHaveBeenCalledWith('https://api.example.com');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/agent/v1/categories',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer stored-token',
        }),
      }),
    );
  });

  it('returns configuration failure when secure storage cannot load', async () => {
    const io = createIo();

    expect(await runCli(['categories'], {
      env: {},
      getCredentialStore: async () => {
        throw new Error('native module unavailable');
      },
      ...io,
    })).toBe(3);

    expect(io.stderr.join('')).toContain('Native secure credential storage is unavailable');
    expect(io.stderr.join('')).not.toContain('native module unavailable');
  });

  it('reports live auth status without exposing the active token', async () => {
    const io = createIo();
    const secret = 'sloth_pat_v1_environment-secret';
    const getCredentialStore = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1CategoriesResponse,
    ));

    expect(await runCli(['auth', 'status'], {
      env: { SLOTH_AGENT_TOKEN: secret },
      fetch: fetchMock,
      getCredentialStore,
      ...io,
    })).toBe(0);

    expect(getCredentialStore).not.toHaveBeenCalled();
    expect(JSON.parse(io.stdout.join(''))).toEqual({
      origin: 'https://budget.slothmoney.app',
      remoteStatus: 'valid',
      source: 'environment',
      tokenSuffix: '…cret',
    });
    expect(`${io.stdout.join('')}${io.stderr.join('')}`).not.toContain(secret);
  });

  it.each([
    [401, 'invalid_or_expired'],
    [402, 'payment_required'],
    [403, 'insufficient_scope'],
  ] as const)('classifies status %i without deleting the credential', async (
    status,
    remoteStatus,
  ) => {
    const io = createIo();
    const credentialStore = {
      delete: vi.fn(),
      get: vi.fn().mockResolvedValue('sloth_pat_v1_stored-secret'),
      set: vi.fn(),
    };

    expect(await runCli(['auth', 'status'], {
      env: {},
      fetch: vi.fn().mockResolvedValue(jsonResponse({ error: 'Rejected' }, status)),
      getCredentialStore: async () => credentialStore,
      ...io,
    })).toBe(1);

    expect(JSON.parse(io.stdout.join(''))).toEqual({
      origin: 'https://budget.slothmoney.app',
      remoteStatus,
      source: 'keychain',
      tokenSuffix: '…cret',
    });
    expect(credentialStore.delete).not.toHaveBeenCalled();
    expect(io.stderr).toEqual([]);
  });

  it('classifies network status failures as unreachable', async () => {
    const io = createIo();

    expect(await runCli(['auth', 'status'], {
      env: { SLOTH_AGENT_TOKEN: 'sloth_pat_v1_environment-secret' },
      fetch: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
      ...io,
    })).toBe(1);

    expect(JSON.parse(io.stdout.join('')).remoteStatus).toBe('unreachable');
    expect(io.stderr).toEqual([]);
  });

  it('deletes only the local credential and reports an active environment override', async () => {
    const io = createIo();
    const credentialStore = {
      delete: vi.fn().mockResolvedValue(false),
      get: vi.fn(),
      set: vi.fn(),
    };
    const fetchMock = vi.fn();

    expect(await runCli(['auth', 'logout'], {
      env: { SLOTH_AGENT_TOKEN: 'sloth_pat_v1_environment-secret' },
      fetch: fetchMock,
      getCredentialStore: async () => credentialStore,
      ...io,
    })).toBe(0);

    expect(credentialStore.delete).toHaveBeenCalledWith(
      'https://budget.slothmoney.app',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(io.stdout.join(''))).toEqual({
      environmentOverrideActive: true,
      localCredentialRemoved: false,
      origin: 'https://budget.slothmoney.app',
      remoteRevoked: false,
      revocationInstructions: 'Revoke the token in Sloth Money Settings > Developer access.',
    });
  });

  it('emits the documented transaction query shape', async () => {
    const accountRef = agentApiV1AccountsResponse.accounts[0].accountRef;
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1TransactionsResponse,
    ));

    expect(await runCli([
      'transactions',
      '--uncategorized=false',
      '--shared=false',
      '--limit',
      '25',
      '--start-date',
      '2026-05-01',
      '--end-date',
      '2026-05-31',
      '--q',
      'tesco',
      '--account-ref',
      accountRef,
      '--category-id',
      'groceries',
      '--line-item-id',
      'weekly',
      '--assignment-scope',
      'joint',
      '--cursor',
      'cursor-1',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://budget.slothmoney.app/api/agent/v1/transactions?uncategorized=false&shared=false&limit=25&startDate=2026-05-01&endDate=2026-05-31&q=tesco&accountRef=${encodeURIComponent(accountRef)}&categoryId=groceries&lineItemId=weekly&assignmentScope=joint&cursor=cursor-1`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Prefer: 'wait=45' }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('retains the legacy transaction account ID filter', async () => {
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1TransactionsResponse,
    ));

    expect(await runCli([
      'transactions',
      '--account-id',
      'legacy-account-1',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/transactions?accountId=legacy-account-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('previews category creation without a mutation request and applies encoded category rename', async () => {
    const previewIo = createIo();
    const previewFetch = vi.fn();
    expect(await runCli([
      'categories', 'create', '--name', 'Holidays', '--icon-key', 'plane', '--type', 'Wants',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' }, fetch: previewFetch, ...previewIo,
    })).toBe(0);
    expect(previewFetch).not.toHaveBeenCalled();
    expect(JSON.parse(previewIo.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/categories',
      method: 'POST',
      payload: { name: 'Holidays', iconKey: 'plane', categoryType: 'Wants' },
    });

    const applyIo = createIo();
    const applyFetch = vi.fn().mockResolvedValue(jsonResponse(agentApiV1CategoryMutationResponse));
    expect(await runCli([
      'categories', 'rename', '--category-id', 'custom id', '--name', 'Travel fund', '--apply',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' }, fetch: applyFetch, ...applyIo,
    })).toBe(0);
    expect(applyFetch).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/categories/custom%20id',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Travel fund' }) }),
    );
    expect(JSON.parse(applyIo.stdout.join(''))).toEqual(agentApiV1CategoryMutationResponse);
  });

  it('reports a write-token failure without emitting mutation JSON', async () => {
    const io = createIo();

    expect(await runCli([
      'categories', 'create', '--name', 'Holidays', '--icon-key', 'plane', '--type', 'Wants', '--apply',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'view-only-token' },
      fetch: vi.fn().mockResolvedValue(jsonResponse({ error: 'Token does not have required scope' }, 403)),
      ...io,
    })).toBe(1);

    expect(io.stdout).toEqual([]);
    expect(io.stderr.join('')).toContain('Token does not have required scope');
  });

  it('previews and applies scoped line-item writes with strict success validation', async () => {
    const previewIo = createIo();
    const previewFetch = vi.fn();
    expect(await runCli([
      'line-items', 'create', '--scope', 'personal', '--category-id', 'groceries', '--name', 'Weekly',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' }, fetch: previewFetch, ...previewIo,
    })).toBe(0);
    expect(previewFetch).not.toHaveBeenCalled();
    expect(JSON.parse(previewIo.stdout.join(''))).toMatchObject({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/line-items',
      method: 'POST',
      payload: { scope: 'personal', categoryId: 'groceries', name: 'Weekly' },
    });

    const applyIo = createIo();
    const applyFetch = vi.fn().mockResolvedValue(jsonResponse(agentApiV1LineItemMutationResponse));
    expect(await runCli([
      'line-items', 'rename', '--scope', 'personal', '--category-id', 'groceries',
      '--line-item-id', 'weekly item', '--name', 'Weekly shop', '--apply',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' }, fetch: applyFetch, ...applyIo,
    })).toBe(0);
    expect(applyFetch).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/line-items/weekly%20item',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ scope: 'personal', categoryId: 'groceries', name: 'Weekly shop' }),
      }),
    );

    const malformedIo = createIo();
    expect(await runCli([
      'line-items', 'create', '--scope', 'personal', '--category-id', 'groceries', '--name', 'Weekly', '--apply',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: vi.fn().mockResolvedValue(jsonResponse({ scope: 'personal', categoryId: 'groceries' })),
      ...malformedIo,
    })).toBe(1);
    expect(malformedIo.stderr.join('')).toContain('Invalid line-items-create response');
  });

  it('previews assignments without calling the API', async () => {
    const payload = {
      assignments: [{
        transactionRef: 'sloth_txn_1',
        sharing: {
          isShared: true,
          shareRatio: 0.6,
          userExclusiveAmountPence: 500,
          partnerExclusiveAmountPence: 0,
        },
        assignmentScope: 'joint',
        categoryId: 'groceries',
      }],
    };
    const input = writeAssignments(payload);
    const fetchMock = vi.fn();
    const getCredentialStore = vi.fn(() => {
      throw new Error('credential store must not load for preview');
    });
    const io = createIo();

    expect(await runCli(['assign', '--input', input], {
      env: {},
      fetch: fetchMock,
      getCredentialStore,
      ...io,
    })).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCredentialStore).not.toHaveBeenCalled();
    expect(JSON.parse(io.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/transaction-assignments',
      payload,
    });
  });

  it('reads a scoped budget period with strict response validation', async () => {
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(agentApiV1BudgetResponse));

    expect(await runCli(['budget', '--scope', 'personal', '--period', '2026-08'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/budgets?scope=personal&periodKey=2026-08',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(JSON.parse(io.stdout.join(''))).toEqual(agentApiV1BudgetResponse);
  });

  it('reads current budget status and asks the API to wait for refresh', async () => {
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(agentApiV1BudgetStatusResponse));

    expect(await runCli(['budget', 'status', '--scope', 'personal'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/budget-status?scope=personal',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Prefer: 'wait=45' }),
      }),
    );
    expect(JSON.parse(io.stdout.join(''))).toEqual(agentApiV1BudgetStatusResponse);
  });

  it('previews a budget update without loading credentials or contacting the API', async () => {
    const input = writeAssignments({
      allocations: [{ categoryId: 'groceries', lineItemId: 'weekly', plannedPence: 45_000 }],
    });
    const io = createIo();
    const fetchMock = vi.fn();
    const getCredentialStore = vi.fn();

    expect(await runCli([
      'budget', 'update', '--scope', 'personal', '--period', '2026-08', '--input', input,
    ], {
      env: {}, fetch: fetchMock, getCredentialStore, ...io,
    })).toBe(0);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCredentialStore).not.toHaveBeenCalled();
    expect(JSON.parse(io.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/budgets',
      method: 'PATCH',
      payload: {
        scope: 'personal',
        periodKey: '2026-08',
        allocations: [{ categoryId: 'groceries', lineItemId: 'weekly', plannedPence: 45_000 }],
      },
    });
  });

  it('applies a budget update and rejects malformed success data', async () => {
    const input = writeAssignments({
      allocations: [{ categoryId: 'groceries', lineItemId: 'weekly', plannedPence: 45_000 }],
    });
    const applyIo = createIo();
    const applyFetch = vi.fn().mockResolvedValue(jsonResponse(agentApiV1BudgetResponse));

    expect(await runCli([
      'budget', 'update', '--scope', 'personal', '--input', input, '--apply',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' }, fetch: applyFetch, ...applyIo,
    })).toBe(0);
    expect(applyFetch).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/budgets',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          scope: 'personal',
          allocations: [{ categoryId: 'groceries', lineItemId: 'weekly', plannedPence: 45_000 }],
        }),
      }),
    );

    const malformedIo = createIo();
    expect(await runCli(['budget', '--scope', 'personal'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: vi.fn().mockResolvedValue(jsonResponse({ ...agentApiV1BudgetResponse, funding: {} })),
      ...malformedIo,
    })).toBe(1);
    expect(malformedIo.stderr.join('')).toContain('Invalid budget response');
  });

  it('previews a budget movement without loading credentials or contacting the API', async () => {
    const io = createIo();
    const fetchMock = vi.fn();
    const getCredentialStore = vi.fn();

    expect(await runCli([
      'budget', 'move', '--scope', 'personal', '--period', '2026-08',
      '--from-category-id', 'activities', '--to-category-id', 'groceries',
      '--amount', '52.95',
    ], {
      env: {}, fetch: fetchMock, getCredentialStore, ...io,
    })).toBe(0);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCredentialStore).not.toHaveBeenCalled();
    expect(JSON.parse(io.stdout.join(''))).toEqual({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/budget-movements',
      method: 'POST',
      payload: {
        scope: 'personal',
        periodKey: '2026-08',
        fromCategoryId: 'activities',
        toCategoryId: 'groceries',
        amountPence: 5_295,
      },
    });
  });

  it('applies a budget movement and validates the returned balances', async () => {
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(agentApiV1BudgetMovementResponse));

    expect(await runCli([
      'budget', 'move', '--scope', 'personal', '--from-category-id', 'activities',
      '--to-category-id', 'groceries', '--amount', '52.95', '--apply',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' }, fetch: fetchMock, ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/budget-movements',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          scope: 'personal',
          fromCategoryId: 'activities',
          toCategoryId: 'groceries',
          amountPence: 5_295,
        }),
      }),
    );
    expect(JSON.parse(io.stdout.join(''))).toEqual(agentApiV1BudgetMovementResponse);
  });

  it.each([
    {
      label: 'a different movement',
      response: { ...agentApiV1BudgetMovementResponse, amountPence: 5_294 },
    },
    {
      label: 'unrelated affected balances',
      response: {
        ...agentApiV1BudgetMovementResponse,
        categoryBalances: [
          { categoryId: 'groceries', assignedPence: 65_295 },
          { categoryId: 'groceries', assignedPence: 65_295 },
        ],
      },
    },
  ])('rejects a budget movement response describing $label', async ({ response }) => {
    const io = createIo();

    expect(await runCli([
      'budget', 'move', '--scope', 'personal', '--from-category-id', 'activities',
      '--to-category-id', 'groceries', '--amount', '52.95', '--apply',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: vi.fn().mockResolvedValue(jsonResponse(response)),
      ...io,
    })).toBe(1);

    expect(io.stdout).toEqual([]);
    expect(io.stderr.join('')).toContain('Invalid budget-move response');
  });

  it('applies assignments and returns failure for mixed results', async () => {
    const input = writeAssignments({
      assignments: [{ transactionRef: 'sloth_txn_1', categoryId: 'groceries' }],
    });
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1AssignmentResponse,
    ));

    expect(await runCli(['assign', '--input', input, '--apply'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(1);
    expect(JSON.parse(io.stdout.join('')).failed).toHaveLength(1);
  });

  it('creates a partner explanation request', async () => {
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1ExplanationResponse,
    ));

    expect(await runCli(['ask-partner', '--transaction-ref', 'sloth_txn_1'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(0);
    expect(JSON.parse(io.stdout.join('')).requestId).toBe('ter_1');
  });

  it('keeps diagnostics on stderr and redacts the token', async () => {
    const io = createIo();
    const secret = 'sloth_pat_v1_do-not-print';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      error: `Rejected ${secret}`,
    }, 401));

    expect(await runCli(['categories'], {
      env: { SLOTH_AGENT_TOKEN: secret },
      fetch: fetchMock,
      ...io,
    })).toBe(1);
    expect(io.stdout).toEqual([]);
    expect(io.stderr.join('')).toContain('[REDACTED]');
    expect(io.stderr.join('')).not.toContain(secret);
  });

  it('returns an API failure for a malformed success response', async () => {
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      categories: [],
    }));

    expect(await runCli(['categories'], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(1);
    expect(io.stdout).toEqual([]);
    expect(io.stderr.join('')).toContain('Invalid categories response');
  });

  it('uses distinct exit codes for usage and configuration failures', async () => {
    const usageIo = createIo();
    expect(await runCli(['unknown'], { env: {}, ...usageIo })).toBe(2);

    const configIo = createIo();
    expect(await runCli(['categories'], {
      env: {},
      getCredentialStore: async () => ({
        delete: vi.fn(),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn(),
      }),
      ...configIo,
    })).toBe(3);
    expect(configIo.stderr.join('')).toContain('No credential found');
  });
});
