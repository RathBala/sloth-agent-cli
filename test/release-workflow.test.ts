import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

const workflow = fs.readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');

describe('release recovery', () => {
  it('lets failed registry verification run again without publishing again', () => {
    const [publishJob, verifyJob] = workflow.split(/^ {2}verify-registry:\s*$/m);
    expect(verifyJob, 'registry verification needs a separate rerunnable job').toBeDefined();
    expect(publishJob).toContain('npm publish --access public');
    expect(publishJob).toContain('version: ${{ steps.package.outputs.version }}');
    expect(publishJob).not.toContain('npm run test:registry');
    expect(verifyJob).toContain('needs: publish');
    expect(verifyJob).toContain('permissions:\n      contents: read');
    expect(verifyJob).toContain('VERSION: ${{ needs.publish.outputs.version }}');
    expect(verifyJob).toContain('npm run test:registry -- "$VERSION"');
    expect(verifyJob).not.toContain('npm publish');
    expect(verifyJob).not.toContain('environment: npm');
  });

  it.skipIf(process.platform === 'win32').each([
    { availableOnAttempt: 1, attempts: 1, exitCode: 0 },
    { availableOnAttempt: 3, attempts: 3, exitCode: 0 },
    { availableOnAttempt: 9, attempts: 8, exitCode: 1 },
  ])('bounds availability retries: $availableOnAttempt', ({ availableOnAttempt, attempts, exitCode }) => {
    const verifyJob = workflow.split(/^ {2}verify-registry:\s*$/m)[1];
    const script = verifyJob?.match(/ {8}run: \|\r?\n([\s\S]*)$/)?.[1]?.replace(/^ {10}/gm, '');
    expect(script).toBeDefined();
    const result = spawnSync('bash', ['-e', '-c', `
      calls=0
      npm() {
        [[ "$*" == "run test:registry -- 9.8.7" ]] || exit 99
        calls=$((calls + 1))
        printf 'attempt:%s\\n' "$calls"
        [[ "$calls" -ge "$AVAILABLE_ON_ATTEMPT" ]]
      }
      sleep() { printf 'wait:%s\\n' "$1"; }
      ${script}
    `], {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, VERSION: '9.8.7', AVAILABLE_ON_ATTEMPT: String(availableOnAttempt) },
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(exitCode);
    expect(result.stdout.match(/attempt:/g)).toHaveLength(attempts);
    const waits = [...result.stdout.matchAll(/wait:(\d+)/g)].map(match => Number(match[1]));
    expect(waits).toEqual(Array.from({ length: attempts - 1 }, (_, index) => (index + 1) * 10));
  });
});
