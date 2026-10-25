import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from '../src/args.js';
import { runCli } from '../src/cli.js';

describe('household goals and routing commands', () => {
  it('lists each workflow once in its indexes and keeps create examples executable', async () => {
    async function help(words: string[]) {
      const output: string[] = [];
      expect(await runCli([...words, '--help'], { writeStdout: text => output.push(text) })).toBe(0);
      return output.join('');
    }
    const top = await help([]);
    expect(top.match(/^ {2}sloth-agent goals joint\b/gm)).toHaveLength(1);
    expect(top.match(/^ {2}sloth-agent scenarios routing\b/gm)).toHaveLength(1);
    expect((await help(['goals'])).match(/^ {2}sloth-agent goals joint\b/gm)).toHaveLength(1);
    expect((await help(['scenarios'])).match(/^ {2}sloth-agent scenarios routing\b/gm)).toHaveLength(1);
    const create = await help(['scenarios', 'create']);
    expect(create).not.toContain('sloth-agent scenarios routing');
    expect(create).toContain('sloth-agent scenarios create --month 2026-09');
  });
  it('routes every parent and leaf help page without credentials', async () => {
    for (const words of [['goals', 'joint'], ['goals', 'joint', 'list'], ['goals', 'joint', 'create'], ['goals', 'joint', 'convert'], ['goals', 'joint', 'update'], ['goals', 'joint', 'delete'], ['scenarios', 'routing'], ['scenarios', 'routing', 'read'], ['scenarios', 'routing', 'save']]) {
      const output: string[] = [];
      expect(await runCli([...words, '--help'], { writeStdout: text => output.push(text) })).toBe(0);
      expect(output.join('')).toContain(words.join(' '));
    }
    expect(() => parseArgs(['goals', 'joint', 'create'])).toThrow(/input/);
    expect(() => parseArgs(['goals', 'joint', 'list', '--apply'])).toThrow();
  });
  it('explains that conflicting partner defaults require a reviewed split', async () => {
    const output: string[] = [];
    expect(await runCli(['goals', 'joint', 'list', '--help'], { writeStdout: text => output.push(text) })).toBe(0);
    expect(output.join('')).toContain('A null default means existing partner settings conflict; choose and review the split explicitly.');
  });
  it('uses a remote read-only preview by default and sends the identical reviewed split on apply', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sloth-joint-cli-'));
    const input = path.join(directory, 'goal.json');
    fs.writeFileSync(input, JSON.stringify({ totalAmount: 3000, viewerShareBasisPoints: 6000 }));
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'fixture conflict' }), { status: 409 }));
    const store = vi.fn();
    try {
      for (const apply of [false, true]) {
        await runCli(['goals', 'joint', 'convert', '--goal-id', 'baby', '--input', input, ...(apply ? ['--apply'] : [])], {
          env: { SLOTH_AGENT_TOKEN: 'synthetic-test-token' }, fetch, getCredentialStore: store, writeStderr: () => undefined,
        });
      }
      expect(fetch.mock.calls[0]?.[0]).toBe('https://budget.slothmoney.app/api/agent/v1/goals/baby/convert-to-joint/preview');
      expect(fetch.mock.calls[1]?.[0]).toBe('https://budget.slothmoney.app/api/agent/v1/goals/baby/convert-to-joint');
      expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ totalAmount: 3000, viewerShareBasisPoints: 6000 });
      expect(fetch.mock.calls[1]?.[1].body).toBe(fetch.mock.calls[0]?.[1].body);
      expect(store).not.toHaveBeenCalled();
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
