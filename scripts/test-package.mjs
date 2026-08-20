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
  const packagedEntryPoint = path.join(
    installDirectory,
    'node_modules',
    '@slothmoney',
    'agent-cli',
    'dist',
    'bin.js',
  );
  assert(fs.existsSync(executable));
  const runCliSync = (args, options = {}) => execFileSync(
    isWindows ? process.execPath : executable,
    isWindows ? [packagedEntryPoint, ...args] : args,
    options,
  );
  const spawnCliSync = (args, options = {}) => spawnSync(
    isWindows ? process.execPath : executable,
    isWindows ? [packagedEntryPoint, ...args] : args,
    options,
  );
  assert.equal(
    runCliSync(['--version'], {
      encoding: 'utf8',
    }).trim(),
    packageJson.version,
  );
  const help = runCliSync(['--help'], {
    encoding: 'utf8',
  });
  assert.match(help, /sloth-agent auth login/);
  assert.match(help, /sloth-agent auth status/);
  assert.match(help, /sloth-agent auth logout/);
  assert.match(help, /sloth-agent accounts/);
  assert.match(help, /sloth-agent accounts update/);
  assert.match(help, /sloth-agent accounts remove/);
  assert.match(help, /sloth-agent investments/);
  assert.match(help, /sloth-agent budget --scope personal\|joint/);
  assert.match(help, /sloth-agent budget status/);
  assert.match(help, /sloth-agent budget update/);
  assert.match(help, /sloth-agent budget move/);
  assert.match(help, /sloth-agent categories create/);
  assert.match(help, /sloth-agent line-items create/);
  assert.match(help, /sloth-agent transactions/);
  assert.match(help, /sloth-agent goals create/);
  assert.match(help, /sloth-agent goals update/);
  assert.match(help, /sloth-agent goals mark-spent/);
  assert.match(help, /sloth-agent goals restore/);
  assert.match(help, /sloth-agent goals delete/);
  assert.match(help, /Every nested subcommand has its own help/);

  const commandHelpCases = [
    [['auth', 'login', '--help'], [/hidden prompt/]],
    [['accounts', '--help'], [/accounts list/, /accounts update/, /accounts remove/, /existing Sloth account inventory/, /read-only/, /accountRef/, /isGoalSavingsSource/]],
    [['accounts', 'update', '--help'], [/--institution-name NAME/, /--ownership individual\|joint/, /--goal-savings-source true\|false/, /Without --apply/, /Partner-owned/, /agent:write/, /Account not found/]],
    [['accounts', 'remove', '--help'], [/archive/, /retaining its underlying records/, /Without --apply/, /changed false/]],
    [['investments', '--help'], [/cache-only/, /provider-native/, /holdings/, /agent:read/, /Investment account not found/]],
    [['budget', '--help'], [/sloth-agent budget\s+Read one budget period\./, /budget status/, /budget update/, /budget move/, /--scope personal\|joint/, /periodStatus/, /funding/, /read-only/]],
    [['budget', 'status', '--help'], [/current Sloth budget period/, /spentPence/, /availablePence/, /uncategorizedSpentPence/, /read-only/, /refresh/]],
    [['budget', 'update', '--help'], [/--input FILE/, /plannedPence/, /Without --apply/, /every explicit future plan/, /Historical periods cannot be changed/]],
    [['budget', 'move', '--help'], [/--from-category-id ID/, /--amount AMOUNT/, /9,007,199,254,740,991/, /To Assign/, /Without --apply/, /may become negative/, /does not change planned amounts/]],
    [['categories', '--help'], [
      /categories list/,
      /categories create/,
      /categories rename/,
      /A category is the broader parent\./,
      /most specific suitable line item/,
      /category's "Other" line item/,
    ]],
    [['categories', 'create', '--help'], [/--icon-key KEY/, /no mutation request/]],
    [['categories', 'rename', '--help'], [/Built-in categories are immutable/]],
    [['line-items', '--help'], [/line-items create/, /line-items rename/, /command-specific details/]],
    [['line-items', 'create', '--help'], [/at zero/, /explicit future plans/]],
    [['line-items', 'rename', '--help'], [/--line-item-id ID/, /Historical snapshots remain unchanged/]],
    [['transactions', '--help'], [
      /selected assignment scope/,
      /--shared\[=true\|false\]/,
      /native scope is used when omitted/,
      /1 to 200/,
      /--line-item-id ID/,
      /waits up to 45 seconds/,
      /remotely persists booked transactions/,
      /refresh status/,
      /top-level categoryId, lineItemId, and categorySplits/,
      /jointBudgetContribution/,
      /uncategorised personally while its joint-budget contribution/,
    ]],
    [['assign', '--help'], [
      /transaction sharing and category assignments/,
      /sharing\.isShared/,
      /shareRatio/,
      /userExclusiveAmountPence/,
      /partnerExclusiveAmountPence/,
      /PASTE_THE_EXACT_TRANSACTION_REF_HERE/,
      /PASTE_A_LINE_ITEM_ID_HERE/,
      /native scope is used when assignmentScope is omitted/,
      /most specific suitable line item/,
      /category's Other line item/,
      /transactions --assignment-scope personal --uncategorized/,
      /transactions --assignment-scope personal --limit 50/,
      /does not contact Sloth Money/,
      /Sloth Money → Transactions/,
      /Assignments do not create a separate list\./,
    ]],
    [['goals', 'list', '--help'], [/No filters or singular get/]],
    [['goals', 'create', '--help'], [/--name NAME\s+Required/, /--target-amount AMOUNT\s+Required/, /--type keep\|spend\s+Required/]],
    [['goals', 'update', '--help'], [/--type keep\|spend/, /--priority POSITION/, /Priority must be updated on its own/, /Restore a spent goal before changing its type/]],
    [['goals', 'mark-spent', '--help'], [/\{"isSpent":true\}/, /Keep goals cannot be marked spent/, /Without --apply/]],
    [['goals', 'restore', '--help'], [/\{"isSpent":false\}/, /clears spentAt/, /Without --apply/]],
    [['goals', 'delete', '--help'], [/removes its goal drift history/]],
    [['ask-partner', '--help'], [/--transaction-ref REF\s+Required/]],
  ];
  for (const [args, expectedPatterns] of commandHelpCases) {
    const commandHelp = runCliSync(args, {
      encoding: 'utf8',
    });
    for (const expected of expectedPatterns) {
      assert.match(commandHelp, expected);
    }
  }

  const goalCreatePreview = JSON.parse(runCliSync([
    'goals', 'create', '--name', 'Wedding', '--target-amount', '22000',
    '--target-month', '2027-06', '--type', 'spend',
  ], {
    encoding: 'utf8',
    env: { ...process.env, SLOTH_AGENT_TOKEN: 'package-smoke-token' },
  }));
  assert.deepEqual(goalCreatePreview, {
    dryRun: true,
    endpoint: 'https://budget.slothmoney.app/api/agent/v1/goals',
    method: 'POST',
    payload: {
      name: 'Wedding',
      targetAmount: 22000,
      targetMonthKey: '2027-06',
      goalType: 'spend',
    },
  });

  const goalTypePreview = JSON.parse(runCliSync([
    'goals', 'update', '--goal-id', 'wedding', '--type', 'keep',
  ], {
    encoding: 'utf8',
    env: { ...process.env, SLOTH_AGENT_TOKEN: 'package-smoke-token' },
  }));
  assert.deepEqual(goalTypePreview, {
    dryRun: true,
    endpoint: 'https://budget.slothmoney.app/api/agent/v1/goals/wedding',
    method: 'PATCH',
    payload: { goalType: 'keep' },
  });

  for (const [action, isSpent] of [['mark-spent', true], ['restore', false]]) {
    const preview = JSON.parse(runCliSync([
      'goals', action, '--goal-id', 'wedding',
    ], {
      encoding: 'utf8',
      env: { ...process.env, SLOTH_AGENT_TOKEN: 'package-smoke-token' },
    }));
    assert.deepEqual(preview, {
      dryRun: true,
      endpoint: 'https://budget.slothmoney.app/api/agent/v1/goals/wedding',
      method: 'PATCH',
      payload: { isSpent },
    });
  }

  const budgetMovePreview = JSON.parse(runCliSync([
    'budget', 'move', '--scope', 'personal', '--period', '2026-08',
    '--from-category-id', 'activities', '--to-category-id', 'groceries',
    '--amount', '52.95',
  ], {
    encoding: 'utf8',
    env: { ...process.env, SLOTH_AGENT_TOKEN: 'package-smoke-token' },
  }));
  assert.deepEqual(budgetMovePreview, {
    dryRun: true,
    endpoint: 'https://budget.slothmoney.app/api/agent/v1/budget-movements',
    method: 'POST',
    payload: {
      scope: 'personal',
      periodKey: '2026-08',
      fromCategoryId: 'activities',
      toCategoryId: 'groceries',
      amountPence: 5295,
    },
  });

  const accountRef = `sloth_account_v1_${'A'.repeat(43)}`;
  const updatePreview = JSON.parse(runCliSync([
    'accounts', 'update', '--account-ref', accountRef,
    '--institution-name', 'Hargreaves Lansdown',
    '--ownership', 'individual',
    '--goal-savings-source', 'false',
  ], {
    encoding: 'utf8',
    env: { ...process.env, SLOTH_AGENT_TOKEN: '' },
  }));
  assert.deepEqual(updatePreview, {
    dryRun: true,
    endpoint: `https://budget.slothmoney.app/api/agent/v1/accounts/${accountRef}`,
    method: 'PATCH',
    payload: {
      institutionName: 'Hargreaves Lansdown',
      ownership: 'personal',
      isGoalSavingsSource: false,
    },
  });
  const removePreview = JSON.parse(runCliSync([
    'accounts', 'remove', '--account-ref', accountRef,
  ], {
    encoding: 'utf8',
    env: { ...process.env, SLOTH_AGENT_TOKEN: '' },
  }));
  assert.deepEqual(removePreview, {
    dryRun: true,
    endpoint: `https://budget.slothmoney.app/api/agent/v1/accounts/${accountRef}`,
    method: 'DELETE',
  });

  fs.rmSync(
    path.join(installDirectory, 'node_modules', '@github', 'keytar'),
    { force: true, recursive: true },
  );
  const assignmentPath = path.join(installDirectory, 'sharing-assignment.json');
  const assignmentPayload = {
    assignments: [{
      transactionRef: 'sloth_txn_package_smoke',
      sharing: {
        isShared: true,
        shareRatio: 0.6,
        userExclusiveAmountPence: 500,
        partnerExclusiveAmountPence: 0,
      },
      assignmentScope: 'joint',
      categoryId: 'groceries',
    }],
  };
  fs.writeFileSync(assignmentPath, JSON.stringify(assignmentPayload));
  const assignmentPreview = JSON.parse(runCliSync([
    'assign', '--input', assignmentPath,
  ], {
    encoding: 'utf8',
    env: { ...process.env, SLOTH_AGENT_TOKEN: '' },
  }));
  assert.deepEqual(assignmentPreview, {
    dryRun: true,
    endpoint: 'https://budget.slothmoney.app/api/agent/v1/transaction-assignments',
    payload: assignmentPayload,
  });
  const environmentOnlyStatus = spawnCliSync(
    ['auth', 'status', '--base-url', 'http://localhost:1'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        SLOTH_AGENT_TOKEN: 'package-smoke-token',
      },
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
