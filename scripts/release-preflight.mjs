import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const entryPoint = path.join(root, 'dist', 'bin.js');

const run = (file, args, options = {}) => execFileSync(file, args, {
  cwd: root,
  encoding: 'utf8',
  ...options,
}).trim();

run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);

const packed = JSON.parse(run(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['pack', '--dry-run', '--json'],
));
const packedVersion = packed[0]?.version;
assert.equal(packedVersion, packageJson.version, 'packed package version differs from package.json');

const helpRoutes = [
  [],
  ['auth'], ['auth', 'login'], ['auth', 'status'], ['auth', 'logout'],
  ['accounts'], ['accounts', 'list'], ['accounts', 'update'], ['accounts', 'remove'],
  ['investments'],
  ['budget'], ['budget', 'status'], ['budget', 'update'], ['budget', 'move'],
  ['categories'], ['categories', 'list'], ['categories', 'create'], ['categories', 'rename'],
  ['line-items'], ['line-items', 'create'], ['line-items', 'rename'],
  ['transactions'], ['assign'],
  ['partner'], ['partner', 'status'],
  ['rules'], ['rules', 'list'], ['rules', 'get'], ['rules', 'set'], ['rules', 'delete'], ['rules', 'scan-contract'],
  ['receipts'], ['receipts', 'extract'], ['receipts', 'get'], ['receipts', 'attach'], ['receipts', 'remove'],
  ['goals'], ['goals', 'list'], ['goals', 'create'], ['goals', 'update'],
  ['goals', 'mark-spent'], ['goals', 'restore'], ['goals', 'delete'],
  ['scenarios'], ['scenarios', 'list'], ['scenarios', 'create'],
  ['scenarios', 'update'], ['scenarios', 'activate'], ['scenarios', 'delete'],
  ['ask-partner'],
];

const helpByRoute = new Map();
for (const route of helpRoutes) {
  const result = spawnSync(process.execPath, [entryPoint, ...route, '--help'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `help failed for: sloth-agent ${route.join(' ')}`);
  assert.equal(result.stderr, '', `help wrote diagnostics for: sloth-agent ${route.join(' ')}`);
  assert.ok(result.stdout.trim(), `help was empty for: sloth-agent ${route.join(' ')}`);
  helpByRoute.set(route.join(' '), result.stdout);
}

const nestedCommands = new Map([
  ['auth', ['login', 'status', 'logout']],
  ['accounts', ['list', 'update', 'remove']],
  ['budget', ['status', 'update', 'move']],
  ['categories', ['list', 'create', 'rename']],
  ['line-items', ['create', 'rename']],
  ['rules', ['list', 'get', 'set', 'delete', 'scan-contract']],
  ['receipts', ['extract', 'get', 'attach', 'remove']],
  ['goals', ['list', 'create', 'update', 'mark-spent', 'restore', 'delete']],
  ['scenarios', ['list', 'create', 'update', 'activate', 'delete']],
  ['partner', ['status']],
]);
const normalizedTopLevelHelp = helpByRoute.get('').replace(/\s+/g, ' ');
for (const route of helpRoutes.filter(route => route.length > 0)) {
  const command = route.at(-1) === 'list'
    ? `sloth-agent ${route.slice(0, -1).join(' ')} [list]`
    : `sloth-agent ${route.join(' ')}`;
  assert.ok(
    normalizedTopLevelHelp.includes(command),
    `top-level help does not advertise: ${command}`,
  );
}

for (const [parent, children] of nestedCommands) {
  const parentHelp = helpByRoute.get(parent);
  for (const child of children) {
    assert.match(parentHelp, new RegExp(`sloth-agent ${parent} ${child.replace('-', '\\-')}`));
  }
}

const executableNames = process.platform === 'win32'
  ? ['sloth-agent.cmd', 'sloth-agent.exe', 'sloth-agent']
  : ['sloth-agent'];
const globallyInstalled = [];
const seenExecutables = new Set();
for (const directory of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
  for (const executableName of executableNames) {
    const executablePath = path.resolve(directory, executableName);
    try {
      fs.accessSync(executablePath, fs.constants.X_OK);
      const canonicalPath = fs.realpathSync(executablePath);
      if (seenExecutables.has(canonicalPath)) continue;
      seenExecutables.add(canonicalPath);
      const result = spawnSync(executablePath, ['--version'], { encoding: 'utf8' });
      globallyInstalled.push({
        path: executablePath,
        version: result.status === 0 ? result.stdout.trim() : 'unavailable',
      });
    } catch {
      continue;
    }
  }
}
const registryVersion = run(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['view', packageJson.name, 'version'],
);
const branch = run('git', ['branch', '--show-current']) || '(detached)';
const commit = run('git', ['rev-parse', '--short', 'HEAD']);

process.stdout.write(`${JSON.stringify({
  localCheckout: { version: packageJson.version, branch, commit },
  packedPackage: { version: packedVersion },
  globallyInstalled,
  npmRegistry: { version: registryVersion },
  helpRoutesChecked: helpRoutes.length,
}, null, 2)}\n`);
