import { UsageError } from './errors.js';
import {
  CATEGORY_TYPES,
  ICON_KEYS,
  type CategoryType,
  type IconKey,
} from './category-metadata.js';
import {
  isGoalType,
  type GoalType,
} from './goal-metadata.js';

export interface CliEnvironment {
  SLOTH_AGENT_API_BASE_URL?: string;
  SLOTH_AGENT_TOKEN?: string;
}

interface GlobalOptions {
  args: string[];
  baseUrl?: string;
}

export interface TransactionFilters {
  uncategorized?: boolean;
  limit?: number;
  startDate?: string;
  endDate?: string;
  q?: string;
  accountId?: string;
  categoryId?: string;
  lineItemId?: string;
  assignmentScope?: 'personal' | 'joint';
  cursor?: string;
}

export type HelpTopic =
  | 'auth'
  | 'auth-login'
  | 'auth-status'
  | 'auth-logout'
  | 'accounts'
  | 'accounts-update'
  | 'accounts-remove'
  | 'investments'
  | 'budget'
  | 'budget-status'
  | 'budget-move'
  | 'budget-update'
  | 'categories'
  | 'categories-create'
  | 'categories-rename'
  | 'line-items-create'
  | 'line-items-rename'
  | 'transactions'
  | 'assign'
  | 'goals'
  | 'goals-list'
  | 'goals-create'
  | 'goals-update'
  | 'goals-mark-spent'
  | 'goals-restore'
  | 'goals-delete'
  | 'ask-partner';

export type ParsedCommand =
  | { command: 'help'; topic?: HelpTopic }
  | { command: 'version' }
  | {
    command: 'auth-login';
    baseUrl?: string;
    input: 'prompt' | 'stdin' | 'environment';
  }
  | { command: 'auth-status'; baseUrl?: string }
  | { command: 'auth-logout'; baseUrl?: string }
  | { command: 'accounts'; baseUrl?: string }
  | {
    command: 'accounts-update';
    baseUrl?: string;
    accountRef: string;
    update: {
      institutionName?: string;
      accountName?: string;
      currency?: string;
      ownership?: 'personal' | 'joint';
      balanceAmount?: number;
      accountType?: 'savings' | 'investments';
      isGoalSavingsSource?: boolean;
    };
    apply: boolean;
  }
  | {
    command: 'accounts-remove';
    baseUrl?: string;
    accountRef: string;
    apply: boolean;
  }
  | { command: 'investments'; baseUrl?: string; accountRef?: string }
  | {
    command: 'budget';
    baseUrl?: string;
    scope: 'personal' | 'joint';
    periodKey?: string;
  }
  | {
    command: 'budget-status';
    baseUrl?: string;
    scope: 'personal' | 'joint';
  }
  | {
    command: 'budget-move';
    baseUrl?: string;
    scope: 'personal' | 'joint';
    periodKey?: string;
    fromCategoryId: string;
    toCategoryId: string;
    amountPence: number;
    apply: boolean;
  }
  | {
    command: 'budget-update';
    baseUrl?: string;
    scope: 'personal' | 'joint';
    periodKey?: string;
    input: string;
    apply: boolean;
  }
  | { command: 'categories'; baseUrl?: string }
  | {
    command: 'categories-create';
    baseUrl?: string;
    name: string;
    iconKey: IconKey;
    categoryType: CategoryType;
    apply: boolean;
  }
  | {
    command: 'categories-rename';
    baseUrl?: string;
    categoryId: string;
    name: string;
    apply: boolean;
  }
  | {
    command: 'line-items-create';
    baseUrl?: string;
    scope: 'personal' | 'joint';
    categoryId: string;
    name: string;
    apply: boolean;
  }
  | {
    command: 'line-items-rename';
    baseUrl?: string;
    scope: 'personal' | 'joint';
    categoryId: string;
    lineItemId: string;
    name: string;
    apply: boolean;
  }
  | {
    command: 'transactions';
    baseUrl?: string;
    filters: TransactionFilters;
  }
  | { command: 'assign'; baseUrl?: string; input: string; apply: boolean }
  | { command: 'goals-list'; baseUrl?: string }
  | {
    command: 'goals-create';
    baseUrl?: string;
    name: string;
    targetAmount: number;
    targetMonthKey?: string;
    goalType: GoalType;
    apply: boolean;
  }
  | {
    command: 'goals-update';
    baseUrl?: string;
    goalId: string;
    name?: string;
    targetAmount?: number;
    targetMonthKey?: string | null;
    goalType?: GoalType;
    priority?: number;
    apply: boolean;
  }
  | {
    command: 'goals-mark-spent';
    baseUrl?: string;
    goalId: string;
    apply: boolean;
  }
  | {
    command: 'goals-restore';
    baseUrl?: string;
    goalId: string;
    apply: boolean;
  }
  | {
    command: 'goals-delete';
    baseUrl?: string;
    goalId: string;
    apply: boolean;
  }
  | { command: 'ask-partner'; baseUrl?: string; transactionRef: string };

