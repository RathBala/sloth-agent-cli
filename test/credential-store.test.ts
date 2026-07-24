import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createSystemCredentialStore } from '../src/credential-store.js';

const keytar = vi.hoisted(() => ({
  deletePassword: vi.fn(),
  getPassword: vi.fn(),
  setPassword: vi.fn(),
}));

vi.mock('@github/keytar', () => ({
  default: keytar,
}));

const SERVICE = 'app.slothmoney.agent-cli';
const ORIGIN = 'https://budget.slothmoney.app';

describe('native credential store', () => {
  beforeEach(() => {
    keytar.deletePassword.mockReset();
    keytar.getPassword.mockReset();
    keytar.setPassword.mockReset();
  });

  it('uses one native credential account per API origin', async () => {
    keytar.getPassword.mockResolvedValue('stored-token');
    keytar.deletePassword.mockResolvedValue(true);
    const store = await createSystemCredentialStore();

    await expect(store.get(ORIGIN)).resolves.toBe('stored-token');
    await store.set(ORIGIN, 'replacement-token');
    await expect(store.delete(ORIGIN)).resolves.toBe(true);

    expect(keytar.getPassword).toHaveBeenCalledWith(SERVICE, ORIGIN);
    expect(keytar.setPassword).toHaveBeenCalledWith(
      SERVICE,
      ORIGIN,
      'replacement-token',
    );
    expect(keytar.deletePassword).toHaveBeenCalledWith(SERVICE, ORIGIN);
  });

  it('maps native read and write failures to stable CLI errors', async () => {
    const store = await createSystemCredentialStore();

    keytar.getPassword.mockRejectedValueOnce(new Error('native detail'));
    await expect(store.get(ORIGIN)).rejects.toMatchObject({ exitCode: 3 });

    keytar.setPassword.mockRejectedValueOnce(new Error('native detail'));
    await expect(store.set(ORIGIN, 'secret')).rejects.toMatchObject({ exitCode: 1 });

    keytar.deletePassword.mockRejectedValueOnce(new Error('native detail'));
    await expect(store.delete(ORIGIN)).rejects.toMatchObject({ exitCode: 1 });
  });
});
