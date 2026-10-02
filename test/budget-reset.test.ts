import { describe, expect, it, vi } from 'vitest';
import { parseArgs } from '../src/args.js';
import { runCli } from '../src/cli.js';

const fingerprint = 'a'.repeat(64);
const response = {
  scope: 'personal', periodKey: '2026-10', currency: 'GBP', target: 'assigned',
  previewFingerprint: fingerprint, applied: false, noOp: false,
  toAssignBeforePence: 5000, toAssignAfterPence: 5000,
  categories: [{ categoryId: 'groceries', categoryName: 'Groceries', assignedBeforePence: 8000, assignedAfterPence: 0 }],
};

describe('budget resets', () => {
  it.each(['to-assign', 'assigned'])('parses preview and guarded apply for %s', target => {
    expect(parseArgs(['budget', 'reset', target, '--scope', 'joint'])).toMatchObject({ command: 'budget-reset', target, scope: 'joint', apply: false });
    expect(parseArgs(['budget', 'reset', target, '--scope', 'personal', '--period', '2026-10', '--apply', '--expected-preview', fingerprint])).toMatchObject({ command: 'budget-reset', target, expectedPreview: fingerprint, periodKey: '2026-10', apply: true });
  });
  it.each([
    ['assigned'], ['all', '--scope', 'personal'], ['assigned', '--scope', 'personal', '--apply'],
    ['assigned', '--scope', 'personal', '--expected-preview', fingerprint],
    ['assigned', '--scope', 'personal', '--apply', '--expected-preview', 'bad'],
    ['assigned', '--scope', 'personal', '--period', '2026-13'],
    ['to-assign', '--scope', 'personal', '--amount', '50'],
  ])('rejects invalid reset arguments %j', (...args) => expect(() => parseArgs(['budget', 'reset', ...args])).toThrow());
  it.each([[], ['budget'], ['budget', 'reset'], ['budget', 'reset', 'assigned'], ['budget', 'reset', 'to-assign']])('routes help without credentials %j', async (...args) => {
    const stdout = vi.fn(); const fetch = vi.fn();
    expect(await runCli([...args, '--help'], { env: {}, writeStdout: stdout, writeStderr: vi.fn(), fetch })).toBe(0);
    expect(stdout.mock.calls.flat().join('')).toContain('budget reset');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([false, true])('sends a validated request and prints validated JSON (apply %s)', async apply => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...response, applied: apply })));
    const stdout = vi.fn();
    const args = ['budget', 'reset', 'assigned', '--scope', 'personal', '--period', '2026-10'];
    if (apply) args.push('--apply', '--expected-preview', fingerprint);
    expect(await runCli(args, { env: { SLOTH_AGENT_TOKEN: 'sloth_pat_v1_local_contract_fixture' }, fetch, writeStdout: stdout, writeStderr: vi.fn() })).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0]!;
    expect(url).toBe(`https://budget.slothmoney.app/api/agent/v1/budget-resets${apply ? '' : '/preview'}`);
    expect(JSON.parse(options.body)).toEqual({ scope: 'personal', target: 'assigned', periodKey: '2026-10', ...(apply ? { expectedPreview: fingerprint } : {}) });
    expect(JSON.parse(stdout.mock.calls[0]![0])).toEqual({ ...response, applied: apply });
  });
  it('rejects invalid remote money without printing the response', async () => {
    const stdout = vi.fn(); const stderr = vi.fn();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...response, toAssignAfterPence: 1.5, private: 'hidden' })));
    expect(await runCli(['budget', 'reset', 'assigned', '--scope', 'personal'], { env: { SLOTH_AGENT_TOKEN: 'sloth_pat_v1_local_contract_fixture' }, fetch, writeStdout: stdout, writeStderr: stderr })).not.toBe(0);
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr.mock.calls.flat().join('')).not.toContain('hidden');
  });
  it('does not retry a stale preview', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Budget changed. Preview again.', code: 'stale_preview' }), { status: 409 }));
    expect(await runCli(['budget', 'reset', 'assigned', '--scope', 'personal', '--apply', '--expected-preview', fingerprint], { env: { SLOTH_AGENT_TOKEN: 'sloth_pat_v1_local_contract_fixture' }, fetch, writeStdout: vi.fn(), writeStderr: vi.fn() })).not.toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
