import { budgetHistoryFixture } from '../src/generated/agent-v1/budgetHistoryFixtures.js';
import { describe, expect, it, vi } from 'vitest';
import { parseArgs } from '../src/args.js';
import { runCli } from '../src/cli.js';
import { parseApiResponse } from '../src/contracts.js';

const cursor = '00000000-0000-4000-8000-000000000001';
const response = budgetHistoryFixture;

describe('budget history', () => {
  it('requires a scope and validates periods, limits and cursors before requesting', () => {
    expect(parseArgs(['budget', 'history', '--scope', 'personal'])).toEqual({ command: 'budget-history', scope: 'personal', limit: 20 });
    for (const extra of [['--limit', '0'], ['--limit', '101'], ['--limit', '1.5'], ['--period', '2026-13'], ['--cursor', 'bad'], ['--apply']]) expect(() => parseArgs(['budget', 'history', '--scope', 'personal', ...extra])).toThrow();
    expect(() => parseArgs(['budget', 'history'])).toThrow(/scope/);
    expect(parseArgs(['budget', 'history', '-h'])).toEqual({ command: 'help', topic: 'budget-history' });
  });
  it('explains the history boundary and pagination through nested and parent help', async () => {
    for (const args of [['budget', 'history', '--help'], ['budget', '--help'], ['--help']]) {
      const stdout: string[] = [];
      expect(await runCli(args, { writeStdout: text => stdout.push(text) })).toBe(0);
      expect(stdout.join('')).toContain('budget history');
      if (args.includes('history')) for (const value of ['read-only', 'agent:read', '--cursor', '1–100', 'older saves', 'JSON']) expect(stdout.join('')).toContain(value);
    }
  });
  it('makes one read and validates the server response without loading native credentials', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)));
    const stdout: string[] = [];
    expect(await runCli(['budget', 'history', '--scope', 'personal', '--period', '2026-09', '--limit', '5', '--cursor', cursor], { env: { SLOTH_AGENT_TOKEN: 'local-test-token' }, fetch, writeStdout: text => stdout.push(text) })).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe(`https://budget.slothmoney.app/api/agent/v1/budget-history?scope=personal&periodKey=2026-09&limit=5&cursor=${cursor}`);
    expect(JSON.parse(stdout.join(''))).toEqual(response);
  });
  it('rejects missing history coverage and private editor IDs in the public shape', () => {
    expect(parseApiResponse('budget-history', response)).toEqual(response);
    expect(() => parseApiResponse('budget-history', { ...response, historyCoverage: undefined })).toThrow();
    expect(() => parseApiResponse('budget-history', { ...response, metadata: { ...response.metadata, actorUid: 'user-1' } })).toThrow();
  });
});
