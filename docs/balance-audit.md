# Balance audit implementation and release

## Command and API

`budget audit --scope personal|joint [--period YYYY-MM] [--limit N] [--cursor CURSOR]`
calls `GET /api/agent/v1/budget-audit`. The API needs `agent:read` and accepts
`scope`, optional `periodKey`, `limit` (1 to 100, default 20), and opaque `cursor`.
CLI arguments fail before any request with exit 2; remote or malformed-response
errors use the existing API error behavior and empty stdout. The CLI also rejects
responses whose scope or history filter differs from the request. Success emits one
JSON response, with no financial diagnostics or credential values.

The response separates `current` from `checkpoints`. `current` always describes
the current period; `checkpointPeriodKey` records the optional history filter.
Filtering or pagination never substitutes an older observation for Now. Scope
must be explicit, and personal and joint data are returned in separate calls.

Now compares the current saved budget and cached booked transactions with the
latest eligible scope checkpoint. A later backing-account save invalidates it;
a verified checkpoint becomes stale after 24 hours. Its source period is shown
because the latest checkpoint can come from a different budget period. Missing
budget funds, account balances, differences and timestamps remain null.

`differencePence = budgetRemainingPence - accountBalancePence`, only when both
amounts are available. Historical verification describes the capture, not
present-day freshness. `capturedAt` maps the existing `refreshedAt` storage field
to its actual meaning. `sourceBalanceAt` is null for existing captures because
their source bank time was not stored. No timestamp is inferred from checkpoint
IDs or today's bank state.

`historyCoverage=recorded_checkpoints_only` is deliberate. Observations locate
changes but do not establish their causes or recreate missing history. Budget
save history is distinct; it does not provide assigned-pot movement history.
No new transaction or movement reader is added by this feature.