const PRODUCTION_BASE_URL = 'https://budget.slothmoney.app';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
function readOptionValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (value === undefined || value.length === 0 || value.startsWith('--')) {
    throw new UsageError(`${name} requires a value`);
  }
  return value;
}

function setOnce<T>(
  current: T | undefined,
  value: T,
  name: string,
): T {
  if (current !== undefined) {
    throw new UsageError(`${name} may only be provided once`);
  }
  return value;
}

function parseGlobalOptions(argv: string[]): GlobalOptions {
  const args = [...argv];
  let baseUrl: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--base-url') {
      baseUrl = setOnce(baseUrl, readOptionValue(args, index, '--base-url'), '--base-url');
      args.splice(index, 2);
      index -= 1;
      continue;
    }
    if (argument?.startsWith('--base-url=')) {
      const value = argument.slice('--base-url='.length);
      if (!value) throw new UsageError('--base-url requires a value');
      baseUrl = setOnce(baseUrl, value, '--base-url');
      args.splice(index, 1);
      index -= 1;
    }
  }

  return baseUrl === undefined ? { args } : { args, baseUrl };
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function requireNonEmpty(value: string, name: string): string {
  if (!value.trim()) throw new UsageError(`${name} requires a value`);
  return value;
}

function validatePositiveDecimalAmount(value: string, name: string): void {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new UsageError(`${name} must be a positive amount with at most two decimal places`);
  }
  const digits = value.replace('.', '');
  if (!/[1-9]/.test(digits)) {
    throw new UsageError(`${name} must be a positive amount with at most two decimal places`);
  }
}

function parsePositiveDecimalAmount(value: string, name: string): number {
  validatePositiveDecimalAmount(value, name);
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new UsageError(`${name} must be a positive amount with at most two decimal places`);
  }
  return amount;
}

function parsePositiveAmountPence(value: string, name: string): number {
  validatePositiveDecimalAmount(value, name);
  const [wholePounds, fractionalPounds = ''] = value.split('.');
  const amountPence = BigInt(wholePounds!) * 100n
    + BigInt(fractionalPounds.padEnd(2, '0'));
  if (amountPence > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new UsageError(`${name} must be a positive amount with at most two decimal places`);
  }
  return Number(amountPence);
}

function parseGoalMonthKey(value: string, name: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new UsageError(`${name} must be a valid YYYY-MM month`);
  }
  return value;
}

function parseGoalPriority(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new UsageError('--priority must be a positive whole-number position');
  }
  const priority = Number(value);
  if (!Number.isSafeInteger(priority)) {
    throw new UsageError('--priority must be a positive whole-number position');
  }
  return priority;
}

function parseGoalType(value: string): GoalType {
  if (!isGoalType(value)) {
    throw new UsageError('--type must be keep or spend');
  }
  return value;
}

function parseGoalName(value: string): string {
  const name = value.trim();
  if (name.length > 200) {
    throw new UsageError('--name must be at most 200 characters');
  }
  return name;
}

function parseGoalId(value: string): string {
  const goalId = value.trim();
  if (
    goalId.length > 500
    || goalId.includes('/')
    || Array.from(goalId).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint < 32 || codePoint === 127);
    })
  ) {
    throw new UsageError('--goal-id must be a valid goal document ID');
  }
  return goalId;
}

function parseResourceId(
  value: string,
  option: '--category-id' | '--line-item-id' | '--from-category-id' | '--to-category-id',
): string {
  const id = value.trim();
  if (
    !id
    || id.length > 500
    || id.includes('/')
    || Array.from(id).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint < 32 || codePoint === 127);
    })
  ) {
    const resource = option === '--line-item-id' ? 'line-item' : 'category';
    throw new UsageError(`${option} must be a valid ${resource} document ID`);
  }
  return id;
}

function parseResourceName(value: string): string {
  const name = value.trim();
  if (!name) throw new UsageError('--name requires a value');
  if (name.length > 200) throw new UsageError('--name must be at most 200 characters');
  return name;
}

