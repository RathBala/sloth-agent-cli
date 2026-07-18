import fs from 'node:fs';

import {
  type CliEnvironment,
  type ParsedCommand,
  parseArgs,
  resolveBaseUrl,
} from './args.js';
import {
  parseApiResponse,
  validateAssignmentPayload,
} from './contracts.js';
import {
  ApiError,
  CliError,
  ConfigError,
  UsageError,
} from './errors.js';

export const CLI_VERSION = '0.1.0';
const REQUEST_TIMEOUT_MS = 30_000;

interface CliOptions {
  env?: CliEnvironment;
  fetch?: typeof globalThis.fetch;
  writeStdout?: (value: string) => void;
  writeStderr?: (value: string) => void;
}

export function usageText(): string {
  return [
    'Sloth Agent CLI',
    '',
    'Usage:',
    '  sloth-agent categories [--base-url URL]',
    '  sloth-agent transactions [--uncategorized[=true|false]] [--limit N]',
    '    [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--q TEXT]',
    '    [--account-id ID] [--category-id ID] [--cursor CURSOR] [--base-url URL]',
    '  sloth-agent assign --input assignments.json [--apply] [--base-url URL]',
    '  sloth-agent ask-partner --transaction-ref REF [--base-url URL]',
    '  sloth-agent --help',
    '  sloth-agent --version',
    '',
    'Environment:',
    '  SLOTH_AGENT_TOKEN         Personal access token from Settings > Developer access',
    '  SLOTH_AGENT_API_BASE_URL  Optional API origin; defaults to https://budget.slothmoney.app',
  ].join('\n');
}

function writeJson(write: (value: string) => void, data: unknown): void {
  write(`${JSON.stringify(data, null, 2)}\n`);
}

function requireToken(environment: CliEnvironment): string {
  const token = environment.SLOTH_AGENT_TOKEN;
  if (!token?.trim()) throw new ConfigError('SLOTH_AGENT_TOKEN is required');
  return token;
}

function redact(value: string, token: string | undefined): string {
  return token ? value.split(token).join('[REDACTED]') : value;
}

function readAssignmentFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`Failed to read assignment JSON: ${message}`);
  }
}

function buildTransactionsQuery(
  filters: Extract<ParsedCommand, { command: 'transactions' }>['filters'],
): string {
  const params = new URLSearchParams();
  if (filters.uncategorized !== undefined) {
    params.set('uncategorized', String(filters.uncategorized));
  }
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.startDate !== undefined) params.set('startDate', filters.startDate);
  if (filters.endDate !== undefined) params.set('endDate', filters.endDate);
  if (filters.q !== undefined) params.set('q', filters.q);
  if (filters.accountId !== undefined) params.set('accountId', filters.accountId);
  if (filters.categoryId !== undefined) params.set('categoryId', filters.categoryId);
  if (filters.cursor !== undefined) params.set('cursor', filters.cursor);
  return params.toString();
}

async function parseHttpResponse(
  response: Response,
  token: string,
): Promise<unknown> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      if (response.ok) throw new ApiError('Agent API returned invalid JSON');
    }
  }

  if (!response.ok) {
    const message = (
      data
      && typeof data === 'object'
      && 'error' in data
      && typeof data.error === 'string'
    )
      ? data.error
      : `Agent API request failed with status ${response.status}`;
    throw new ApiError(redact(message, token));
  }
  return data;
}

function hasFailures(value: unknown): boolean {
  if (!value || typeof value !== 'object' || !('failed' in value)) return false;
  return Array.isArray(value.failed) && value.failed.length > 0;
}

export async function runCli(
  argv: string[] = process.argv.slice(2),
  options: CliOptions = {},
): Promise<number> {
  const environment = options.env ?? process.env;
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const writeStdout = options.writeStdout ?? ((value: string) => process.stdout.write(value));
  const writeStderr = options.writeStderr ?? ((value: string) => process.stderr.write(value));
  let token: string | undefined;

  try {
    const parsed = parseArgs(argv);
    if (parsed.command === 'help') {
      writeStdout(`${usageText()}\n`);
      return 0;
    }
    if (parsed.command === 'version') {
      writeStdout(`${CLI_VERSION}\n`);
      return 0;
    }

    token = requireToken(environment);
    const baseUrl = resolveBaseUrl(environment, parsed.baseUrl);
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': `sloth-agent/${CLI_VERSION}`,
    };

    if (parsed.command === 'assign') {
      const payload = validateAssignmentPayload(readAssignmentFile(parsed.input));
      const endpoint = `${baseUrl}/api/agent/v1/transaction-assignments`;
      if (!parsed.apply) {
        writeJson(writeStdout, { dryRun: true, endpoint, payload });
        return 0;
      }
      const response = await fetchImplementation(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = parseApiResponse('assign', await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return hasFailures(data) ? 1 : 0;
    }

    if (parsed.command === 'ask-partner') {
      const response = await fetchImplementation(
        `${baseUrl}/api/agent/v1/transaction-explanation-requests`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transactionRef: parsed.transactionRef }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      const data = parseApiResponse('ask-partner', await parseHttpResponse(response, token));
      writeJson(writeStdout, data);
      return 0;
    }

    const path = parsed.command === 'categories'
      ? '/api/agent/v1/categories'
      : `/api/agent/v1/transactions${(() => {
        const query = buildTransactionsQuery(parsed.filters);
        return query ? `?${query}` : '';
      })()}`;
    const response = await fetchImplementation(`${baseUrl}${path}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = parseApiResponse(parsed.command, await parseHttpResponse(response, token));
    writeJson(writeStdout, data);
    return 0;
  } catch (error) {
    const exitCode = error instanceof CliError ? error.exitCode : 1;
    const message = error instanceof Error ? error.message : String(error);
    writeStderr(`${redact(message, token)}\n`);
    return exitCode;
  }
}
