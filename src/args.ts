import { UsageError } from './errors.js';
import {
  CATEGORY_TYPES,
  ICON_KEYS,
  type CategoryType,
  type IconKey,
} from './category-metadata.js';

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
  | 'investments'
  | 'budget'
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
    isGoalSavingsSource: boolean;
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
    targetAmount?: number;
    targetMonthKey?: string;
    apply: boolean;
  }
  | {
    command: 'goals-update';
    baseUrl?: string;
    goalId: string;
    name?: string;
    targetAmount?: number | null;
    targetMonthKey?: string | null;
    isAchieved?: boolean;
    priority?: number;
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

function parseGoalAmount(value: string, name: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new UsageError(`${name} must be a positive amount with at most two decimal places`);
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new UsageError(`${name} must be a positive amount with at most two decimal places`);
  }
  return amount;
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

function parseExplicitBoolean(value: string, name: string): boolean {
  if (value !== 'true' && value !== 'false') {
    throw new UsageError(`${name} must be true or false`);
  }
  return value === 'true';
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

function parseResourceId(value: string, option: '--category-id' | '--line-item-id'): string {
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
    const resource = option === '--category-id' ? 'category' : 'line-item';
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
      new Set(['--account-ref', '--goal-savings-source']),
    );
    const source = requiredOption(
      values,
      '--goal-savings-source',
      'accounts update',
    );
    if (source !== 'true' && source !== 'false') {
      throw new UsageError('--goal-savings-source must be true or false');
    }
    return withBaseUrl({
      command: 'accounts-update',
      accountRef: parseAccountRef(requiredOption(values, '--account-ref', 'accounts update')),
      isGoalSavingsSource: source === 'true',
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
  const update = args[0] === 'update';
  if (update) args.shift();
  const { values, apply } = parseNamedOptions(
    args,
    update ? 'budget update' : 'budget',
    new Set(update ? ['--scope', '--period', '--input'] : ['--scope', '--period']),
  );
  if (!update && apply) throw new UsageError('Unknown budget option: --apply');

  const scope = requiredOption(values, '--scope', update ? 'budget update' : 'budget');
  if (scope !== 'personal' && scope !== 'joint') {
    throw new UsageError('--scope must be personal or joint');
  }
  const period = values.get('--period');
  const common = {
    scope: scope as 'personal' | 'joint',
    ...(period === undefined ? {} : { periodKey: parseGoalMonthKey(period, '--period') }),
  };
  if (!update) return withBaseUrl({ command: 'budget', ...common }, baseUrl);

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
          parseGoalAmount(value, option),
          option,
        );
      } else {
        targetMonthKey = setOnce(
          targetMonthKey,
          parseGoalMonthKey(value, option),
          option,
        );
      }
    }

    if (!name) throw new UsageError('goals create requires --name <name>');
    return withBaseUrl({
      command: 'goals-create',
      name,
      ...(targetAmount === undefined ? {} : { targetAmount }),
      ...(targetMonthKey === undefined ? {} : { targetMonthKey }),
      apply,
    }, baseUrl);
  }

  if (subcommand === 'update') {
    let goalId: string | undefined;
    let name: string | undefined;
    let targetAmount: number | null | undefined;
    let targetMonthKey: string | null | undefined;
    let isAchieved: boolean | undefined;
    let priority: number | undefined;
    let apply = false;

    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index]!;
      if (argument === '--apply') {
        if (apply) throw new UsageError('--apply may only be provided once');
        apply = true;
        continue;
      }
      if (argument === '--clear-target-amount') {
        if (targetAmount !== undefined) {
          throw new UsageError(
            '--target-amount and --clear-target-amount are mutually exclusive',
          );
        }
        targetAmount = null;
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
        && option !== '--achieved'
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
        if (targetAmount !== undefined) {
          throw new UsageError(
            '--target-amount and --clear-target-amount are mutually exclusive',
          );
        }
        targetAmount = parseGoalAmount(value, option);
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
        isAchieved = setOnce(
          isAchieved,
          parseExplicitBoolean(value, option),
          option,
        );
      }
    }

    if (!goalId) throw new UsageError('goals update requires --goal-id <id>');
    if (
      name === undefined
      && targetAmount === undefined
      && targetMonthKey === undefined
      && isAchieved === undefined
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
        || isAchieved !== undefined
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
      ...(isAchieved === undefined ? {} : { isAchieved }),
      ...(priority === undefined ? {} : { priority }),
      apply,
    }, baseUrl);
  }

  if (subcommand === 'delete') {
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
        throw new UsageError(`Unknown goals delete option: ${argument}`);
      }

      const value = requireNonEmpty(
        inlineValue ?? readOptionValue(args, index, option),
        option,
      );
      if (inlineValue === undefined) index += 1;
      goalId = setOnce(goalId, parseGoalId(value), option);
    }

    if (!goalId) throw new UsageError('goals delete requires --goal-id <id>');
    return withBaseUrl({
      command: 'goals-delete',
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
    return subcommand === 'update' ? 'budget-update' : 'budget';
  }
  if (
    command === 'accounts'
    || command === 'transactions'
    || command === 'assign'
    || command === 'ask-partner'
  ) {
    if (command === 'accounts' && subcommand === 'update') return 'accounts-update';
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