function parseTransactions(args: string[]): TransactionFilters {
  const filters: TransactionFilters = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === '--uncategorized') {
      filters.uncategorized = setOnce(filters.uncategorized, true, '--uncategorized');
      continue;
    }
    if (argument.startsWith('--uncategorized=')) {
      const value = argument.slice('--uncategorized='.length);
      if (value !== 'true' && value !== 'false') {
        throw new UsageError('--uncategorized must be true or false');
      }
      filters.uncategorized = setOnce(filters.uncategorized, value === 'true', '--uncategorized');
      continue;
    }

    const [name, inlineValue] = argument.includes('=')
      ? argument.split(/=(.*)/s, 2)
      : [argument, undefined];
    const supported = new Set([
      '--limit',
      '--start-date',
      '--end-date',
      '--q',
      '--account-id',
      '--category-id',
      '--line-item-id',
      '--assignment-scope',
      '--cursor',
    ]);
    if (!name || !supported.has(name)) {
      throw new UsageError(`Unknown transactions option: ${argument}`);
    }
    const value = requireNonEmpty(
      inlineValue ?? readOptionValue(args, index, name),
      name,
    );
    if (inlineValue === undefined) index += 1;

    if (name === '--limit') {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
        throw new UsageError('--limit must be an integer between 1 and 200');
      }
      filters.limit = setOnce(filters.limit, limit, name);
    } else if (name === '--start-date' || name === '--end-date') {
      if (!isValidDate(value)) {
        throw new UsageError(`${name} must be a valid YYYY-MM-DD date`);
      }
      if (name === '--start-date') {
        filters.startDate = setOnce(filters.startDate, value, name);
      } else {
        filters.endDate = setOnce(filters.endDate, value, name);
      }
    } else if (name === '--q') {
      filters.q = setOnce(filters.q, value, name);
    } else if (name === '--account-id') {
      filters.accountId = setOnce(filters.accountId, value, name);
    } else if (name === '--category-id') {
      filters.categoryId = setOnce(filters.categoryId, value, name);
    } else if (name === '--line-item-id') {
      filters.lineItemId = setOnce(filters.lineItemId, value, name);
    } else if (name === '--assignment-scope') {
      if (value !== 'personal' && value !== 'joint') {
        throw new UsageError('--assignment-scope must be personal or joint');
      }
      filters.assignmentScope = setOnce(filters.assignmentScope, value, name);
    } else if (name === '--cursor') {
      filters.cursor = setOnce(filters.cursor, value, name);
    }
  }

  if (
    filters.startDate !== undefined
    && filters.endDate !== undefined
    && filters.endDate < filters.startDate
  ) {
    throw new UsageError('--end-date must not be before --start-date');
  }

  return filters;
}

function parseNamedOptions(
  args: string[],
  commandLabel: string,
  allowed: ReadonlySet<string>,
): { values: Map<string, string>; apply: boolean } {
  const values = new Map<string, string>();
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === '--apply') {
      if (apply) throw new UsageError('--apply may only be provided once');
      apply = true;
      continue;
    }
    const [option, inlineValue] = argument.includes('=')
      ? argument.split(/=(.*)/s, 2)
      : [argument, undefined];
    if (!option || !allowed.has(option)) {
      throw new UsageError(`Unknown ${commandLabel} option: ${argument}`);
    }
    if (values.has(option)) throw new UsageError(`${option} may only be provided once`);
    const value = requireNonEmpty(inlineValue ?? readOptionValue(args, index, option), option);
    if (inlineValue === undefined) index += 1;
    values.set(option, value);
  }
  return { values, apply };
}

function requiredOption(values: Map<string, string>, option: string, commandLabel: string): string {
  const value = values.get(option);
  if (!value) throw new UsageError(`${commandLabel} requires ${option} <value>`);
  return value;
}

