import { budgetAuditFixture } from '../src/generated/agent-v1/budgetAuditFixtures.js';
import { parseApiResponse } from '../src/contracts.js';
import { describe, expect, it, vi } from 'vitest';
import { parseArgs } from '../src/args.js';
import { runCli } from '../src/cli.js';

describe('budget audit', () => {
  it('requires scope, validates filters and rejects writes before requesting', () => {
    expect(parseArgs(['budget', 'audit', '--scope', 'personal'])).toEqual({ command: 'budget-audit', scope: 'personal', limit: 20 });
    expect(() => parseArgs(['budget', 'audit'])).toThrow(/scope/);
    for (const flags of [['--apply'], ['--period', '2026-13'], ['--limit', '0'], ['--limit', '101'], ['--limit', '1.5'], ['--cursor', '../private']]) {
      expect(() => parseArgs(['budget', 'audit', '--scope', 'personal', ...flags])).toThrow();
    }
    expect(parseArgs(['budget', 'audit', '-h'])).toEqual({ command: 'help', topic: 'budget-audit' });
  });

  it('discovers audit from both command indexes and explains its limits', async () => {
    for (const args of [['--help'], ['budget', '--help'], ['budget', 'audit', '--help']]) {
      const stdout: string[] = [];
      expect(await runCli(args, { writeStdout: text => stdout.push(text) })).toBe(0);
      expect(stdout.join('')).toContain('budget audit');
      if (args.includes('audit')) for (const value of ['read-only', 'agent:read', '--period', '--cursor', 'null', 'causes', 'JSON', '20', '100']) expect(stdout.join('')).toContain(value);
    }
  });

  it('uses one GET with no refresh preference and rejects malformed responses', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ bogus: true })));
    const stderr: string[] = [];
    const stdout: string[] = [];
    expect(await runCli(['budget', 'audit', '--scope', 'joint', '--period', '2026-09', '--limit', '5'], {
      env: { SLOTH_AGENT_TOKEN: 'synthetic-token' }, fetch,
      writeStdout: text => stdout.push(text), writeStderr: text => stderr.push(text),
    })).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe('https://budget.slothmoney.app/api/agent/v1/budget-audit?scope=joint&periodKey=2026-09&limit=5');
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'GET' });
    expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty('Prefer');
    expect(stdout).toEqual([]);
    expect(stderr.join('')).toMatch(/response/i);
  });

  it('rejects otherwise valid responses for a different requested scope or history filter', async () => {
    for (const args of [
      ['budget', 'audit', '--scope', 'joint'],
      ['budget', 'audit', '--scope', 'personal', '--period', '2026-08'],
    ]) {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(budgetAuditFixture)));
      expect(await runCli(args, {
        env: { SLOTH_AGENT_TOKEN: 'synthetic-token' }, fetch,
        writeStdout: text => stdout.push(text), writeStderr: text => stderr.push(text),
      })).toBe(1);
      expect(stdout).toEqual([]);
      expect(stderr.join('')).toMatch(/response/i);
    }
  });
});


it('preserves verified zero, signed differences and unavailable amounts in valid JSON', async () => {
  for (const current of [budgetAuditFixture.current, { ...budgetAuditFixture.current, budgetRemainingPence: 0, accountBalancePence: 0, differencePence: 0 }, { ...budgetAuditFixture.current, budgetRemainingPence: 9000, differencePence: -1000 }, { ...budgetAuditFixture.current, verificationStatus: 'stale_balance', accountBalancePence: null, differencePence: null }]) {
    const response = { ...budgetAuditFixture, current };
    const stdout: string[] = [];
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)));
    expect(await runCli(['budget', 'audit', '--scope', 'personal'], { env: { SLOTH_AGENT_TOKEN: 'synthetic-token' }, fetch, writeStdout: text => stdout.push(text) })).toBe(0);
    expect(JSON.parse(stdout.join(''))).toEqual(response);
  }
});

it('rejects inconsistent money, wrong scope, private fields and missing times', () => {
  for (const response of [
    { ...budgetAuditFixture, current: { ...budgetAuditFixture.current, differencePence: 1 } },
    { ...budgetAuditFixture, current: { ...budgetAuditFixture.current, verificationStatus: 'stale_balance' } },
    { ...budgetAuditFixture, checkpoints: [{ ...budgetAuditFixture.checkpoints[0], scope: 'joint' }] },
    { ...budgetAuditFixture, checkpoints: [{ ...budgetAuditFixture.checkpoints[0], capturedBy: 'private-id' }] },
    { ...budgetAuditFixture, current: { ...budgetAuditFixture.current, sourceBalanceAt: undefined } },
  ]) expect(() => parseApiResponse('budget-audit', response)).toThrow(/response/i);
});
