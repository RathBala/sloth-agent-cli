import { describe, expect, it, vi } from 'vitest';
import { parseArgs } from '../src/args.js';
import { runCli } from '../src/cli.js';

const fingerprint = 'a'.repeat(64);
describe('budget funding commands', () => {
  it('parses preview and guarded apply', () => {
    expect(parseArgs(['budget', 'fill', '--scope', 'personal', '--mode', 'auto'])).toMatchObject({ command: 'budget-fill', scope: 'personal', mode: 'auto', apply: false });
    expect(parseArgs(['budget', 'fund-ahead', '--scope', 'joint', '--apply', '--expected-preview', fingerprint])).toMatchObject({ command: 'budget-fund-ahead', mode: 'fund-ahead', expectedPreview: fingerprint, apply: true });
  });
  it.each([
    ['fill', '--scope', 'personal'],
    ['fill', '--scope', 'personal', '--mode', 'auto', '--apply'],
    ['fund-ahead', '--scope', 'personal', '--amount', '10'],
    ['fund-ahead', '--scope', 'personal', '--input', 'overrides.json'],
    ['fill', '--scope', 'personal', '--mode', 'auto', '--expected-preview', fingerprint],
  ])('rejects invalid arguments %j', (...args) => expect(() => parseArgs(['budget', ...args])).toThrow());
  it.each(['fill', 'fund-ahead'])('has command-specific help for %s without authentication', async command => {
    const stdout = vi.fn(); const fetch = vi.fn();
    expect(await runCli(['budget', command, '--help'], { writeStdout: stdout, writeStderr: vi.fn(), env: {}, fetch })).toBe(0);
    expect(stdout.mock.calls.flat().join('')).toContain('--expected-preview'); expect(fetch).not.toHaveBeenCalled();
  });
});
