import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CLI_VERSION,
  runCli,
} from '../src/cli.js';
import {
  agentApiV1AssignmentResponse,
  agentApiV1CategoriesResponse,
  agentApiV1ExplanationResponse,
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

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CLI execution', () => {
  it('prints help and version without requiring a token', async () => {
    const helpIo = createIo();
    expect(await runCli(['--help'], { env: {}, ...helpIo })).toBe(0);
    expect(helpIo.stdout.join('')).toContain('sloth-agent transactions');
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
      ]],
      [['auth', 'status', '--help'], ['live API request', 'remoteStatus']],
      [['auth', 'logout', '--help'], ['does not revoke', 'SLOTH_AGENT_TOKEN']],
      [['categories', '--help'], [
        'A category is the broader parent.',
        'Bills → Other',
        '(scope, categoryId, lineItemId)',
        'read-only',
      ]],
      [['transactions', '--help'], [
        '--uncategorized[=true|false]',
        '--limit N',
        'Integer from 1 to 200',
        '--cursor CURSOR',
        'must not be before --start-date',
        'read-only',
      ]],
      [['assign', '--help'], [
        '--input FILE',
        'Required',
        'Without --apply',
        'categorySplits',
        'non-empty array or null',
        'lineItemId is optional',
        '1 to 100',
      ]],
      [['ask-partner', '--help'], [
        '--transaction-ref REF',
        'Required',
        'creates the request immediately',
        'no preview mode',
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
    const io = createIo();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      agentApiV1TransactionsResponse,
    ));

    expect(await runCli([
      'transactions',
      '--uncategorized=false',
      '--limit',
      '25',
      '--start-date',
      '2026-05-01',
      '--end-date',
      '2026-05-31',
      '--q',
      'tesco',
      '--account-id',
      'account-1',
      '--category-id',
      'groceries',
      '--cursor',
      'cursor-1',
    ], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://budget.slothmoney.app/api/agent/v1/transactions?uncategorized=false&limit=25&startDate=2026-05-01&endDate=2026-05-31&q=tesco&accountId=account-1&categoryId=groceries&cursor=cursor-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('previews assignments without calling the API', async () => {
    const input = writeAssignments({
      assignments: [{ transactionRef: 'sloth_txn_1', categoryId: 'groceries' }],
    });
    const fetchMock = vi.fn();
    const io = createIo();

    expect(await runCli(['assign', '--input', input], {
      env: { SLOTH_AGENT_TOKEN: 'token' },
      fetch: fetchMock,
      ...io,
    })).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(io.stdout.join(''))).toMatchObject({
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/transaction-assignments',
    });
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
