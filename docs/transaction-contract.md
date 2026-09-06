# Transaction contract ownership

The authoritative Agent API v1 transaction schemas and synthetic response fixtures
live in `sloth-budget/server/src/contracts/public/agent-v1/`.
The CLI's `src/generated/agent-v1/` is a deterministic, checked-in copy, not a
second place to edit fields. Both runtimes pin `zod-v4` to `npm:zod@4.1.12`.
This avoids a new package release dependency or runtime access to another checkout.

`transactions.ts` owns booked and pending rows, category splits, account references,
and the response envelope. `transactionRefresh.ts` owns refresh status and reasons;
other server consumers import that same module. `transactionFixtures.ts` owns the
synthetic booked/pending examples used by both repositories' contract tests and the
server-to-packed-CLI test. These small, non-secret fixtures are included in the CLI
package with the generated modules so package contents remain reproducible.

## Runtime behavior

The server transaction route parses its service result with
`agentTransactionsResponseSchema`. Its existing stripping policy removes internal
booked fields. The service's public fields derive from `AgentTransactionsResponse`;
its ownership and database fields remain server-only extensions.

The CLI validates with `agentTransactionsWireResponseSchema`, derived from the same
field definitions, with the existing strict envelope/booked-field policy. Pending
rows remain strict and read-only. Successful output remains the original response
as JSON; malformed responses produce the existing generic error on stderr, without
printing financial fields or Zod issue values. For example, a negative category split
previously passed the CLI's loose array check; now both boundaries reject it.

The `agent-v1` directory versions the wire contract. Additive v1 changes are edited
at the source and regenerated. Breaking changes require an explicit API version
and producer/consumer rollout decision. The refactor adds no response version field.

No data is saved by validation or generation. There is no migration, backfill,
compatibility reader, runtime source download, telemetry, or new credential path.
Existing command help, metadata, and public output remain unchanged.

## Updating and checking

Run from the CLI repository, supplying the exact server checkout under review:

```sh
npm run contracts:sync -- --server-repo /path/to/sloth-budget
npm run contracts:check -- --server-repo /path/to/sloth-budget
npm run verify
npm run test:package -- --server-repo /path/to/sloth-budget
```

`contracts:check` is read-only and fails on schema, fixture, or Zod-version drift.
The combined package check performs that comparison first, builds and installs the
CLI tarball in an isolated temporary directory, then runs the server's real schema
through a loopback HTTP fixture into the installed executable. It checks metadata,
pending data, malformed responses, empty stdout on failure, and safe diagnostics.
Temporary installs and the loopback server are cleaned up automatically. These
checks use synthetic local data and require no sign-in or real PAT.

Ordinary `npm test -- test/contracts.test.ts` runs one file with a 120-second hard
limit and one thread worker. `npm test` runs the whole CLI suite with the same bound.
The package install check uses npm network access. The server checkout must have its
documented dependencies installed (`node scripts/setup-codex-worktree.mjs` in a
configured local worktree, or `yarn deps:install`).

Before release, check the exact paired server checkout with the combined command.
A standalone package test cannot know whether another repository changed. Never
hand-edit generated files to make a consumer accept a producer change.

## Scope and integration

| Surface | Owner and outcome |
| --- | --- |
| CLI | sloth-agent-cli: shared runtime validation, generated fixtures, bounded tests, drift/packed checks |
| Agent API | sloth-budget server: extracted schema, inferred producer type, imports updated |
| Refresh consumers | sloth-budget server: import move only; quota/checkpoint reasons preserved |
| UI, jobs, persistence, Functions, rules | No behavior or data contract change; no migration/deployment target added |
| Public developer/privacy pages | sloth-site inventory reviewed; this refactor changes no public fields, credentials, or telemetry, so no copy/deployment change is required |
| Operational visibility | Existing server diagnostics and CLI errors unchanged; no new payload logging |
| Product analytics | Unchanged: no new product choice or learning question; CLI telemetry remains prohibited |
| Desktop keyboard | Existing CLI entry points unchanged; no new shortcut needed |

The implementation builds on CLI production commit
`f0b09f04` (published CLI 0.24.0) and server main `f7528eac7`, which includes
the deployed metadata commit `de9fd9d14`. Public documentation is live from
sloth-site `147c5e78`. Land paired source changes
and run the normal release gates; runtime schemas are bundled, so neither runtime
requires access to the sibling repository. The wire shape is unchanged, so either
runtime can be updated first.

## Requirement closure

| Requirement | Status and evidence |
| --- | --- |
| One versioned schema with runtime validation | Implemented: canonical server modules, generated CLI modules, route and CLI parser imports |
| Remove duplicate response fixtures | Implemented: canonical transactionFixtures module; test imports and HTTP contract runner use it |
| Preserve public metadata and strict/safe output | Implemented: existing metadata tests plus packed HTTP malformed-field checks |
| Typed producer and consumer agreement | Implemented: inferred service public fields; exact-source and Zod-version drift check |
| Red / Green / Refactor | Implemented: four invalid-row cases failed against the old CLI validator, then passed with the shared schema |
| Packaging and cross-repository integration | Implemented: combined test:package --server-repo gate |
| Isolated scope | Implemented: paired source changes; npm publication remains a separate version-tagged release |

## Verification evidence

- `npm run verify`: passed lint, typecheck, 130 tests, build, and clean package install.
- `npm run contracts:check -- --server-repo ../sloth-budget`: passed exact-source/version comparison.
- `npm run test:package -- --server-repo ../sloth-budget`: passed packed CLI/server integration, including 14 server HTTP requests and four CLI package HTTP cases.
- `npm pack --dry-run --json`: inspected; only the three intended generated modules, no source/tests/env files.
- Server `yarn --cwd server build`: passed.
- Server `yarn eslint <touched TypeScript files>`: passed.
- Server `yarn test:file` passed for:
  - `server/src/contracts/__tests__/agentTransactionWire.test.ts` (5)
  - `server/src/contracts/__tests__/agentApiContracts.test.ts` (34)
  - `server/src/routes/__tests__/agentTransactions.test.ts` (32)
  - `server/src/services/__tests__/agentTransactionAssignmentService.test.ts` (46)
  - `server/src/services/__tests__/agentPendingSnapshotService.test.ts` (11)
  - `server/src/services/__tests__/automaticTransactionRefreshService.test.ts` (21)
- Both worktrees: `git diff --check` passed; obsolete references and temporary instrumentation inspected.

Checks use local synthetic responses, not production banking data. No full frontend
suite or production exercise was needed for this runtime-schema-only refactor.
The remaining contract aggregators exceed 1,000 lines; other response families could
be extracted individually later, but are deliberately outside this transaction scope.


### Production baseline refresh

The isolated branches were updated to CLI `f0b09f04` and server `f7528eac7` after
0.24.0 was released. The runtime transaction source did not change. CLI lint,
typecheck, all 130 tests, source drift check, package dry-run inspection, and the
paired clean-install/server build gate were repeated against those baselines.
The earlier 149 targeted server tests cover the unchanged refactor source.
The later landing decision authorizes committing and pushing both repositories to main.
The server push automatically deploys Railway and Netlify; the CLI push does not
publish an npm release.


### Released-client and new-package checks

The scheduled server job verifies valid producer responses against the released
CLI. The CLI package test owns malformed-response checks for the new validator;
it runs these over loopback HTTP even without a sibling checkout. This keeps the
server's release compatibility check usable before the refactored CLI is published.
