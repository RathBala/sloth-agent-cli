import fs from 'node:fs';
import { z } from 'zod-v4';
import { UsageError } from './errors.js';
import * as joint from './generated/agent-v1/jointGoals.js';
import * as routing from './generated/agent-v1/contributionRouting.js';

export type JointHelpTopic = 'goals-joint' | 'goals-joint-list' | 'goals-joint-create' | 'goals-joint-convert' | 'goals-joint-update' | 'goals-joint-delete'
  | 'scenarios-routing' | 'scenarios-routing-read' | 'scenarios-routing-save';
export interface JointCommand { group: 'joint' | 'routing'; action: string; goalId?: string; input?: string; apply: boolean }
export function parseJointArgs(group: JointCommand['group'], args: string[]): JointCommand {
  const words = [...args];
  const action = words[0]?.startsWith('-') ? (group === 'joint' ? 'list' : 'read') : words.shift() ?? (group === 'joint' ? 'list' : 'read');
  if (!(group === 'joint' ? ['list', 'create', 'convert', 'update', 'delete'] : ['read', 'save']).includes(action)) throw new UsageError('Choose a command from goals joint --help or scenarios routing --help');
  const values = new Map<string, string>();
  let apply = false;
  while (words.length) {
    const key = words.shift()!;
    if (key === '--apply') { if (apply) throw new UsageError('--apply was supplied twice'); apply = true; continue; }
    if (!['--input', '--goal-id'].includes(key) || values.has(key)) throw new UsageError(`Unsupported or repeated option: ${key}`);
    const value = words.shift();
    if (!value || value.startsWith('-')) throw new UsageError(`${key} requires a value`);
    values.set(key, value);
  }
  const read = action === 'list' || action === 'read';
  const needsId = ['convert', 'update', 'delete'].includes(action);
  if (read && (apply || values.size)) throw new UsageError('Reads accept only global options');
  if (!read && !values.has('--input')) throw new UsageError('This command requires --input FILE');
  if (needsId !== values.has('--goal-id')) throw new UsageError(needsId ? 'This command requires --goal-id ID' : 'This command does not accept --goal-id');
  return { group, action, apply, ...(values.has('--input') ? { input: values.get('--input')! } : {}), ...(needsId ? { goalId: values.get('--goal-id')! } : {}) };
}
export function jointHelpText(topic: string) {
  const routingGroup = topic.startsWith('scenarios');
  const group = routingGroup ? 'scenarios routing' : 'goals joint';
  const action = topic.split('-').slice(2).join('-');
  const actions = routingGroup ? ['read', 'save'] : ['list', 'create', 'convert', 'update', 'delete'];
  const descriptions: Record<string, string> = {
    list: 'Read saved household totals, splits, your funding and partner aggregate progress. The returned defaultViewerShareBasisPoints only prefills a new goal. A null default means existing partner settings conflict; choose and review the split explicitly.',
    read: 'Read routing settings and monthly account balances, deposits, reservations and spending for 1,200 months. Missing funding is reported as incomplete.',
    create: 'Required JSON: name, goalType (keep or spend), totalAmount and viewerShareBasisPoints. Optional: targetMonthKey (YYYY-MM or null), funding and one-based priority. Omitted funding needs setup. Your partner chooses their own accounts.',
    convert: 'Required JSON: totalAmount and viewerShareBasisPoints. Replaces your personal goal with one household goal, preserving its ID, funding, priority and applicable history. Repeating conversion returns the same goal.',
    update: 'Required JSON: expectedRevision from the latest read. Optional: name, totalAmount, viewerShareBasisPoints, goalType, targetMonthKey (YYYY-MM or null), isSpent and your private funding. Omitted fields stay unchanged. Either partner can edit. Use goals update for your private funding and priority.',
    delete: 'Required JSON: expectedRevision from the latest read. Deletes both participations and their routing references. Spending-budget history prevents deletion. Bank balances stay unchanged.',
    save: 'Required JSON: expectedRevision from forecastBasis.activeScenarioRevision and routing. routing is {goalIds:[ID],sourceAccountRefs:[REF]}, or null to disable. Uses existing goal priority and recurring schedules. A source can appear once. An empty goal list stops selected deposits.',
  };
  return [`Sloth Agent CLI - ${group}${action ? ' ' + action : ''}`, '',
    ...(action ? [`Usage: sloth-agent ${group} ${action}${['convert', 'update', 'delete'].includes(action) ? ' --goal-id ID' : ''}${['read', 'list'].includes(action) ? '' : ' --input FILE [--apply]'} [--base-url URL]`, '', descriptions[action]]
      : ['Commands:', ...actions.map(item => `  sloth-agent ${group} ${item} --help`)]), '',
    'Amounts use budget-currency major units, at most two decimal places. Household totals must be positive.',
    'viewerShareBasisPoints is your share from 0 to 10000 (6000 = 60%); the partner receives the remainder.',
    'A saved split never follows later household-default changes. Personal funding cannot exceed the saved share.',
    'Routing passes unused contributions onward within the same month and stops after all selected personal shares are funded.',
    'Other recurring contributions and account-specific one-offs stay separate. This models funding without transferring money.',
    'Writes preview remotely by default and save only with --apply. Preview requires agent:read; saving requires agent:write.',
    'A stale revision requires a fresh read. JSON results go to stdout; diagnostics go to stderr.',
    'Default API origin: https://budget.slothmoney.app. Override with --base-url or SLOTH_AGENT_API_BASE_URL.',
    '-h, --help shows help. HTTPS is required except for localhost development.', ''].join('\n');
}
export function jointRequest(command: JointCommand) {
  const { group, action, apply } = command;
  if (group === 'joint' && action === 'list') return { path: '/joint-goals', method: 'GET', schema: joint.jointGoalsResponseSchema };
  if (group === 'routing' && action === 'read') return { path: '/contribution-routing', method: 'GET', schema: routing.contributionRoutingResponseSchema };
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(command.input!, 'utf8')); }
  catch { throw new UsageError('Could not read --input as JSON'); }
  const schemas: Record<string, z.ZodType> = { create: joint.jointGoalCreateSchema, convert: joint.jointGoalConvertSchema, update: joint.jointGoalUpdateSchema, delete: joint.jointGoalDeleteSchema, save: routing.contributionRoutingWriteSchema };
  const parsed = schemas[action]!.safeParse(raw);
  if (!parsed.success) throw new UsageError(`Invalid ${group} input: ${parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  const id = encodeURIComponent(command.goalId ?? '');
  const path = group === 'routing' ? '/contribution-routing' : action === 'create' ? '/joint-goals' : action === 'convert' ? `/goals/${id}/convert-to-joint` : `/joint-goals/${id}${action === 'delete' ? '/delete' : ''}`;
  return { path: path + (apply ? '' : '/preview'), method: !apply ? 'POST' : group === 'routing' ? 'PUT' : action === 'update' ? 'PATCH' : 'POST', body: JSON.stringify(parsed.data),
    schema: group === 'routing' ? routing.contributionRoutingResponseSchema : action === 'delete' ? z.object({ deleted: z.boolean(), deletedGoalId: z.string() }).strict() : joint.jointGoalMutationResponseSchema };
}
