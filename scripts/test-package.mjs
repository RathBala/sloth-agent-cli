import assert from 'node:assert/strict';
import {
  execFileSync,
  spawnSync,
} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sloth-agent-package-'));
const isWindows = process.platform === 'win32';
const npmExecutable = isWindows ? 'npm.cmd' : 'npm';
const commandOptions = isWindows ? { shell: true } : {};

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.bin?.['sloth-agent'], 'dist/bin.js', 'package must expose the sloth-agent binary');

  const packOutput = execFileSync(
    npmExecutable,
    ['pack', '--json', '--pack-destination', temporaryDirectory],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_cache: path.join(temporaryDirectory, 'npm-cache'),
      },
      ...commandOptions,
    },
  );
  const [{ filename, files }] = JSON.parse(packOutput);
  const includedPaths = files.map((file) => file.path);
  assert(includedPaths.includes('dist/bin.js'));
  assert(!includedPaths.some((file) => file.startsWith('src/')));
  assert(!includedPaths.some((file) => file.startsWith('test/')));
  assert(!includedPaths.some((file) => file.endsWith('.map')));

  const installDirectory = path.join(temporaryDirectory, 'install');
  fs.mkdirSync(installDirectory);
  execFileSync(npmExecutable, ['init', '--yes'], {
    cwd: installDirectory,
    stdio: 'ignore',
    env: {
      ...process.env,
      npm_config_cache: path.join(temporaryDirectory, 'npm-cache'),
    },
    ...commandOptions,
  });
  execFileSync(npmExecutable, ['install', path.join(temporaryDirectory, filename)], {
    cwd: installDirectory,
    stdio: 'ignore',
    env: {
      ...process.env,
      npm_config_cache: path.join(temporaryDirectory, 'npm-cache'),
    },
    ...commandOptions,
  });

  const executable = path.join(
    installDirectory,
    'node_modules',
    '.bin',
    isWindows ? 'sloth-agent.cmd' : 'sloth-agent',
  );
  assert.equal(
    execFileSync(executable, ['--version'], {
      encoding: 'utf8',
      ...commandOptions,
    }).trim(),
    packageJson.version,
  );
  const help = execFileSync(executable, ['--help'], {
    encoding: 'utf8',
    ...commandOptions,
  });
  assert.match(help, /sloth-agent auth login/);
  assert.match(help, /sloth-agent auth status/);
  assert.match(help, /sloth-agent auth logout/);
  assert.match(help, /sloth-agent transactions/);

  fs.rmSync(
    path.join(installDirectory, 'node_modules', '@github', 'keytar'),
    { force: true, recursive: true },
  );
  const environmentOnlyStatus = spawnSync(
    executable,
    ['auth', 'status', '--base-url', 'http://localhost:1'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        SLOTH_AGENT_TOKEN: 'sloth_pat_v1_package-smoke',
      },
      ...commandOptions,
    },
  );
  assert.equal(environmentOnlyStatus.status, 1);
  assert.equal(environmentOnlyStatus.stderr, '');
  assert.equal(
    JSON.parse(environmentOnlyStatus.stdout).remoteStatus,
    'unreachable',
  );
} finally {
  fs.rmSync(temporaryDirectory, { force: true, recursive: true });
}
