export const ICON_KEYS = [
  'home', 'shopping-cart', 'plane', 'car', 'bill', 'dots', 'chart', 'receipt',
  'credit-card', 'user', 'utensils', 'truck', 'calendar', 'heart', 'shopping-bag',
  'gift', 'ban', 'question', 'arrows-sync', 'dollar-sign', 'plus',
] as const;

export type IconKey = typeof ICON_KEYS[number];

export const CATEGORY_TYPES = [
  'Needs',
  'Debts',
  'Savings & Investments',
  'Wants',
] as const;

export type CategoryType = typeof CATEGORY_TYPES[number];