function parseAccountRef(value: string): string {
  if (!/^sloth_account_v1_[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new UsageError('--account-ref must be a valid accountRef from sloth-agent accounts');
  }
  return value;
}

function parseAccountName(value: string, option: string): string {
  const name = value.trim();
  if (name.length > 300) throw new UsageError(`${option} must be at most 300 characters`);
  return name;
}

function parseAccountBalance(value: string): number {
  const amount = Number(value);
  if (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(amount) || amount < 0) {
    throw new UsageError('--balance-amount must be a nonnegative amount');
  }
  return amount;
}

function parseAccounts(args: string[], baseUrl?: string): ParsedCommand {
  const subcommand = args.shift();
  if (subcommand === undefined || subcommand === 'list') {
    if (args.length > 0) throw new UsageError(`Unknown accounts option: ${args[0]}`);
    return withBaseUrl({ command: 'accounts' }, baseUrl);
  }
  if (subcommand === 'update') {
    const { values, apply } = parseNamedOptions(
      args,
      'accounts update',
      new Set([
        '--account-ref',
        '--institution-name',
        '--account-name',
        '--currency',
        '--ownership',
        '--balance-amount',
        '--account-type',
        '--goal-savings-source',
      ]),
    );
    const institutionName = values.get('--institution-name');
    const accountName = values.get('--account-name');
    const currencyValue = values.get('--currency');
    const ownershipValue = values.get('--ownership');
    const balanceValue = values.get('--balance-amount');
    const accountTypeValue = values.get('--account-type');
    const sourceValue = values.get('--goal-savings-source');
    if (currencyValue !== undefined && !/^[A-Za-z]{3}$/.test(currencyValue)) {
      throw new UsageError('--currency must be a three-letter currency code');
    }
    if (
      ownershipValue !== undefined
      && ownershipValue !== 'individual'
      && ownershipValue !== 'joint'
    ) {
      throw new UsageError('--ownership must be individual or joint');
    }
    if (
      accountTypeValue !== undefined
      && accountTypeValue !== 'savings'
      && accountTypeValue !== 'investments'
    ) {
      throw new UsageError('--account-type must be savings or investments');
    }
    if (sourceValue !== undefined && sourceValue !== 'true' && sourceValue !== 'false') {
      throw new UsageError('--goal-savings-source must be true or false');
    }
    const update = {
      ...(institutionName === undefined
        ? {}
        : { institutionName: parseAccountName(institutionName, '--institution-name') }),
      ...(accountName === undefined
        ? {}
        : { accountName: parseAccountName(accountName, '--account-name') }),
      ...(currencyValue === undefined ? {} : { currency: currencyValue.toUpperCase() }),
      ...(ownershipValue === undefined
        ? {}
        : { ownership: ownershipValue === 'individual' ? 'personal' as const : 'joint' as const }),
      ...(balanceValue === undefined ? {} : { balanceAmount: parseAccountBalance(balanceValue) }),
      ...(accountTypeValue === undefined
        ? {}
        : { accountType: accountTypeValue as 'savings' | 'investments' }),
      ...(sourceValue === undefined ? {} : { isGoalSavingsSource: sourceValue === 'true' }),
    };
    if (Object.keys(update).length === 0) {
      throw new UsageError('accounts update requires at least one field to update');
    }
    return withBaseUrl({
      command: 'accounts-update',
      accountRef: parseAccountRef(requiredOption(values, '--account-ref', 'accounts update')),
      update,
      apply,
    }, baseUrl);
  }
  if (subcommand === 'remove') {
    const { values, apply } = parseNamedOptions(
      args,
      'accounts remove',
      new Set(['--account-ref']),
    );
    return withBaseUrl({
      command: 'accounts-remove',
      accountRef: parseAccountRef(requiredOption(values, '--account-ref', 'accounts remove')),
      apply,
    }, baseUrl);
  }
  if (subcommand.startsWith('-')) {
    throw new UsageError(`Unknown accounts option: ${subcommand}`);
  }
  throw new UsageError(`Unknown accounts command: ${subcommand}`);
}

function parseInvestments(args: string[], baseUrl?: string): ParsedCommand {
  let accountRef: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === '--account-ref') {
      accountRef = setOnce(
        accountRef,
        parseAccountRef(readOptionValue(args, index, '--account-ref')),
        '--account-ref',
      );
      index += 1;
    } else if (argument.startsWith('--account-ref=')) {
      accountRef = setOnce(
        accountRef,
        parseAccountRef(requireNonEmpty(argument.slice('--account-ref='.length), '--account-ref')),
        '--account-ref',
      );
    } else {
      throw new UsageError(`Unknown investments option: ${argument}`);
    }
  }
  return withBaseUrl({ command: 'investments', ...(accountRef ? { accountRef } : {}) }, baseUrl);
}

