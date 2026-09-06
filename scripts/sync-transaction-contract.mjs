import fs from 'node:fs';
import path from 'node:path';

// Git may check out the same contract with CRLF on Windows.
const readContract = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  process.stdout.write('Usage: node scripts/sync-transaction-contract.mjs --server-repo PATH [--check]\nCopies the versioned public schemas and synthetic fixtures from sloth-budget.\n--check compares without writing and exits nonzero on drift.\n');
  process.exit(0);
}
const sourceIndex = args.indexOf('--server-repo');
if (sourceIndex < 0 || !args[sourceIndex + 1]
  || args.some((arg, index) => index !== sourceIndex + 1 && !['--server-repo', '--check'].includes(arg))) {
  throw new Error('Supply --server-repo PATH; see --help');
}
const sourceRoot = path.resolve(args[sourceIndex + 1]);
const source = path.join(sourceRoot, 'server/src/contracts/public/agent-v1');
const destination = path.join(root, 'src/generated/agent-v1');
const files = ['transactions.ts', 'transactionRefresh.ts', 'transactionFixtures.ts', 'budgetFunding.ts'];
const header = '// Generated from sloth-budget/server/src/contracts/public/agent-v1. Do not edit.\n';
const zodVersion = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'server/package.json'), 'utf8')).dependencies['zod-v4'];
const localVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies['zod-v4'];
if (zodVersion !== localVersion) throw new Error('Server and CLI must pin the same zod-v4 version');
const entries = files.map(file => [file, header + readContract(path.join(source, file))]);
if (!args.includes('--check')) fs.mkdirSync(destination, { recursive: true });
for (const [file, content] of entries) {
  const target = path.join(destination, file);
  if (args.includes('--check')) {
    if (!fs.existsSync(target) || readContract(target) !== content) {
      throw new Error(`Public Agent contract drift: ${file}. Run contracts:sync with the same --server-repo.`);
    }
  } else fs.writeFileSync(target, content);
}
process.stdout.write(`Public Agent contract ${args.includes('--check') ? 'matches' : 'generated'} (agent-v1).\n`);