Checkpoint queries use capture time descending and Firestore's document-name
tie order. Snapshot cursors preserve that order when capture times match; see
[Firestore index ordering](https://firebase.google.com/docs/firestore/query-data/index-overview).

## Data models

Existing source of truth: scoped `userBudgetSettings` selects the backing
account; period budgets own assigned funds and reserves; transactions own booked
spending; the existing reconciliation snapshot collections own recorded cash
comparisons. Each user owns one personal collection. A validated joint budget
has its own collection shared by its linked owners. Snapshot document IDs are
stable observation identities, not source timestamp contracts.

The new model is only a transport view. Required fields include explicit scope,
current period, currency, verification status, coverage and page metadata.
Amounts and source timestamps are explicitly nullable. The server-owned Zod
schema in `server/src/contracts/public/agent-v1/budgetAudit.ts` validates output
and cross-field arithmetic. It is generated into this CLI with the existing
contract sync and checked against the exact paired server checkout.

No new persisted user data, save trigger, migration, backfill, acknowledgement,
or compatibility reader is introduced. Reads are transient. Existing historical
records are preserved. The server's shared calculation adapter now includes
uncategorised booked spending in both Now and future refresh captures. Both use
the same cached reader, including manual booked expenses. Existing
incorrect captures are not rewritten or silently corrected on read.

Reusing storage is the smallest sufficient option. Recomputing historical values
from today's transactions or balances would misrepresent the original observation.
If a future requirement needs exact bank observation times, capture writers must
store those times going forward with corresponding rules and shared contracts.

## Ownership and affected surfaces

| Surface | Canonical owner and impact |
| --- | --- |
| Human UI | sloth-budget BudgetPage: reuses the shared freshness function; appearance and interaction unchanged |
| Agent API | sloth-budget Railway server: new authorized cached read, receiving query and response validation |
| Reconciliation calculation/capture | sloth-budget server/domain: shared adapter uses the canonical UI calculation and counts uncategorised spend; future captures only |
| CLI | sloth-agent-cli: parser, both help indexes, command help, JSON validation, generated contracts and installed-package checks |
| Persistence | sloth-budget Firestore: existing rows retained; two composite indexes for period-filtered history; no rules/schema/writer shape change |
| Jobs/Functions/provider refresh | Existing refresh capture consumes the corrected adapter; no new trigger, provider call, worker or Functions deployment |
| Skills/automations/SDK/MCP | Consumers may adopt the additive command after release; existing workflows and MCP tool list are unchanged, no automatic financial action added |
| Public developer docs | sloth-site: examples and endpoint updated to CLI 0.32.0 during coordinated release |
| Privacy docs | Existing financial-processing and authorized Agent API access disclosures apply; no new data purpose, provider, credential, identity or retention, so no policy-copy change |

Operational visibility: the server logs audit outcome, auth class, status code,
fixed failure stage and sanitized error class. No amounts, IDs, account paths,
periods, cursor contents or raw errors are logged. The server tracking inventory
is updated. Product analytics: no new telemetry is added. There is no approved
product-learning question requiring behavioral tracking for this read command.
Desktop keyboard access is the CLI itself; no new app shortcut is needed.

## Verification and local review

From `/Users/rathbala/Code/sloth-agent-cli`, run:

```sh
npm test -- test/budget-audit.test.ts
npm run build
node dist/bin.js budget audit --help
npm run contracts:check -- --server-repo /absolute/path/to/current/sloth-budget
npm run test:package -- --server-repo /absolute/path/to/current/sloth-budget
```

Use a checkout of current backend `main` for paired verification. Use Node 22 for backend verification. In the paired checkout, run the canonical
`yarn deps:install` to cover root, server and Functions dependencies. Root-only
installation misses Functions checks; Node 25's localStorage behavior can break
the repository's existing browser test environment. On this machine:

```sh
cd /absolute/path/to/current/sloth-budget
export PATH=/Users/rathbala/.nvm/versions/node/v22.23.2/bin:$PATH
yarn deps:install
yarn test
```

Package checks
need npm network access, but no sign-in or real token. Synthetic loopback HTTP
exercises the actual server read service over saved budget, booked transaction
and checkpoint fixtures, then the clean-installed CLI. It checks uncategorised
spending, reserves, pagination with equal timestamps, cross-period filtering,
joint separation, cursor errors, response validation and unchanged persisted data.
The temporary servers and installs are cleaned up automatically.

What to check: audit appears in top-level and budget help; Now stays current when
filtering historical checkpoints; unavailable timestamps remain null; signed
differences are consistent; the paired check passes with no real credentials.

## Release order and completed release

The coordinated release is authorized. CLI 0.32.0 introduces the additive command.
The backend candidate comes from `codex/balance-audit`, based on main
`7449f5e4b`. The older `codex/partner-pending` checkout and its unrelated edits
are excluded. Release the backend before the CLI so existing consumers keep working.

1. Review and land the paired backend changes; deploy only the required Firestore
   indexes and wait for them to be ready. No financial data migration is needed.
2. Deploy and verify the Railway API. Existing app and CLI behavior stays compatible.
   Pushing source alone is not proof of the separately managed runtime and index state.
3. Choose the new CLI version, run release gates against the integrated server,
   and publish through the reviewed version-tagged trusted GitHub workflow.
4. Replace the public docs' Unreleased marker and its documentation assertion
   with the published version, run
   sloth-site release/deploy-output checks, deploy docs, and verify the public page.

The release completed on 10 October 2026. Backend `0e914dc778024ff989950fb94e954ea5640149b0`
is on main, Railway reports SUCCESS, and the matching Netlify app deployment is
published. Both required Firestore indexes are READY in `budgie-dc9f6`.
Live personal and joint reads passed shared-schema validation, filtered history,
pagination and current-period isolation without requesting a provider refresh.

CLI tag `v0.32.0` points to reviewed commit `8d26bfa955ecef17810bb205cb80e5697399e7b4`.
The [trusted publication workflow](https://github.com/RathBala/sloth-agent-cli/actions/runs/38041199977)
passed, including a fresh registry install. Both existing local installations were
updated to 0.32.0 and passed command help and live read checks.
Public docs `ae6967d6e13412ab617c90086b13f6a23a6c3eca` are on main and published by
Netlify. The production page shows audit availability in CLI 0.32.0 and retains
the newer hosted-MCP guidance. Desktop and mobile production screenshots were inspected.

For future releases, wait for the publication workflow's registry-install check
to pass before running the public docs build or updating installed clients.
An accepted npm publication can precede public registry availability.

## Requirement closure

| Requirement | Status and evidence |
| --- | --- |
| Audit distinct from budget saves | Implemented: new command, endpoint, help and coverage literal |
| Now separate from recorded history | Implemented: current-only cached reader plus independent latest checkpoint read; service and installed-CLI tests |
| Canonical financial calculation and ownership | Implemented: shared server domain calculation, normalized saved refs, validated joint owners; synthetic persisted-state and ownership tests |
| Unavailable values and time provenance | Implemented: nullable schema, source/capture fields, strict malformed-row tests |
| Bounded filtering and pagination | Implemented: 1 to 100, period-filtered indexed query, snapshot cursor including tie order; filter/scope/cursor tests |
| Read-only financial interaction | Implemented: GET, agent:read, cached reader; installed test has no writable DB methods and asserts unchanged stored state |
| Paired contracts/help/package tests | Implemented: server-owned Zod schema and fixture, generated CLI, help tests, installed loopback runner |
| Source docs, privacy and surface inventory | Implemented: this file, README, changelog, server feature/tracking docs, sibling public page and deploy-output checks |
| Deployment and publication | Implemented: exact-commit Railway and Netlify deployments, READY indexes, trusted v0.32.0 publication, fresh registry install and live reads |

## Final validation and review evidence

- CLI: `npm run verify`, 180 tests; `npm pack --dry-run --json`, 28 package
  entries with only distribution files and intended package documentation.
- Paired installed package: `npm run test:package -- --server-repo
  /absolute/path/to/current/sloth-budget`, exact contracts and 40
  connected requests, including the actual cached audit and capture loaders.
- Backend: `yarn lint` (zero errors, ten existing warnings), `yarn typecheck`,
  Node 22 `yarn test` (2,902 passing, 13 intentionally skipped), server build,
  capture regression, and `yarn test:e2e:preview
  tests/budget-reconciliation-preview.spec.ts --project=chromium` (three passing).
- Release verification: `SLOTH_E2E_AUTH_PORT=9199 SLOTH_FUNDING_CLI_REPO=/Users/rathbala/Code/sloth-agent-cli yarn test:e2e` passed all 90 preview and 81 emulator checks in the integrated backend. One earlier transaction round-trip assertion timed out; it passed both in isolation and in the complete rerun on the unchanged candidate. The alternate Auth port preserves another project's review preview on 9099. The runner, browser SDK and Admin client share the explicit loopback port, with mismatch, receiving-client and temporary-config cleanup regressions (31 focused tests passed).
- Site: `yarn build`, developer CLI checks, public-site readiness, tracking,
  typecheck and touched-file formatting checks. Desktop 1440×1000 and mobile
  390×844 screenshots were inspected with no page-level horizontal overflow.

The approved local documentation preview was stopped when release began.
Production documentation is `https://slothmoney.app/developers/#budget-balance-audit`.
No sign-in is needed. To review the source independently:

```sh
cd /Users/rathbala/Code/sloth-site
python3 -m http.server 3086 --bind 127.0.0.1 --directory src
```

Open `http://127.0.0.1:3086/developers/#budget-balance-audit` and stop the manually
started server with Ctrl+C. Release verification processes and temporary
integration checkouts are cleaned up after their results are recorded.
