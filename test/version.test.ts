import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CLI_VERSION, resolveCliVersion } from '../src/version.js';

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve('package.json'), 'utf8'),
) as { version?: unknown };

describe('CLI version', () => {
  it('uses package.json as the single version source', () => {
    expect(CLI_VERSION).toBe(packageJson.version);
  });

  it('rejects missing or malformed package versions', () => {
    expect(() => resolveCliVersion({})).toThrow('package.json must contain a valid version');
    expect(() => resolveCliVersion({ version: ' ' })).toThrow('package.json must contain a valid version');
  });
});
