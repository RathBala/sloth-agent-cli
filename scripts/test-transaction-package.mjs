import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

export async function testTransactionPackage(entryPoint) {
  const { agentApiV1TransactionsWithPendingResponse: fixture } = await import(pathToFileURL(
    path.join(path.dirname(entryPoint), 'generated/agent-v1/transactionFixtures.js'),
  ).href);
  let fields = {};
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      ...fixture,
      transactions: [{ ...fixture.transactions[0], ...fields }],
    }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    const run = () => promisify(execFile)(process.execPath, [
      entryPoint, 'transactions', '--include-pending', '--base-url', `http://127.0.0.1:${address.port}`,
    ], {
      env: { ...process.env, SLOTH_AGENT_TOKEN: 'sloth_pat_v1_local_contract_fixture' },
      timeout: 20_000,
    });
    const valid = await run();
    assert.equal(valid.stderr, '');
    assert.deepEqual(JSON.parse(valid.stdout), fixture);
    for (const invalid of [
      { debtorName: 'private-provider-field' },
      { categorySplits: [{ categoryId: 'groceries', amountPence: -1 }] },
      { counterpartyName: 42 },
    ]) {
      fields = invalid;
      await assert.rejects(run, error => {
        assert.equal(error.stdout, '');
        assert.match(error.stderr, /Invalid transactions response/);
        assert.doesNotMatch(error.stderr, /private-provider-field/);
        return true;
      });
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}
