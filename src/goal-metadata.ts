export const GOAL_TYPES = ['keep', 'spend'] as const;

export type GoalType = typeof GOAL_TYPES[number];

export function isGoalType(value: unknown): value is GoalType {
  return typeof value === 'string' && GOAL_TYPES.includes(value as GoalType);
}
