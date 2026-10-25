import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { wealthReadFixture } from '../src/generated/agent-v1/wealthFixtures.js';
import { parseArgs } from '../src/args.js';
import { runCli } from '../src/cli.js';

describe('wealth command surface', () => {
  it('routes nested help and validates horizon and write options', async () => {
    for (const args of [[], ['documents'], ['documents', 'extract'], ['documents', 'review'], ['documents', 'save'], ['properties'], ['properties', 'save'], ['mortgages', 'remove'], ['forecast']]) {
      const output: string[] = [];
      expect(await runCli(['wealth', ...args, '--help'], { writeStdout: text => output.push(text) })).toBe(0);
      expect(output.join('')).toContain(`wealth${args.length ? ' ' + args.join(' ') : ''}`);
    }
    expect(() => parseArgs(['wealth', 'forecast', '--months', '1201'])).toThrow();
    expect(() => parseArgs(['wealth', 'read', '--apply'])).toThrow();
    expect(() => parseArgs(['wealth', 'documents', 'extract'])).toThrow(/file/);
  });
  it('uses owner-only wealth reads and validates results without loading native credentials', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ private: 'unexpected' })));
    const output: string[] = [], errors: string[] = [];
    const store = vi.fn();
    expect(await runCli(['wealth'], { env: { SLOTH_AGENT_TOKEN: 'test-env-token' }, fetch, getCredentialStore: store, writeStdout: text => output.push(text), writeStderr: text => errors.push(text) })).toBe(1);
    expect(fetch.mock.calls[0]?.[0]).toBe('https://budget.slothmoney.app/api/agent/v1/wealth');
    expect(output).toEqual([]);
    expect(errors.join('')).not.toContain('unexpected');
    expect(store).not.toHaveBeenCalled();
  });
});

it('validates a local PDF without uploading or loading credentials', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-cli-file-'));
  const file = path.join(directory, 'mortgage.pdf');
  fs.writeFileSync(file, '%PDF-1.7');
  const fetch = vi.fn(), store = vi.fn(), output: string[] = [];
  try {
    expect(await runCli(['wealth', 'documents', 'extract', '--file', file], { env: {}, fetch, getCredentialStore: store, writeStdout: value => output.push(value) })).toBe(0);
    expect(JSON.parse(output.join(''))).toMatchObject({ uploaded: false, mimeType: 'application/pdf' });
    expect(fetch).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
it('returns validated current wealth without changing its units or calculating totals locally', async () => {
  const output: string[] = [];
  expect(await runCli(['wealth'], { env: { SLOTH_AGENT_TOKEN: 'test-env-token' }, fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(wealthReadFixture))), writeStdout: value => output.push(value) })).toBe(0);
  expect(JSON.parse(output.join(''))).toEqual(wealthReadFixture);
});

it('explains the budget payment choices without implying it reads property records', async () => {
  const output: string[] = [];
  expect(await runCli(['wealth', 'budget-payments', '--help'], { writeStdout: text => output.push(text) })).toBe(0);
  expect(output.join('')).toContain('personal and available joint budget payments');
  expect(output.join('')).toContain('lineItemId');
});
