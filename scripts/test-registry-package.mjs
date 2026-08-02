import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function isInside(directory, candidate) {
  const relativePath = path.relative(directory, candidate);
  return relativePath === '' || (
    relativePath !== '..'
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath)
  );
}

const projectRoot = path.resolve(import.meta.dirname, '..');
const canonicalProjectRoot = fs.realpathSync(projectRoot);
const version = process.argv[2];
assert(version, 'usage: node scripts/test-registry-package.mjs VERSION');

const configuredTempRoot = fs.realpathSync(os.tmpdir());
const safeTempRoot = isInside(canonicalProjectRoot, configuredTempRoot)
  ? path.dirname(canonicalProjectRoot)
  : configuredTempRoot;
const temporaryDirectory = fs.mkdtempSync(path.join(safeTempRoot, 'sloth-agent-registry-'));
const executionDirectory = path.join(temporaryDirectory, 'run');
fs.mkdirSync(executionDirectory);

const npmCliPath = process.env.npm_execpath;
assert(npmCliPath, 'npm_execpath is required; run this check through npm');
const npmNodeExecutable = process.env.npm_node_execpath ?? process.execPath;
const cleanPath = (process.env.PATH ?? '')
  .split(path.delimiter)
  .filter((entry) => !isInside(projectRoot, path.resolve(entry)))
  .join(path.delimiter);

try {
  const installedVersion = execFileSync(
    npmNodeExecutable,
    [
      npmCliPath,
      'exec',
      '--yes',
      `--package=@slothmoney/agent-cli@${version}`,
      '--',
      'sloth-agent',
      '--version',
    ],
    {
      cwd: executionDirectory,
      encoding: 'utf8',
      timeout: 120_000,
      env: {
        ...process.env,
        PATH: cleanPath,
        npm_config_cache: path.join(temporaryDirectory, 'npm-cache'),
        npm_config_prefer_online: 'true',
      },
    },
  ).trim();

  assert.equal(installedVersion, version, 'registry package must report the published version');
} finally {
  fs.rmSync(temporaryDirectory, { force: true, recursive: true });
}
