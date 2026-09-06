import { spawnSync } from 'node:child_process';

// A thread pool lets the hard timeout stop workers with the runner process.
const result = spawnSync(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run', '--pool=threads', '--maxWorkers=1',
  ...process.argv.slice(2),
], { stdio: 'inherit', timeout: 120_000, killSignal: 'SIGKILL' });
if (result.error) process.stderr.write(`Test runner failed: ${result.error.code}\n`);
process.exitCode = result.status ?? 1;
