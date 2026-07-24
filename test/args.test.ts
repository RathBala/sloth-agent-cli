import { describe, expect, it } from 'vitest';

import {
  parseArgs,
  resolveBaseUrl,
} from '../src/args.js';

describe('CLI arguments', () => {
  it('supports help and version without configuration', () => {
    expect(parseArgs(['--help'])).toEqual({ command: 'help' });
    expect(parseArgs(['--version'])).toEqual({ command: 'version' });
  });

  it('parses transaction filters and validates their values', () => {
    expect(parseArgs([
      'transactions',
      '--uncategorized=false',
      '--limit',
      '200',
      '--start-date',
      '2026-05-01',
      '--end-date=2026-05-31',
      '--q',
      'tesco',
      '--account-id',
      'account-1',
      '--category-id',
      'groceries',
      '--cursor',
      'cursor-1',
    ])).toEqual({
      command: 'transactions',
      filters: {
        uncategorized: false,
        limit: 200,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        q: 'tesco',
        accountId: 'account-1',
        categoryId: 'groceries',
        cursor: 'cursor-1',
      },
    });

    expect(() => parseArgs(['transactions', '--limit', '201'])).toThrow(/between 1 and 200/);
    expect(() => parseArgs(['transactions', '--start-date', '2026-02-30'])).toThrow(/valid YYYY-MM-DD/);
    expect(() => parseArgs([
      'transactions',
      '--start-date',
      '2026-06-01',
      '--end-date',
      '2026-05-01',
    ])).toThrow(/end-date must not be before --start-date/);
    expect(() => parseArgs(['transactions', '--q', ''])).toThrow(/requires a value/);
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
