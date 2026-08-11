import assert from 'node:assert/strict';
import {
  execFileSync,
  spawnSync,
} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sloth-agent-package-'));
const isWindows = process.platform === 'win32';
const npmExecutable = isWindows ? 'npm.cmd' : 'npm';
const commandOptions = isWindows ? { shell: true } : {};

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.bin?.['sloth-agent'], 'dist/bin.js', 'package must expose the sloth-agent binary');

  const packOutput = execFileSync(
    npmExecutable,
    ['pack', '--json', '--pack-destination', temporaryDirectory],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_cache: path.join(temporaryDirectory, 'npm-cache'),
      },
      ...commandOptions,
    },
  );
  const [{ filename, files }] = JSON.parse(packOutput);
  const includedPaths = files.map((file) => file.path);
  assert(includedPaths.includes('dist/bin.js'));
  assert(!includedPaths.some((file) => file.startsWith('src/')));
  assert(!includedPaths.some((file) => file.startsWith('test/')));
  assert(!includedPaths.some((file) => file.endsWith('.map')));

  const installDirectory = path.join(temporaryDirectory, 'install');
  fs.mkdirSync(installDirectory);
  execFileSync(npmExecutable, ['init', '--yes'], {
    cwd: installDirectory,
    stdio: 'ignore',
    env: {
      ...process.env,
      npm_config_cache: path.join(temporaryDirectory, 'npm-cache'),
    },
    ...commandOptions,
  });
  execFileSync(npmExecutable, ['install', path.join(temporaryDirectory, filename)], {
    cwd: installDirectory,
    stdio: 'ignore',
    env: {
      ...process.env,
      npm_config_cache: path.join(temporaryDirectory, 'npm-cache'),
    },
    ...commandOptions,
  });

  const executable = path.join(
    installDirectory,
    'node_modules',
    '.bin',
    isWindows ? 'sloth-agent.cmd' : 'sloth-agent',
  );
  assert.equal(
    execFileSync(executable, ['--version'], {
      encoding: 'utf8',
      ...commandOptions,
    }).trim(),
    packageJson.version,
  );
  const help = execFileSync(executable, ['--help'], {
    encoding: 'utf8',
    ...commandOptions,
  });
  assert.match(help, /sloth-agent auth login/);
  assert.match(help, /sloth-agent auth status/);
  assert.match(help, /sloth-agent auth logout/);
  assert.match(help, /sloth-agent accounts/);
  assert.match(help, /sloth-agent accounts update/);
  assert.match(help, /sloth-agent investments/);
  assert.match(help, /sloth-agent budget --scope personal\|joint/);
  assert.match(help, /sloth-agent budget update/);
  assert.match(help, /sloth-agent categories create/);
  assert.match(help, /sloth-agent line-items create/);
  assert.match(help, /sloth-agent transactions/);
  assert.match(help, /sloth-agent goals create/);
  assert.match(help, /sloth-agent goals update/);
  assert.match(help, /sloth-agent goals delete/);

  const commandHelpCases = [
    [['auth', 'login', '--help'], [/hidden prompt/]],
    [['accounts', '--help'], [/existing Sloth account inventory/, /read-only/, /accountRef/, /isGoalSavingsSource/]],
    [['accounts', 'update', '--help'], [/--goal-savings-source true\|false/, /Without --apply/, /Partner-owned/, /agent:write/, /Account not found/]],
    [['investments', '--help'], [/cache-only/, /provider-native/, /holdings/, /agent:read/, /Investment account not found/]],
    [['budget', '--help'], [/--scope personal\|joint/, /periodStatus/, /funding/, /read-only/]],
    [['budget', 'update', '--help'], [/--input FILE/, /plannedPence/, /Without --apply/, /every explicit future plan/, /Historical periods cannot be changed/]],
    [['categories', '--help'], [/A category is the broader parent\./]],
    [['categories', 'create', '--help'], [/--icon-key KEY/, /no mutation request/]],
    [['categories', 'rename', '--help'], [/Built-in categories are immutable/]],
    [['line-items', 'create', '--help'], [/at zero/, /explicit future plans/]],
    [['line-items', 'rename', '--help'], [/--line-item-id ID/, /Historical snapshots remain unchanged/]],
    [['transactions', '--help'], [/1 to 200/, /--line-item-id ID/, /waits up to 45 seconds/, /remotely persists booked transactions/, /refresh status/]],
    [['assign', '--help'], [
      /An assignment categorises an existing transaction/,
      /PASTE_THE_EXACT_TRANSACTION_REF_HERE/,
      /does not contact Sloth Money/,
      /Sloth Money → Transactions/,
      /Assignments do not create a separate list\./,
    ]],
    [['goals', 'list', '--help'], [/No filters or singular get/]],
    [['goals', 'create', '--help'], [/--name NAME\s+Required/]],
    [['goals', 'update', '--help'], [/--clear-target-amount/, /--priority POSITION/, /Priority must be updated on its own/, /Priority 1 is highest/]],
    [['goals', 'delete', '--help'], [/removes its goal drift history/]],
    [['ask-partner', '--help'], [/--transaction-ref REF\s+Required/]],
  ];
  for (const [args, expectedPatterns] of commandHelpCases) {
    const commandHelp = execFileSync(executable, args, {
      encoding: 'utf8',
      ...commandOptions,
    });
    for (const expected of expectedPatterns) {
      assert.match(commandHelp, expected);
    }
  }

  fs.rmSync(
    path.join(installDirectory, 'node_modules', '@github', 'keytar'),
    { force: true, recursive: true },
  );
  const environmentOnlyStatus = spawnSync(
    executable,
    ['auth', 'status', '--base-url', 'http://localhost:1'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        SLOTH_AGENT_TOKEN: 'sloth_pat_v1_package-smoke',
      },
      ...commandOptions,
    },
  );
  assert.equal(environmentOnlyStatus.status, 1);
  assert.equal(environmentOnlyStatus.stderr, '');
  assert.equal(
    JSON.parse(environmentOnlyStatus.stdout).remoteStatus,
    'unreachable',
  );
} finally {
  fs.rmSync(temporaryDirectory, { force: true, recursive: true });
}
