import { describe, expect, it, vi } from 'vitest';
import { parseArgs } from '../src/args.js';
import { runCli } from '../src/cli.js';
import { budgetCashflowFixture } from '../src/generated/agent-v1/budgetCashflowFixtures.js';
import { parseApiResponse } from '../src/contracts.js';

describe('budget cashflow', () => {
  it('accepts the shared account outcome and rejects invalid money or missing dates', () => {
    expect(parseApiResponse('budget-cashflow', budgetCashflowFixture)).toEqual(budgetCashflowFixture);
    expect(() => parseApiResponse('budget-cashflow', { ...budgetCashflowFixture, startingBalancePence: 0.5 })).toThrow();
    expect(() => parseApiResponse('budget-cashflow', { ...budgetCashflowFixture, firstNegativeDate: undefined })).toThrow();
  });
  it('requires personal or joint scope and rejects options outside the current read', () => {
    expect(parseArgs(['budget', 'cashflow', '--scope', 'joint'])).toEqual({ command: 'budget-cashflow', scope: 'joint' });
    expect(() => parseArgs(['budget', 'cashflow'])).toThrow(/scope/);
    for (const extra of [['--period', '2026-09'], ['--apply'], ['--scope', 'household']]) {
      expect(() => parseArgs(['budget', 'cashflow', '--scope', 'personal', ...extra])).toThrow();
    }
    expect(parseArgs(['budget', 'cashflow', '-h'])).toEqual({ command: 'help', topic: 'budget-cashflow' });
  });
  it('documents the required scope, cached estimate and limits in nested help', async () => {
    const stdout: string[] = [];
    expect(await runCli(['budget', 'cashflow', '--help'], { writeStdout: value => stdout.push(value) })).toBe(0);
    const help = stdout.join('');
    for (const text of ['--scope personal|joint', 'agent:read', 'read-only', 'pending', 'planned', 'firstNegativeDate', 'JSON']) expect(help).toContain(text);
  });
  it('makes one cached read and validates unavailable outcomes without inventing balances', async () => {
    const response = { scope: 'personal', status: 'unavailable', asOf: '2026-09-21T12:00:00Z',
      reason: 'account_not_configured', limitations: ['pending_not_reconciled', 'income_transfers_excluded'] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' } }));
    const stdout: string[] = [];
    const stderr: string[] = [];
    expect(await runCli(['budget', 'cashflow', '--scope', 'personal'], { env: { SLOTH_AGENT_TOKEN: 'test-token' }, fetch: fetchMock,
      writeStdout: value => stdout.push(value), writeStderr: value => stderr.push(value) })).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://budget.slothmoney.app/api/agent/v1/budget-cashflow?scope=personal');
    expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty('Prefer');
    expect(JSON.parse(stdout.join(''))).toEqual(response);
    expect(stderr).toEqual([]);
  });
});