function parseBudget(args: string[], baseUrl?: string): ParsedCommand {
  const subcommand = args[0] === 'status' || args[0] === 'update' || args[0] === 'move'
    ? args.shift()
    : undefined;
  const status = subcommand === 'status';
  const update = subcommand === 'update';
  const move = subcommand === 'move';
  const commandLabel = status
    ? 'budget status'
    : update
      ? 'budget update'
      : move
        ? 'budget move'
        : 'budget';
  const { values, apply } = parseNamedOptions(
    args,
    commandLabel,
    new Set(
      status
        ? ['--scope']
        : update
          ? ['--scope', '--period', '--input']
        : move
          ? ['--scope', '--period', '--from-category-id', '--to-category-id', '--amount']
          : ['--scope', '--period'],
    ),
  );
  if (!update && !move && apply) throw new UsageError(`Unknown ${commandLabel} option: --apply`);

  const scope = requiredOption(values, '--scope', commandLabel);
  if (scope !== 'personal' && scope !== 'joint') {
    throw new UsageError('--scope must be personal or joint');
  }
  if (status) {
    return withBaseUrl({
      command: 'budget-status',
      scope: scope as 'personal' | 'joint',
    }, baseUrl);
  }
  const period = values.get('--period');
  const common = {
    scope: scope as 'personal' | 'joint',
    ...(period === undefined ? {} : { periodKey: parseGoalMonthKey(period, '--period') }),
  };
  if (!update && !move) return withBaseUrl({ command: 'budget', ...common }, baseUrl);

  if (move) {
    const fromCategoryId = parseResourceId(
      requiredOption(values, '--from-category-id', commandLabel),
      '--from-category-id',
    );
    const toCategoryId = parseResourceId(
      requiredOption(values, '--to-category-id', commandLabel),
      '--to-category-id',
    );
    if (fromCategoryId === toCategoryId) {
      throw new UsageError('--from-category-id and --to-category-id must differ');
    }
    return withBaseUrl({
      command: 'budget-move',
      ...common,
      fromCategoryId,
      toCategoryId,
      amountPence: parsePositiveAmountPence(
        requiredOption(values, '--amount', commandLabel),
        '--amount',
      ),
      apply,
    }, baseUrl);
  }

  return withBaseUrl({
    command: 'budget-update',
    ...common,
    input: requiredOption(values, '--input', 'budget update'),
    apply,
  }, baseUrl);
}

function parseCategories(args: string[], baseUrl?: string): ParsedCommand {
  const subcommand = args.shift();
  if (subcommand === undefined || subcommand === 'list') {
    if (args.length > 0) throw new UsageError(`Unknown categories list option: ${args[0]}`);
    return withBaseUrl({ command: 'categories' }, baseUrl);
  }
  if (subcommand === 'create') {
    const { values, apply } = parseNamedOptions(
      args,
      'categories create',
      new Set(['--name', '--icon-key', '--type']),
    );
    const iconKey = requiredOption(values, '--icon-key', 'categories create');
    const categoryType = requiredOption(values, '--type', 'categories create');
    if (!(ICON_KEYS as readonly string[]).includes(iconKey)) {
      throw new UsageError(`--icon-key must be one of: ${ICON_KEYS.join(', ')}`);
    }
    if (!(CATEGORY_TYPES as readonly string[]).includes(categoryType)) {
      throw new UsageError(`--type must be one of: ${CATEGORY_TYPES.join(', ')}`);
    }
    return withBaseUrl({
      command: 'categories-create',
      name: parseResourceName(requiredOption(values, '--name', 'categories create')),
      iconKey: iconKey as IconKey,
      categoryType: categoryType as CategoryType,
      apply,
    }, baseUrl);
  }
  if (subcommand === 'rename') {
    const { values, apply } = parseNamedOptions(
      args,
      'categories rename',
      new Set(['--category-id', '--name']),
    );
    return withBaseUrl({
      command: 'categories-rename',
      categoryId: parseResourceId(
        requiredOption(values, '--category-id', 'categories rename'),
        '--category-id',
      ),
      name: parseResourceName(requiredOption(values, '--name', 'categories rename')),
      apply,
    }, baseUrl);
  }
  if (subcommand.startsWith('-')) {
    throw new UsageError(`Unknown categories option: ${subcommand}`);
  }
  throw new UsageError(`Unknown categories command: ${subcommand}`);
}

function parseLineItems(args: string[], baseUrl?: string): ParsedCommand {
  const subcommand = args.shift();
  if (subcommand !== 'create' && subcommand !== 'rename') {
    throw new UsageError('line-items requires create or rename');
  }
  const allowed = new Set(['--scope', '--category-id', '--name']);
  if (subcommand === 'rename') allowed.add('--line-item-id');
  const { values, apply } = parseNamedOptions(args, `line-items ${subcommand}`, allowed);
  const scope = requiredOption(values, '--scope', `line-items ${subcommand}`);
  if (scope !== 'personal' && scope !== 'joint') {
    throw new UsageError('--scope must be personal or joint');
  }
  const common = {
    scope: scope as 'personal' | 'joint',
    categoryId: parseResourceId(
      requiredOption(values, '--category-id', `line-items ${subcommand}`),
      '--category-id',
    ),
    name: parseResourceName(requiredOption(values, '--name', `line-items ${subcommand}`)),
    apply,
  };
  if (subcommand === 'create') {
    return withBaseUrl({ command: 'line-items-create', ...common }, baseUrl);
  }
  return withBaseUrl({
    command: 'line-items-rename',
    ...common,
    lineItemId: parseResourceId(
      requiredOption(values, '--line-item-id', 'line-items rename'),
      '--line-item-id',
    ),
  }, baseUrl);
}

