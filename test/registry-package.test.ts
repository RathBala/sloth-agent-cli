import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
  tempDirectories.length = 0;
});

describe('published package verification', () => {
  it('runs the exact registry package from a fresh directory outside the repository', () => {
    const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sloth-agent-registry-test-'));
    tempDirectories.push(fixtureDirectory);
    const repositoryTempRoot = path.join(projectRoot, 'node_modules', '.registry-test-tmp');
    fs.mkdirSync(repositoryTempRoot, { recursive: true });
    tempDirectories.push(repositoryTempRoot);
    const capturePath = path.join(fixtureDirectory, 'capture.json');
    const fakeNpmScript = path.join(fixtureDirectory, 'fake-npm.mjs');
    fs.writeFileSync(fakeNpmScript, `
      import fs from 'node:fs';

      fs.writeFileSync(process.env.CAPTURE_PATH, JSON.stringify({
        argv: process.argv.slice(2),
        cwd: process.cwd(),
        entries: fs.readdirSync(process.cwd()),
        pathEntries: process.env.PATH.split(process.platform === 'win32' ? ';' : ':'),
      }));
      process.stdout.write(process.env.EXPECTED_VERSION + '\\n');
    `);

    const fakeBinDirectory = path.join(fixtureDirectory, 'bin');
    fs.mkdirSync(fakeBinDirectory);
    if (process.platform === 'win32') {
      fs.writeFileSync(
        path.join(fakeBinDirectory, 'npm.cmd'),
        '@echo off\r\n"%FAKE_NPM_NODE%" "%FAKE_NPM_SCRIPT%" %*\r\n',
      );
    } else {
      const fakeNpm = path.join(fakeBinDirectory, 'npm');
      fs.writeFileSync(
        fakeNpm,
        '#!/bin/sh\nexec "$FAKE_NPM_NODE" "$FAKE_NPM_SCRIPT" "$@"\n',
        { mode: 0o755 },
      );
    }

    const version = '9.8.7';
    const result = spawnSync(
      process.execPath,
      [path.join(projectRoot, 'scripts', 'test-registry-package.mjs'), version],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CAPTURE_PATH: capturePath,
          EXPECTED_VERSION: version,
          FAKE_NPM_NODE: process.execPath,
          FAKE_NPM_SCRIPT: fakeNpmScript,
          PATH: `${fakeBinDirectory}${path.delimiter}${process.env.PATH ?? ''}`,
          TEMP: repositoryTempRoot,
          TMP: repositoryTempRoot,
          TMPDIR: repositoryTempRoot,
        },
      },
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
    expect(capture).toMatchObject({
      argv: [
        'exec',
        '--yes',
        '--package=@slothmoney/agent-cli@9.8.7',
        '--',
        'sloth-agent',
        '--version',
      ],
      cwd: expect.not.stringContaining(projectRoot),
      entries: [],
    });
    expect(capture.pathEntries).not.toEqual(
      expect.arrayContaining([expect.stringContaining(projectRoot)]),
    );
  });
});
