import {
  ApiError,
  ConfigError,
} from './errors.js';

const KEYCHAIN_SERVICE = 'app.slothmoney.agent-cli';

export interface CredentialStore {
  delete(origin: string): Promise<boolean>;
  get(origin: string): Promise<string | null>;
  set(origin: string, token: string): Promise<void>;
}

export type CredentialStoreFactory = () => Promise<CredentialStore>;

export function secureStorageUnavailableError(): ConfigError {
  return new ConfigError(
    'Native secure credential storage is unavailable. Set SLOTH_AGENT_TOKEN instead.',
  );
}

interface KeytarApi {
  deletePassword(service: string, account: string): Promise<boolean>;
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
}

export async function createSystemCredentialStore(): Promise<CredentialStore> {
  let keytar: KeytarApi;
  try {
    const module = await import('@github/keytar');
    keytar = (
      'default' in module
        ? module.default
        : module
    ) as KeytarApi;
  } catch {
    throw secureStorageUnavailableError();
  }

  return {
    delete: async (origin) => {
      try {
        return await keytar.deletePassword(KEYCHAIN_SERVICE, origin);
      } catch {
        throw new ApiError('Failed to delete the credential from native secure storage');
      }
    },
    get: async (origin) => {
      try {
        return await keytar.getPassword(KEYCHAIN_SERVICE, origin);
      } catch {
        throw secureStorageUnavailableError();
      }
    },
    set: async (origin, token) => {
      try {
        await keytar.setPassword(KEYCHAIN_SERVICE, origin, token);
      } catch {
        throw new ApiError('Failed to save the credential to native secure storage');
      }
    },
  };
}