function withBaseUrl<T extends object>(value: T, baseUrl?: string): T & { baseUrl?: string } {
  return baseUrl === undefined ? value : { ...value, baseUrl };
}

function parseAuth(args: string[], baseUrl?: string): ParsedCommand {
  const authCommand = args.shift();
  if (!authCommand) {
    throw new UsageError('auth requires login, status, or logout');
  }

  if (authCommand === 'login') {
    let input: 'stdin' | 'environment' | undefined;
    for (const argument of args) {
      if (argument === '--token-stdin') {
        if (input === 'stdin') {
          throw new UsageError('--token-stdin may only be provided once');
        }
        if (input === 'environment') {
          throw new UsageError('--token-stdin and --from-env are mutually exclusive');
        }
        input = 'stdin';
      } else if (argument === '--from-env') {
        if (input === 'environment') {
          throw new UsageError('--from-env may only be provided once');
        }
        if (input === 'stdin') {
          throw new UsageError('--token-stdin and --from-env are mutually exclusive');
        }
        input = 'environment';
      } else {
        throw new UsageError(`Unknown auth login option: ${argument}`);
      }
    }
    return withBaseUrl({ command: 'auth-login', input: input ?? 'prompt' }, baseUrl);
  }

  if (authCommand === 'status' || authCommand === 'logout') {
    if (args.length > 0) {
      throw new UsageError(`Unknown auth ${authCommand} option: ${args[0]}`);
    }
    return withBaseUrl({ command: `auth-${authCommand}` }, baseUrl);
  }

  throw new UsageError(`Unknown auth command: ${authCommand}`);
}

