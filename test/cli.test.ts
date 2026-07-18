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

afterEach(() => {
  vi.restoreAllMocks();
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

    const versionIo = createIo();
    expect(await runCli(['--version'], { env: {}, ...versionIo })).toBe(0);
    expect(versionIo.stdout.join('').trim()).toBe(CLI_VERSION);
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
    expect(await runCli(['categories'], { env: {}, ...configIo })).toBe(3);
    expect(configIo.stderr.join('')).toContain('SLOTH_AGENT_TOKEN is required');
  });
});
