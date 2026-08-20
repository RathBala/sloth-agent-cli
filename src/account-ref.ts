const ACCOUNT_REF_PATTERN = /^sloth_account_v1_[A-Za-z0-9_-]{43}$/;

export function isAccountRef(value: unknown): value is string {
  return typeof value === 'string' && ACCOUNT_REF_PATTERN.test(value);
}
