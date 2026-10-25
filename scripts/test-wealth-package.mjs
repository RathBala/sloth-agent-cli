import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

export async function testWealthPackage(entryPoint) {
  const { wealthReadFixture } = await import(pathToFileURL(path.join(path.dirname(entryPoint), 'generated/agent-v1/wealthFixtures.js')).href);
  let response = wealthReadFixture;
  const server = http.createServer((request, res) => {
    assert.equal(request.url, '/api/agent/v1/wealth');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const run = args => promisify(execFile)(process.execPath, [entryPoint, ...args], { env: { ...process.env, SLOTH_AGENT_TOKEN: 'local-wealth-fixture' }, timeout: 20000 });
    for (const args of [[], ['documents'], ['documents', 'extract'], ['documents', 'review'], ['documents', 'save'], ['properties'], ['properties', 'save'], ['properties', 'remove'], ['mortgages'], ['mortgages', 'save'], ['mortgages', 'remove'], ['forecast'], ['budget-payments']]) {
      const help = await run(['wealth', ...args, '--help']);
      assert.equal(help.stderr, '');
      assert.match(help.stdout, /Sloth Agent CLI - wealth/);
      assert.match(help.stdout, /JSON/);
    }
    const address = server.address();
    const command = ['wealth', '--base-url', `http://127.0.0.1:${address.port}`];
    assert.deepEqual(JSON.parse((await run(command)).stdout), wealthReadFixture);
    response = { ...wealthReadFixture, properties: [{ ...wealthReadFixture.properties[0], ownerUid: 'private-owner' }] };
    await assert.rejects(() => run(command), error => {
      assert.equal(error.stdout, '');
      assert.match(error.stderr, /invalid wealth response/);
      assert.doesNotMatch(error.stderr, /private-owner/);
      return true;
    });
  } finally { await new Promise(resolve => server.close(resolve)); }
}
