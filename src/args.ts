import { UsageError } from './errors.js';

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
  assignmentScope?: 'personal' | 'joint';
  cursor?: string;
}

export type HelpTopic =
  | 'auth'
  | 'auth-login'
  | 'auth-status'
  | 'auth-logout'
  | 'categories'
  | 'transactions'
  | 'assign'
  | 'joint-budget-settings'
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
  | { command: 'categories'; baseUrl?: string }
  | {
    command: 'transactions';
    baseUrl?: string;
    filters: TransactionFilters;
  }
  | { command: 'assign'; baseUrl?: string; input: string; apply: boolean }
  | {
    command: 'joint-budget-settings';
    baseUrl?: string;
    includeSharedPersonalTransactions?: boolean;
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

  const [command, authCommand] = positionals;
  if (command === 'auth') {
    if (
      authCommand === 'login'
      || authCommand === 'status'
      || authCommand === 'logout'
    ) {
      return `auth-${authCommand}`;
    }
    return 'auth';
  }
  if (
    command === 'categories'
    || command === 'transactions'
    || command === 'assign'
    || command === 'joint-budget-settings'
    || command === 'ask-partner'
  ) {
    return command;
  }
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

  if (command === 'categories') {
    if (args.length > 0) {
      throw new UsageError(`Unknown categories option: ${args[0]}`);
    }
    return withBaseUrl({ command }, baseUrl);
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

  if (command === 'joint-budget-settings') {
    let includeSharedPersonalTransactions: boolean | undefined;
    let apply = false;
    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index]!;
      if (argument === '--apply') {
        if (apply) throw new UsageError('--apply may only be provided once');
        apply = true;
        continue;
      }

      const optionName = '--include-shared-personal-transactions';
      if (argument === optionName || argument.startsWith(`${optionName}=`)) {
        const value = argument === optionName
          ? readOptionValue(args, index, optionName)
          : argument.slice(`${optionName}=`.length);
        if (argument === optionName) index += 1;
        if (value !== 'true' && value !== 'false') {
          throw new UsageError(`${optionName} must be true or false`);
        }
        includeSharedPersonalTransactions = setOnce(
          includeSharedPersonalTransactions,
          value === 'true',
          optionName,
        );
        continue;
      }

      throw new UsageError(`Unknown joint-budget-settings option: ${argument}`);
    }

    if (apply && includeSharedPersonalTransactions === undefined) {
      throw new UsageError('--apply requires --include-shared-personal-transactions=true|false');
    }

    return withBaseUrl({
      command,
      ...(includeSharedPersonalTransactions === undefined
        ? {}
        : { includeSharedPersonalTransactions }),
      apply,
    }, baseUrl);
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
