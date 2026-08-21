import { describe, expect, it } from 'vitest';

import {
  parseArgs,
  resolveBaseUrl,
} from '../src/args.js';

describe('CLI arguments', () => {
  it('supports help and version without configuration', () => {
    expect(parseArgs(['--help'])).toEqual({ command: 'help' });
    expect([
      parseArgs(['auth', '--help']),
      parseArgs(['auth', 'login', '--help']),
      parseArgs(['auth', 'status', '--help']),
      parseArgs(['auth', 'logout', '--help']),
      parseArgs(['accounts', '--help']),
      parseArgs(['accounts', 'update', '--help']),
      parseArgs(['accounts', 'remove', '--help']),
      parseArgs(['investments', '--help']),
      parseArgs(['categories', '--help']),
      parseArgs(['categories', 'create', '--help']),
      parseArgs(['categories', 'rename', '--help']),
      parseArgs(['line-items', '--help']),
      parseArgs(['line-items', 'create', '--help']),
      parseArgs(['line-items', 'rename', '--help']),
      parseArgs(['transactions', '--help']),
      parseArgs(['assign', '--help']),
      parseArgs(['receipts', '--help']),
      parseArgs(['receipts', 'extract', '--help']),
      parseArgs(['receipts', 'get', '--help']),
      parseArgs(['receipts', 'attach', '--help']),
      parseArgs(['receipts', 'remove', '--help']),
      parseArgs(['goals', '--help']),
      parseArgs(['goals', 'list', '--help']),
      parseArgs(['goals', 'create', '--help']),
      parseArgs(['goals', 'update', '--help']),
      parseArgs(['goals', 'mark-spent', '--help']),
      parseArgs(['goals', 'restore', '--help']),
      parseArgs(['goals', 'delete', '--help']),
      parseArgs(['ask-partner', '--help']),
    ]).toEqual([
      { command: 'help', topic: 'auth' },
      { command: 'help', topic: 'auth-login' },
      { command: 'help', topic: 'auth-status' },
      { command: 'help', topic: 'auth-logout' },
      { command: 'help', topic: 'accounts' },
      { command: 'help', topic: 'accounts-update' },
      { command: 'help', topic: 'accounts-remove' },
      { command: 'help', topic: 'investments' },
      { command: 'help', topic: 'categories' },
      { command: 'help', topic: 'categories-create' },
      { command: 'help', topic: 'categories-rename' },
      { command: 'help', topic: 'line-items' },
      { command: 'help', topic: 'line-items-create' },
      { command: 'help', topic: 'line-items-rename' },
      { command: 'help', topic: 'transactions' },
      { command: 'help', topic: 'assign' },
      { command: 'help', topic: 'receipts' },
      { command: 'help', topic: 'receipts-extract' },
      { command: 'help', topic: 'receipts-get' },
      { command: 'help', topic: 'receipts-attach' },
      { command: 'help', topic: 'receipts-remove' },
      { command: 'help', topic: 'goals' },
      { command: 'help', topic: 'goals-list' },
      { command: 'help', topic: 'goals-create' },
      { command: 'help', topic: 'goals-update' },
      { command: 'help', topic: 'goals-mark-spent' },
      { command: 'help', topic: 'goals-restore' },
      { command: 'help', topic: 'goals-delete' },
      { command: 'help', topic: 'ask-partner' },
    ]);
    expect(parseArgs(['categories', '--help', '--base-url'])).toEqual({
      command: 'help',
      topic: 'categories',
    });
    expect(parseArgs([
      '--base-url',
      'https://api.example.com',
      'auth',
      'login',
      '-h',
    ])).toEqual({
      command: 'help',
      topic: 'auth-login',
    });
    expect(parseArgs(['--version'])).toEqual({ command: 'version' });
  });

  it('parses both goal list forms', () => {
    expect(parseArgs(['goals'])).toEqual({ command: 'goals-list' });
    expect(parseArgs(['goals', 'list'])).toEqual({ command: 'goals-list' });
  });

  it('parses category list, create, and rename with preview by default', () => {
    expect(parseArgs(['categories'])).toEqual({ command: 'categories' });
    expect(parseArgs(['categories', 'list'])).toEqual({ command: 'categories' });
    expect(parseArgs([
      'categories', 'create', '--name', 'Holidays', '--icon-key=plane',
      '--type', 'Wants',
    ])).toEqual({
      command: 'categories-create',
      name: 'Holidays',
      iconKey: 'plane',
      categoryType: 'Wants',
      apply: false,
    });
    expect(parseArgs([
      'categories', 'rename', '--category-id', 'custom id', '--name', 'Travel fund', '--apply',
    ])).toEqual({
      command: 'categories-rename',
      categoryId: 'custom id',
      name: 'Travel fund',
      apply: true,
    });

    expect(() => parseArgs(['categories', 'create', '--name', 'Holidays', '--icon-key', 'bad', '--type', 'Wants']))
      .toThrow(/--icon-key/);
    expect(() => parseArgs(['categories', 'create', '--name', 'Holidays', '--icon-key', 'plane', '--type', 'Other']))
      .toThrow(/--type/);
    expect(() => parseArgs(['categories', 'rename', '--category-id', 'built/in', '--name', 'Food']))
      .toThrow(/valid category document ID/);
  });

  it('parses scoped line-item create and rename with preview by default', () => {
    expect(parseArgs([
      'line-items', 'create', '--scope', 'personal', '--category-id', 'groceries', '--name', 'Weekly',
    ])).toEqual({
      command: 'line-items-create',
      scope: 'personal',
      categoryId: 'groceries',
      name: 'Weekly',
      apply: false,
    });
    expect(parseArgs([
      'line-items', 'rename', '--scope=joint', '--category-id=groceries',
      '--line-item-id=weekly', '--name=Essentials', '--apply',
    ])).toEqual({
      command: 'line-items-rename',
      scope: 'joint',
      categoryId: 'groceries',
      lineItemId: 'weekly',
      name: 'Essentials',
      apply: true,
    });

    expect(() => parseArgs(['line-items', 'create', '--scope', 'native', '--category-id', 'groceries', '--name', 'Weekly']))
      .toThrow(/personal or joint/);
    expect(() => parseArgs(['line-items', 'rename', '--scope', 'personal', '--category-id', 'groceries', '--name', 'Weekly']))
      .toThrow(/requires --line-item-id/);
  });

  it('parses the read-only accounts command without options', () => {
    expect(parseArgs(['accounts'])).toEqual({ command: 'accounts' });
    expect(parseArgs([
      '--base-url',
      'http://localhost:4101',
      'accounts',
    ])).toEqual({
      command: 'accounts',
      baseUrl: 'http://localhost:4101',
    });
    expect(() => parseArgs(['accounts', '--refresh']))
      .toThrow(/Unknown accounts option/);
  });

  it('parses account list, partial updates, and removal with preview by default', () => {
    const accountRef = `sloth_account_v1_${'A'.repeat(43)}`;
    expect(parseArgs(['accounts', 'list'])).toEqual({ command: 'accounts' });
    expect(parseArgs([
      'accounts', 'update', '--account-ref', accountRef,
      '--goal-savings-source', 'false', '--apply',
    ])).toEqual({
      command: 'accounts-update',
      accountRef,
      update: { isGoalSavingsSource: false },
      apply: true,
    });
    expect(parseArgs([
      'accounts', 'update', '--account-ref', accountRef,
      '--institution-name', 'Hargreaves Lansdown',
      '--account-name', 'Stocks & Shares ISA',
      '--currency', 'gbp',
      '--ownership', 'joint',
      '--balance-amount', '12500.75',
      '--account-type', 'investments',
      '--goal-savings-source', 'false', '--apply',
    ])).toEqual({
      command: 'accounts-update',
      accountRef,
      update: {
        institutionName: 'Hargreaves Lansdown',
        accountName: 'Stocks & Shares ISA',
        currency: 'GBP',
        ownership: 'joint',
        balanceAmount: 12500.75,
        accountType: 'investments',
        isGoalSavingsSource: false,
      },
      apply: true,
    });
    expect(parseArgs([
      'accounts', 'update', '--account-ref', accountRef,
      '--ownership', 'individual',
    ])).toEqual({
      command: 'accounts-update',
      accountRef,
      update: { ownership: 'personal' },
      apply: false,
    });
    expect(parseArgs([
      'accounts', 'remove', '--account-ref', accountRef,
    ])).toEqual({
      command: 'accounts-remove',
      accountRef,
      apply: false,
    });
    expect(() => parseArgs([
      'accounts', 'update', '--account-ref', 'account-1',
      '--goal-savings-source', 'true',
    ])).toThrow(/valid accountRef/);
    expect(() => parseArgs([
      'accounts', 'update', '--account-ref', accountRef,
      '--goal-savings-source', 'yes',
    ])).toThrow(/true or false/);
    expect(() => parseArgs(['accounts', 'update', '--account-ref', accountRef]))
      .toThrow(/at least one field/);
    expect(() => parseArgs([
      'accounts', 'update', '--account-ref', accountRef, '--currency', 'GB',
    ])).toThrow(/three-letter currency/);
    expect(() => parseArgs([
      'accounts', 'update', '--account-ref', accountRef, '--ownership', 'personal',
    ])).toThrow(/individual or joint/);
    expect(() => parseArgs([
      'accounts', 'update', '--account-ref', accountRef, '--balance-amount', '-1',
    ])).toThrow(/nonnegative amount/);
  });

  it('parses cache-only investment portfolio filters', () => {
    const accountRef = `sloth_account_v1_${'B'.repeat(43)}`;
    expect(parseArgs(['investments'])).toEqual({ command: 'investments' });
    expect(parseArgs(['investments', '--account-ref', accountRef])).toEqual({
      command: 'investments',
      accountRef,
    });
    expect(() => parseArgs(['investments', '--refresh']))
      .toThrow(/Unknown investments option/);
  });

  it('parses goal creation options with preview as the default', () => {
    expect(parseArgs([
      'goals',
      'create',
      '--name',
      'Emergency fund',
      '--target-amount=12000.50',
      '--target-month',
      '2027-06',
      '--type',
      'keep',
    ])).toEqual({
      command: 'goals-create',
      name: 'Emergency fund',
      targetAmount: 12_000.5,
      targetMonthKey: '2027-06',
      goalType: 'keep',
      apply: false,
    });

    expect(parseArgs([
      'goals',
      'create',
      '--name=Emergency fund',
      '--target-amount=12000',
      '--type=spend',
      '--apply',
    ])).toEqual({
      command: 'goals-create',
      name: 'Emergency fund',
      targetAmount: 12_000,
      goalType: 'spend',
      apply: true,
    });
  });

  it('parses goal updates with explicit set and clear operations', () => {
    expect(parseArgs([
      'goals',
      'update',
      '--goal-id',
      'goal-1',
      '--name=Six-month emergency fund',
      '--target-amount=15000.25',
      '--target-month',
      '2027-12',
      '--type=spend',
      '--apply',
    ])).toEqual({
      command: 'goals-update',
      goalId: 'goal-1',
      name: 'Six-month emergency fund',
      targetAmount: 15_000.25,
      targetMonthKey: '2027-12',
      goalType: 'spend',
      apply: true,
    });

    expect(parseArgs([
      'goals',
      'update',
      '--goal-id=goal-1',
      '--target-amount',
      '15000.25',
      '--clear-target-month',
    ])).toEqual({
      command: 'goals-update',
      goalId: 'goal-1',
      targetAmount: 15_000.25,
      targetMonthKey: null,
      apply: false,
    });

    expect(parseArgs([
      'goals',
      'update',
      '--goal-id=goal-3',
      '--priority=2',
    ])).toEqual({
      command: 'goals-update',
      goalId: 'goal-3',
      priority: 2,
      apply: false,
    });
  });

  it('parses Spend lifecycle actions with preview as the default', () => {
    expect(parseArgs([
      'goals',
      'mark-spent',
      '--goal-id=goal-1',
    ])).toEqual({
      command: 'goals-mark-spent',
      goalId: 'goal-1',
      apply: false,
    });

    expect(parseArgs([
      'goals',
      'restore',
      '--goal-id',
      'goal-1',
      '--apply',
    ])).toEqual({
      command: 'goals-restore',
      goalId: 'goal-1',
      apply: true,
    });
  });

  it('parses goal deletion with preview as the default', () => {
    expect(parseArgs([
      'goals',
      'delete',
      '--goal-id=goal-1',
    ])).toEqual({
      command: 'goals-delete',
      goalId: 'goal-1',
      apply: false,
    });

    expect(parseArgs([
      'goals',
      'delete',
      '--goal-id',
      'goal-1',
      '--apply',
    ])).toEqual({
      command: 'goals-delete',
      goalId: 'goal-1',
      apply: true,
    });
  });

  it('rejects incomplete or ambiguous goal writes', () => {
    expect(() => parseArgs([
      'goals',
      'create',
      '--target-amount',
      '12000',
    ])).toThrow(/requires --name/);
    expect(() => parseArgs([
      'goals',
      'create',
      '--name',
      'Emergency fund',
      '--type',
      'keep',
    ])).toThrow(/requires --target-amount/);
    expect(() => parseArgs([
      'goals',
      'create',
      '--name',
      'Emergency fund',
      '--target-amount',
      '12000',
    ])).toThrow(/requires --type/);
    expect(() => parseArgs([
      'goals',
      'create',
      '--name',
      'Emergency fund',
      '--target-amount',
      '12000',
      '--type',
      'save',
    ])).toThrow(/keep or spend/);
    expect(() => parseArgs([
      'goals',
      'create',
      '--name',
      'Emergency fund',
      '--target-amount',
      '10.001',
      '--type',
      'keep',
    ])).toThrow(/two decimal places/);
    expect(() => parseArgs([
      'goals',
      'create',
      '--name',
      'Emergency fund',
      '--target-amount',
      '12000',
      '--target-month',
      '2027-13',
      '--type',
      'keep',
    ])).toThrow(/valid YYYY-MM month/);
    expect(() => parseArgs([
      'goals',
      'update',
      '--goal-id',
      'goal-1',
    ])).toThrow(/at least one field/);
    expect(() => parseArgs([
      'goals',
      'update',
      '--goal-id',
      'goal-1',
      '--target-amount',
      '12000',
      '--clear-target-amount',
    ])).toThrow(/Unknown goals update option/);
    expect(() => parseArgs([
      'goals',
      'update',
      '--goal-id',
      'goal-1',
      '--achieved=yes',
    ])).toThrow(/Unknown goals update option/);
    expect(() => parseArgs([
      'goals',
      'update',
      '--goal-id',
      'goal-1',
      '--priority=0',
    ])).toThrow(/positive whole-number position/);
    expect(() => parseArgs([
      'goals',
      'update',
      '--goal-id',
      'goal-1',
      '--priority=1.5',
    ])).toThrow(/positive whole-number position/);
    expect(() => parseArgs([
      'goals',
      'update',
      '--goal-id',
      'goal-1',
      '--name',
      'Emergency pot',
      '--priority=2',
    ])).toThrow(/priority.*on its own/i);
    expect(() => parseArgs(['goals', 'get', '--goal-id', 'goal-1']))
      .toThrow(/Unknown goals command/);
    expect(() => parseArgs(['goals', 'delete']))
      .toThrow(/requires --goal-id/);
    expect(() => parseArgs(['goals', 'mark-spent']))
      .toThrow(/requires --goal-id/);
    expect(() => parseArgs(['goals', 'restore', '--goal-id', 'goal-1', '--type', 'keep']))
      .toThrow(/Unknown goals restore option/);
    expect(() => parseArgs([
      'goals',
      'delete',
      '--goal-id',
      'nested/goal/id',
    ])).toThrow(/valid goal document ID/);
  });

  it('parses transaction filters and validates their values', () => {
    const accountRef = `sloth_account_v1_${'A'.repeat(43)}`;
    expect(parseArgs([
      'transactions',
      '--uncategorized=false',
      '--shared',
      '--limit',
      '200',
      '--start-date',
      '2026-05-01',
      '--end-date=2026-05-31',
      '--q',
      'tesco',
      '--account-ref',
      accountRef,
      '--category-id',
      'groceries',
      '--line-item-id',
      'weekly',
      '--assignment-scope',
      'joint',
      '--cursor',
      'cursor-1',
    ])).toEqual({
      command: 'transactions',
      filters: {
        uncategorized: false,
        shared: true,
        limit: 200,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        q: 'tesco',
        accountRef,
        categoryId: 'groceries',
        lineItemId: 'weekly',
        assignmentScope: 'joint',
        cursor: 'cursor-1',
      },
    });

    expect(() => parseArgs(['transactions', '--limit', '201'])).toThrow(/between 1 and 200/);
    expect(parseArgs(['transactions', '--shared=false'])).toEqual({
      command: 'transactions',
      filters: { shared: false },
    });
    expect(() => parseArgs(['transactions', '--shared=yes'])).toThrow(/true or false/);
    expect(() => parseArgs(['transactions', '--start-date', '2026-02-30'])).toThrow(/valid YYYY-MM-DD/);
    expect(() => parseArgs([
      'transactions',
      '--start-date',
      '2026-06-01',
      '--end-date',
      '2026-05-01',
    ])).toThrow(/end-date must not be before --start-date/);
    expect(() => parseArgs(['transactions', '--q', ''])).toThrow(/requires a value/);
    expect(() => parseArgs(['transactions', '--account-ref', 'account-1']))
      .toThrow(/valid accountRef/);
    expect(() => parseArgs(['transactions', '--account-id', 'account-1']))
      .toThrow(/Unknown transactions option: --account-id/);
  });

  it('parses assignment and partner commands', () => {
    expect(parseArgs(['assign', '--input', 'assignments.json', '--apply'])).toEqual({
      command: 'assign',
      input: 'assignments.json',
      apply: true,
    });
    expect(parseArgs(['ask-partner', '--transaction-ref=sloth_txn_123'])).toEqual({
      command: 'ask-partner',
      transactionRef: 'sloth_txn_123',
    });
  });

  it('parses notification rule management without recurring prediction options', () => {
    expect(parseArgs(['rules'])).toEqual({ command: 'rules-list' });
    expect(parseArgs(['rules', 'get', '--transaction-ref', 'sloth_txn_123']))
      .toEqual({ command: 'rules-get', transactionRef: 'sloth_txn_123' });
    expect(parseArgs([
      'rules', 'set', '--transaction-ref', 'sloth_txn_123',
      '--input', 'rule.json', '--apply',
    ])).toEqual({
      command: 'rules-set',
      transactionRef: 'sloth_txn_123',
      input: 'rule.json',
      apply: true,
    });
    expect(parseArgs(['rules', 'delete', '--transaction-ref=sloth_txn_123']))
      .toEqual({ command: 'rules-delete', transactionRef: 'sloth_txn_123', apply: false });
    expect(parseArgs(['rules', 'scan-contract', '--contract', 'contract.pdf', '--apply']))
      .toEqual({ command: 'rules-scan-contract', contract: 'contract.pdf', apply: true });

    expect(() => parseArgs(['rules', 'set', '--transaction-ref', 'sloth_txn_123']))
      .toThrow(/requires --input/);
    expect(() => parseArgs(['rules', 'predict', '--cadence', 'monthly']))
      .toThrow(/Unknown rules command/);
  });

  it('parses receipt extraction, read, reviewed attach, and remove commands', () => {
    expect(parseArgs(['receipts', 'extract', '--image', 'receipt.jpg'])).toEqual({
      command: 'receipts-extract',
      image: 'receipt.jpg',
    });
    expect(parseArgs(['receipts', 'get', '--transaction-ref', 'sloth_txn_1'])).toEqual({
      command: 'receipts-get',
      transactionRef: 'sloth_txn_1',
    });
    expect(parseArgs([
      'receipts', 'attach', '--transaction-ref', 'sloth_txn_1', '--input', 'receipt.json',
      '--expected-revision', '2', '--apply',
    ])).toEqual({
      command: 'receipts-attach',
      transactionRef: 'sloth_txn_1',
      input: 'receipt.json',
      expectedRevision: 2,
      apply: true,
    });
    expect(parseArgs([
      'receipts', 'remove', '--transaction-ref', 'sloth_txn_1', '--revision', '2', '--apply',
    ])).toEqual({
      command: 'receipts-remove',
      transactionRef: 'sloth_txn_1',
      revision: 2,
      apply: true,
    });
  });

  it('parses scoped budget reads and updates', () => {
    expect(parseArgs(['budget', '--scope', 'personal', '--period', '2026-08'])).toEqual({
      command: 'budget',
      scope: 'personal',
      periodKey: '2026-08',
    });
    expect(parseArgs([
      'budget', 'status', '--scope=personal',
    ])).toEqual({
      command: 'budget-status',
      scope: 'personal',
    });
    expect(parseArgs([
      'budget', 'update', '--scope=joint', '--period=2026-09',
      '--input', 'budget.json', '--apply',
    ])).toEqual({
      command: 'budget-update',
      scope: 'joint',
      periodKey: '2026-09',
      input: 'budget.json',
      apply: true,
    });
    expect(parseArgs([
      'budget', 'move', '--scope=personal', '--period=2026-08',
      '--from-category-id', 'activities', '--to-category-id=groceries',
      '--amount', '52.95', '--apply',
    ])).toEqual({
      command: 'budget-move',
      scope: 'personal',
      periodKey: '2026-08',
      fromCategoryId: 'activities',
      toCategoryId: 'groceries',
      amountPence: 5_295,
      apply: true,
    });
    expect(parseArgs([
      'budget', 'move', '--scope', 'joint', '--from-category-id', 'to-assign',
      '--to-category-id', 'groceries', '--amount', '0.01',
    ])).toMatchObject({
      command: 'budget-move',
      amountPence: 1,
      apply: false,
    });
    expect(parseArgs([
      'budget', 'move', '--scope', 'personal', '--from-category-id', 'activities',
      '--to-category-id', 'groceries', '--amount', '90071992547409.90',
    ])).toMatchObject({
      command: 'budget-move',
      amountPence: 9_007_199_254_740_990,
    });
  });

  it('requires valid explicit budget options', () => {
    expect(() => parseArgs(['budget'])).toThrow(/requires --scope/);
    expect(() => parseArgs(['budget', '--scope', 'all'])).toThrow(/personal or joint/);
    expect(() => parseArgs(['budget', '--scope', 'personal', '--period', '2026-13']))
      .toThrow(/valid YYYY-MM/);
    expect(() => parseArgs(['budget', 'update', '--scope', 'personal']))
      .toThrow(/requires --input/);
    expect(() => parseArgs(['budget', '--scope', 'personal', '--apply']))
      .toThrow(/Unknown budget option/);
    expect(() => parseArgs(['budget', 'status', '--scope', 'personal', '--period', '2026-08']))
      .toThrow(/Unknown budget status option/);
    expect(() => parseArgs([
      'budget', 'move', '--scope', 'personal', '--from-category-id', 'groceries',
      '--to-category-id', 'groceries', '--amount', '1',
    ])).toThrow(/must differ/);
    expect(() => parseArgs([
      'budget', 'move', '--scope', 'personal', '--from-category-id', 'activities',
      '--to-category-id', 'groceries', '--amount', '0',
    ])).toThrow(/positive amount/);
    expect(() => parseArgs([
      'budget', 'move', '--scope', 'personal', '--from-category-id', 'activities',
      '--to-category-id', 'groceries', '--amount', '90071992547409.92',
    ])).toThrow(/positive amount/);
  });

  it('parses auth commands and their login input modes', () => {
    expect(parseArgs(['auth', 'login'])).toEqual({
      command: 'auth-login',
      input: 'prompt',
    });
    expect(parseArgs(['auth', 'login', '--token-stdin'])).toEqual({
      command: 'auth-login',
      input: 'stdin',
    });
    expect(parseArgs(['auth', 'login', '--from-env', '--base-url', 'https://api.example.com'])).toEqual({
      command: 'auth-login',
      input: 'environment',
      baseUrl: 'https://api.example.com',
    });
    expect(parseArgs(['auth', 'status'])).toEqual({ command: 'auth-status' });
    expect(parseArgs(['auth', 'logout'])).toEqual({ command: 'auth-logout' });
  });

  it('rejects ambiguous or unsupported auth input', () => {
    expect(() => parseArgs([
      'auth',
      'login',
      '--token-stdin',
      '--from-env',
    ])).toThrow(/mutually exclusive/);
    expect(() => parseArgs([
      'auth',
      'login',
      '--token-stdin',
      '--token-stdin',
    ])).toThrow(/may only be provided once/);
    expect(() => parseArgs(['auth', 'status', '--from-env'])).toThrow(/Unknown auth status option/);
    expect(() => parseArgs(['auth', 'unknown'])).toThrow(/Unknown auth command/);
    expect(() => parseArgs(['auth'])).toThrow(/requires login, status, or logout/);
  });

  it('rejects unknown commands and options', () => {
    expect(() => parseArgs(['unknown'])).toThrow(/Unknown command/);
    expect(() => parseArgs(['categories', '--wat'])).toThrow(/Unknown categories option/);
    expect(() => parseArgs(['assign', '--input', 'a.json', '--input', 'b.json'])).toThrow(/may only be provided once/);
  });
});

describe('API base URL', () => {
  it('defaults to the production origin and strips one trailing slash', () => {
    expect(resolveBaseUrl({}, undefined)).toBe('https://budget.slothmoney.app');
    expect(resolveBaseUrl({ SLOTH_AGENT_API_BASE_URL: 'https://example.com/' }, undefined)).toBe('https://example.com');
  });

  it('allows HTTP only for local development', () => {
    expect(resolveBaseUrl({}, 'http://localhost:4000')).toBe('http://localhost:4000');
    expect(resolveBaseUrl({}, 'http://127.0.0.1:4000')).toBe('http://127.0.0.1:4000');
    expect(() => resolveBaseUrl({}, 'http://api.example.com')).toThrow(/must use HTTPS/);
  });

  it('rejects credentials, paths, query strings, and fragments', () => {
    expect(() => resolveBaseUrl({}, 'https://token@example.com')).toThrow(/must not include credentials/);
    expect(() => resolveBaseUrl({}, 'https://example.com/api')).toThrow(/origin only/);
    expect(() => resolveBaseUrl({}, 'https://example.com?debug=true')).toThrow(/origin only/);
  });
});