function parseGoals(args: string[], baseUrl?: string): ParsedCommand {
  const subcommand = args.shift();
  if (subcommand === undefined || subcommand === 'list') {
    if (args.length > 0) {
      throw new UsageError(`Unknown goals list option: ${args[0]}`);
    }
    return withBaseUrl({ command: 'goals-list' }, baseUrl);
  }

  if (subcommand === 'create') {
    let name: string | undefined;
    let targetAmount: number | undefined;
    let targetMonthKey: string | undefined;
    let goalType: GoalType | undefined;
    let apply = false;

    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index]!;
      if (argument === '--apply') {
        if (apply) throw new UsageError('--apply may only be provided once');
        apply = true;
        continue;
      }

      const [option, inlineValue] = argument.includes('=')
        ? argument.split(/=(.*)/s, 2)
        : [argument, undefined];
      if (
        option !== '--name'
        && option !== '--target-amount'
        && option !== '--target-month'
        && option !== '--type'
      ) {
        throw new UsageError(`Unknown goals create option: ${argument}`);
      }

      const value = requireNonEmpty(
        inlineValue ?? readOptionValue(args, index, option),
        option,
      );
      if (inlineValue === undefined) index += 1;

      if (option === '--name') {
        name = setOnce(name, parseGoalName(value), option);
      } else if (option === '--target-amount') {
        targetAmount = setOnce(
          targetAmount,
          parsePositiveDecimalAmount(value, option),
          option,
        );
      } else if (option === '--target-month') {
        targetMonthKey = setOnce(
          targetMonthKey,
          parseGoalMonthKey(value, option),
          option,
        );
      } else {
        goalType = setOnce(goalType, parseGoalType(value), option);
      }
    }

    if (!name) throw new UsageError('goals create requires --name <name>');
    if (targetAmount === undefined) {
      throw new UsageError('goals create requires --target-amount <amount>');
    }
    if (goalType === undefined) {
      throw new UsageError('goals create requires --type <keep|spend>');
    }
    return withBaseUrl({
      command: 'goals-create',
      name,
      targetAmount,
      ...(targetMonthKey === undefined ? {} : { targetMonthKey }),
      goalType,
      apply,
    }, baseUrl);
  }

  if (subcommand === 'update') {
    let goalId: string | undefined;
    let name: string | undefined;
    let targetAmount: number | undefined;
    let targetMonthKey: string | null | undefined;
    let goalType: GoalType | undefined;
    let priority: number | undefined;
    let apply = false;

    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index]!;
      if (argument === '--apply') {
        if (apply) throw new UsageError('--apply may only be provided once');
        apply = true;
        continue;
      }
      if (argument === '--clear-target-month') {
        if (targetMonthKey !== undefined) {
          throw new UsageError(
            '--target-month and --clear-target-month are mutually exclusive',
          );
        }
        targetMonthKey = null;
        continue;
      }

      const [option, inlineValue] = argument.includes('=')
        ? argument.split(/=(.*)/s, 2)
        : [argument, undefined];
      if (
        option !== '--goal-id'
        && option !== '--name'
        && option !== '--target-amount'
        && option !== '--target-month'
        && option !== '--type'
        && option !== '--priority'
      ) {
        throw new UsageError(`Unknown goals update option: ${argument}`);
      }

      const value = requireNonEmpty(
        inlineValue ?? readOptionValue(args, index, option),
        option,
      );
      if (inlineValue === undefined) index += 1;

      if (option === '--goal-id') {
        goalId = setOnce(goalId, parseGoalId(value), option);
      } else if (option === '--name') {
        name = setOnce(name, parseGoalName(value), option);
      } else if (option === '--target-amount') {
        targetAmount = setOnce(
          targetAmount,
          parsePositiveDecimalAmount(value, option),
          option,
        );
      } else if (option === '--target-month') {
        if (targetMonthKey !== undefined) {
          throw new UsageError(
            '--target-month and --clear-target-month are mutually exclusive',
          );
        }
        targetMonthKey = parseGoalMonthKey(value, option);
      } else if (option === '--priority') {
        priority = setOnce(priority, parseGoalPriority(value), option);
      } else {
        goalType = setOnce(goalType, parseGoalType(value), option);
      }
    }

    if (!goalId) throw new UsageError('goals update requires --goal-id <id>');
    if (
      name === undefined
      && targetAmount === undefined
      && targetMonthKey === undefined
      && goalType === undefined
      && priority === undefined
    ) {
      throw new UsageError('goals update requires at least one field to update');
    }
    if (
      priority !== undefined
      && (
        name !== undefined
        || targetAmount !== undefined
        || targetMonthKey !== undefined
        || goalType !== undefined
      )
    ) {
      throw new UsageError('--priority must be used on its own');
    }

    return withBaseUrl({
      command: 'goals-update',
      goalId,
      ...(name === undefined ? {} : { name }),
      ...(targetAmount === undefined ? {} : { targetAmount }),
      ...(targetMonthKey === undefined ? {} : { targetMonthKey }),
      ...(goalType === undefined ? {} : { goalType }),
      ...(priority === undefined ? {} : { priority }),
      apply,
    }, baseUrl);
  }

  if (
    subcommand === 'mark-spent'
    || subcommand === 'restore'
    || subcommand === 'delete'
  ) {
    let goalId: string | undefined;
    let apply = false;

    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index]!;
      if (argument === '--apply') {
        if (apply) throw new UsageError('--apply may only be provided once');
        apply = true;
        continue;
      }

      const [option, inlineValue] = argument.includes('=')
        ? argument.split(/=(.*)/s, 2)
        : [argument, undefined];
      if (option !== '--goal-id') {
        throw new UsageError(`Unknown goals ${subcommand} option: ${argument}`);
      }

      const value = requireNonEmpty(
        inlineValue ?? readOptionValue(args, index, option),
        option,
      );
      if (inlineValue === undefined) index += 1;
      goalId = setOnce(goalId, parseGoalId(value), option);
    }

    if (!goalId) {
      throw new UsageError(`goals ${subcommand} requires --goal-id <id>`);
    }
    return withBaseUrl({
      command: subcommand === 'mark-spent'
        ? 'goals-mark-spent'
        : subcommand === 'restore'
          ? 'goals-restore'
          : 'goals-delete',
      goalId,
      apply,
    }, baseUrl);
  }

  throw new UsageError(`Unknown goals command: ${subcommand}`);
}

