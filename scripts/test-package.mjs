import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sloth-agent-package-'));

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.bin?.['sloth-agent'], 'dist/bin.js', 'package must expose the sloth-agent binary');

  const packOutput = execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', temporaryDirectory],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_cache: path.join(temporaryDirectory, 'npm-cache'),
      },
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
  execFileSync('npm', ['init', '--yes'], {
    cwd: installDirectory,
    stdio: 'ignore',
    env: {
      ...process.env,
      npm_config_cache: path.join(temporaryDirectory, 'npm-cache'),
    },
  });
  execFileSync('npm', ['install', path.join(temporaryDirectory, filename)], {
    cwd: installDirectory,
    stdio: 'ignore',
    env: {
      ...process.env,
      npm_config_cache: path.join(temporaryDirectory, 'npm-cache'),
    },
  });

  const executable = path.join(installDirectory, 'node_modules', '.bin', 'sloth-agent');
  assert.equal(
    execFileSync(executable, ['--version'], { encoding: 'utf8' }).trim(),
    packageJson.version,
  );
  assert.match(
    execFileSync(executable, ['--help'], { encoding: 'utf8' }),
    /sloth-agent transactions/,
  );
} finally {
  fs.rmSync(temporaryDirectory, { force: true, recursive: true });
}
