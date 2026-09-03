import { createRequire } from 'node:module';

type PackageMetadata = {
  version?: unknown;
};

export function resolveCliVersion(metadata: PackageMetadata): string {
  if (typeof metadata.version !== 'string' || !metadata.version.trim()) {
    throw new Error('package.json must contain a valid version');
  }
  return metadata.version.trim();
}

const require = createRequire(import.meta.url);
const packageMetadata = require('../package.json') as PackageMetadata;

export const CLI_VERSION = resolveCliVersion(packageMetadata);