function helpTopic(argv: string[]): HelpTopic | undefined {
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) continue;
    if (argument === '--base-url') {
      index += 1;
      continue;
    }
    if (argument.startsWith('--base-url=') || argument.startsWith('-')) {
      continue;
    }
    positionals.push(argument);
  }

  const [command, subcommand] = positionals;
  if (command === 'auth') {
    if (
      subcommand === 'login'
      || subcommand === 'status'
      || subcommand === 'logout'
    ) {
      return `auth-${subcommand}`;
    }
    return 'auth';
  }
  if (command === 'goals') {
    if (subcommand === 'list') return 'goals-list';
    if (subcommand === 'create') return 'goals-create';
    if (subcommand === 'update') return 'goals-update';
    if (subcommand === 'mark-spent') return 'goals-mark-spent';
    if (subcommand === 'restore') return 'goals-restore';
    if (subcommand === 'delete') return 'goals-delete';
    return 'goals';
  }
  if (command === 'categories') {
    if (subcommand === 'create') return 'categories-create';
    if (subcommand === 'rename') return 'categories-rename';
    return 'categories';
  }
  if (command === 'line-items') {
    if (subcommand === 'create') return 'line-items-create';
    if (subcommand === 'rename') return 'line-items-rename';
    return undefined;
  }
  if (command === 'budget') {
    if (subcommand === 'status') return 'budget-status';
    if (subcommand === 'update') return 'budget-update';
    if (subcommand === 'move') return 'budget-move';
    return 'budget';
  }
  if (
    command === 'accounts'
    || command === 'transactions'
    || command === 'assign'
    || command === 'ask-partner'
  ) {
    if (command === 'accounts' && subcommand === 'update') return 'accounts-update';
    if (command === 'accounts' && subcommand === 'remove') return 'accounts-remove';
    return command;
  }
  if (command === 'investments') return 'investments';
  return undefined;
}

export function parseArgs(argv: string[]): ParsedCommand {
  if (argv.includes('--help') || argv.includes('-h')) {
    const topic = helpTopic(argv);
    return topic ? { command: 'help', topic } : { command: 'help' };
  }
  if (argv.includes('--version') || argv.includes('-V')) return { command: 'version' };

  const { args, baseUrl } = parseGlobalOptions(argv);
  const command = args.shift();
  if (!command) return { command: 'help' };

  if (command === 'auth') {
    return parseAuth(args, baseUrl);
  }

  if (command === 'goals') {
    return parseGoals(args, baseUrl);
  }

  if (command === 'categories') {
    return parseCategories(args, baseUrl);
  }

  if (command === 'line-items') {
    return parseLineItems(args, baseUrl);
  }

  if (command === 'accounts') {
    return parseAccounts(args, baseUrl);
  }

  if (command === 'investments') {
    return parseInvestments(args, baseUrl);
  }

  if (command === 'budget') {
    return parseBudget(args, baseUrl);
  }

  if (command === 'transactions') {
    return withBaseUrl({ command, filters: parseTransactions(args) }, baseUrl);
  }

  if (command === 'assign') {
    let input: string | undefined;
    let apply = false;
    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index]!;
      if (argument === '--apply') {
        if (apply) throw new UsageError('--apply may only be provided once');
        apply = true;
      } else if (argument === '--input') {
        input = setOnce(input, readOptionValue(args, index, '--input'), '--input');
        index += 1;
      } else if (argument.startsWith('--input=')) {
        input = setOnce(
          input,
          requireNonEmpty(argument.slice('--input='.length), '--input'),
          '--input',
        );
      } else {
        throw new UsageError(`Unknown assign option: ${argument}`);
      }
    }
    if (!input) throw new UsageError('assign requires --input <file>');
    return withBaseUrl({ command, input, apply }, baseUrl);
  }

  if (command === 'ask-partner') {
    let transactionRef: string | undefined;
    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index]!;
      if (argument === '--transaction-ref') {
        transactionRef = setOnce(
          transactionRef,
          readOptionValue(args, index, '--transaction-ref'),
          '--transaction-ref',
        );
        index += 1;
      } else if (argument.startsWith('--transaction-ref=')) {
        transactionRef = setOnce(
          transactionRef,
          requireNonEmpty(
            argument.slice('--transaction-ref='.length),
            '--transaction-ref',
          ),
          '--transaction-ref',
        );
      } else {
        throw new UsageError(`Unknown ask-partner option: ${argument}`);
      }
    }
    if (!transactionRef) {
      throw new UsageError('ask-partner requires --transaction-ref <ref>');
    }
    return withBaseUrl({ command, transactionRef }, baseUrl);
  }

  throw new UsageError(`Unknown command: ${command}`);
}

export function resolveBaseUrl(
  environment: CliEnvironment,
  override: string | undefined,
): string {
  const rawValue = override || environment.SLOTH_AGENT_API_BASE_URL || PRODUCTION_BASE_URL;
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new UsageError('--base-url must be a valid URL');
  }

  if (url.username || url.password) {
    throw new UsageError('--base-url must not include credentials');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new UsageError('--base-url must be an origin only');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) {
    throw new UsageError('--base-url must use HTTPS unless it targets localhost');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UsageError('--base-url must use HTTPS unless it targets localhost');
  }

  return url.origin;
}
