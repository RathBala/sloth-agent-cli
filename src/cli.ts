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
  type CredentialStoreFactory,
  createSystemCredentialStore,
  secureStorageUnavailableError,
} from './credential-store.js';
import {
  ApiError,
  CliError,
  ConfigError,
  UsageError,
} from './errors.js';

export const CLI_VERSION = '0.2.0';
const REQUEST_TIMEOUT_MS = 30_000;

interface CliOptions {
  env?: CliEnvironment;
  fetch?: typeof globalThis.fetch;
  getCredentialStore?: CredentialStoreFactory;
  isInteractive?: boolean;
  readSecret?: () => Promise<string>;
  readStdin?: () => Promise<string>;
  writeStdout?: (value: string) => void;
  writeStderr?: (value: string) => void;
}

export function usageText(): string {
  return [
    'Sloth Agent CLI',
    '',
    'Usage:',
    '  sloth-agent auth login [--token-stdin | --from-env] [--base-url URL]',
    '  sloth-agent auth status [--base-url URL]',
    '  sloth-agent auth logout [--base-url URL]',
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

function redact(value: string, token: string | undefined): string {
  return token ? value.split(token).join('[REDACTED]') : value;
}

function environmentToken(environment: CliEnvironment): string | undefined {
  const token = environment.SLOTH_AGENT_TOKEN;
  return token?.trim() ? token : undefined;
}

async function defaultReadSecret(): Promise<string> {
  const { default: password } = await import('@inquirer/password');
  return password({
    message: 'Personal access token:',
    mask: '*',
  }, {
    output: process.stderr,
  });
}

async function defaultReadStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function validateLoginToken(value: string): string {
  if (!value.startsWith('sloth_pat_v1_') || /\s/.test(value)) {
    throw new UsageError(
      'Personal access token must use the sloth_pat_v1_ prefix and contain no whitespace',
    );
  }
  return value;
}

function stripStdinLineEnding(value: string): string {
  if (value.endsWith('\r\n')) return value.slice(0, -2);
  if (value.endsWith('\n')) return value.slice(0, -1);
  return value;
}

async function loadCredentialStore(
  getCredentialStore: CredentialStoreFactory,
): Promise<Awaited<ReturnType<CredentialStoreFactory>>> {
  try {
    return await getCredentialStore();
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw secureStorageUnavailableError();
  }
}

async function resolveCredential(
  environment: CliEnvironment,
  origin: string,
  getCredentialStore: CredentialStoreFactory,
): Promise<{ source: 'environment' | 'keychain'; token: string }> {
  const token = environmentToken(environment);
  if (token) return { source: 'environment', token };

  const credentialStore = await loadCredentialStore(getCredentialStore);
  const storedToken = await credentialStore.get(origin);
  if (!storedToken) {
    throw new ConfigError(
      `No credential found for ${origin}. Run "sloth-agent auth login" or set SLOTH_AGENT_TOKEN.`,
    );
  }
  return { source: 'keychain', token: storedToken };
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
      if (response.ok) throw new ApiError('Agent API returned invalid JSON', response.status);
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
    throw new ApiError(redact(message, token), response.status);
  }
  return data;
}

function requestHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'User-Agent': `sloth-agent/${CLI_VERSION}`,
  };
}

async function validateCredentialRemotely(
  fetchImplementation: typeof globalThis.fetch,
  origin: string,
  token: string,
): Promise<void> {
  const response = await fetchImplementation(`${origin}/api/agent/v1/categories`, {
    method: 'GET',
    headers: requestHeaders(token),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  parseApiResponse('categories', await parseHttpResponse(response, token));
}

function maskedTokenSuffix(token: string): string {
  return token.length > 4 ? `…${token.slice(-4)}` : '…';
}

function classifyRemoteStatus(error: unknown): (
  'invalid_or_expired'
  | 'payment_required'
  | 'insufficient_scope'
  | 'unreachable'
) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'invalid_or_expired';
    if (error.status === 402) return 'payment_required';
    if (error.status === 403) return 'insufficient_scope';
  }
  return 'unreachable';
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
  const getCredentialStore = options.getCredentialStore ?? createSystemCredentialStore;
  const isInteractive = options.isInteractive
    ?? Boolean(process.stdin.isTTY && process.stderr.isTTY);
  const readSecret = options.readSecret ?? defaultReadSecret;
  const readStdin = options.readStdin ?? defaultReadStdin;
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

    const baseUrl = resolveBaseUrl(environment, parsed.baseUrl);

    if (parsed.command === 'auth-login') {
      if (parsed.input === 'prompt' && !isInteractive) {
        throw new UsageError(
          'Interactive login requires a TTY. Use --token-stdin or --from-env.',
        );
      }

      let rawToken: string;
      if (parsed.input === 'environment') {
        const tokenFromEnvironment = environmentToken(environment);
        if (!tokenFromEnvironment) {
          throw new ConfigError('SLOTH_AGENT_TOKEN is required with --from-env');
        }
        rawToken = tokenFromEnvironment;
      } else {
        rawToken = await (parsed.input === 'stdin' ? readStdin() : readSecret());
        if (parsed.input === 'stdin') rawToken = stripStdinLineEnding(rawToken);
      }

      token = validateLoginToken(rawToken);
      await validateCredentialRemotely(fetchImplementation, baseUrl, token);
      const credentialStore = await loadCredentialStore(getCredentialStore);
      await credentialStore.set(baseUrl, token);
      const environmentOverrideActive = environmentToken(environment) !== undefined;
      writeJson(writeStdout, {
        activeSource: environmentOverrideActive ? 'environment' : 'keychain',
        environmentOverrideActive,
        origin: baseUrl,
        stored: true,
      });
      return 0;
    }

    if (parsed.command === 'auth-status') {
      const credential = await resolveCredential(environment, baseUrl, getCredentialStore);
      token = credential.token;
      let remoteStatus: 'valid' | ReturnType<typeof classifyRemoteStatus> = 'valid';
      let exitCode = 0;
      try {
        await validateCredentialRemotely(fetchImplementation, baseUrl, token);
      } catch (error) {
        remoteStatus = classifyRemoteStatus(error);
        exitCode = 1;
      }
      writeJson(writeStdout, {
        origin: baseUrl,
        remoteStatus,
        source: credential.source,
        tokenSuffix: maskedTokenSuffix(token),
      });
      return exitCode;
    }

    if (parsed.command === 'auth-logout') {
      const credentialStore = await loadCredentialStore(getCredentialStore);
      const localCredentialRemoved = await credentialStore.delete(baseUrl);
      writeJson(writeStdout, {
        environmentOverrideActive: environmentToken(environment) !== undefined,
        localCredentialRemoved,
        origin: baseUrl,
        remoteRevoked: false,
        revocationInstructions: 'Revoke the token in Sloth Money Settings > Developer access.',
      });
      return 0;
    }

    const credential = await resolveCredential(environment, baseUrl, getCredentialStore);
    token = credential.token;
    const headers = requestHeaders(token);

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
