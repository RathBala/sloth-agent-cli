import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';

it.each(['\n', '\r\n'])('detects contract drift with %j source line endings without writing', (lineEnding) => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'sloth-schema-check-'));
  try {
    const directory = path.join(source, 'server/src/contracts/public/agent-v1');
    fs.mkdirSync(directory, { recursive: true });
    const files = ['transactions.ts', 'transactionRefresh.ts', 'transactionFixtures.ts', 'budgetFunding.ts'];
    for (const file of files) {
      const generated = fs.readFileSync(`src/generated/agent-v1/${file}`, 'utf8');
      fs.writeFileSync(path.join(directory, file), generated.slice(generated.indexOf('\n') + 1).replace(/\r?\n/g, lineEnding));
    }
    const manifest = path.join(source, 'server/package.json');
    fs.writeFileSync(manifest, JSON.stringify({ dependencies: { 'zod-v4': 'npm:zod@4.1.12' } }));
    const args = ['scripts/sync-transaction-contract.mjs', '--check', '--server-repo', source];
    expect(execFileSync(process.execPath, args, { encoding: 'utf8' })).toContain('matches');
    for (const file of files) {
      const target = path.join(directory, file);
      const original = fs.readFileSync(target, 'utf8');
      fs.appendFileSync(target, '\n// drift\n');
      const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`Public Agent contract drift: ${file}`);
      fs.writeFileSync(target, original);
    }
    fs.writeFileSync(manifest, JSON.stringify({ dependencies: { 'zod-v4': 'different' } }));
    expect(spawnSync(process.execPath, args, { encoding: 'utf8' }).stderr).toContain('pin the same');
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
  }
});
