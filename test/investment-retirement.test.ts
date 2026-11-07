import { expect, it } from 'vitest';
import { parseArgs } from '../src/args.js';

it('rejects retired investment commands and account settings', () => {
  expect(() => parseArgs(['investments'])).toThrow();
  expect(() => parseArgs(['accounts', 'update', '--account-ref', 'sloth_account_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '--account-type', 'investments'])).toThrow();
  expect(() => parseArgs(['accounts', 'update', '--account-ref', 'sloth_account_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '--partner-visibility', 'holdings'])).toThrow();
  expect(parseArgs(['portfolio', '--view', 'household'])).toMatchObject({ command: 'portfolio', view: 'household' });
});
