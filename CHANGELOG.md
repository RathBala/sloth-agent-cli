# Changelog

## Unreleased

## 0.9.0 - 2026-08-12

- Manage owned manual balance and manual transaction accounts through partial
  account updates, including metadata, ownership, balance-only settings, and
  goal-savings membership where supported.
- Preview or apply idempotent manual account archival while retaining the
  underlying account, transaction, import, balance, and categorisation records.
- Keep account writes local-only by default and require `--apply` before any
  authenticated PATCH or DELETE request is sent.

## 0.8.0 - 2026-08-12

- Read each goal's one-based priority and move one goal to a new position with
  automatic shifting of the intervening goals.

## 0.7.0 - 2026-08-09

- Read personal or joint budget periods with categories, line items, funding,
  and planned amounts.
- Preview or apply planned line-item updates that overwrite the selected period
  and all explicit future plans.

## 0.6.0 - 2026-08-08

- Expose goal-savings membership on account inventory rows and preview or apply
  owner-authorized changes through opaque account references.
- Read cache-only linked investment portfolios with provider-native holdings,
  quantities, valuations, currencies, and freshness metadata.
- Keep strict response validation, JSON-only stdout, command-specific help,
  and clean-install package coverage synchronized with Agent API v1.

## 0.5.0 - 2026-08-07

- Create and rename custom categories, with existing icon and category type
  validation and preview-only writes unless `--apply` is supplied.
- Create and rename personal or joint budget line items while preserving
  historical snapshots and future plan amounts.
- Filter transactions directly by `--line-item-id`, including paired
  `--category-id` matching for split assignments.
- Strictly validate category and line-item mutation responses and extend
  command-specific and packed-binary help coverage.

## 0.4.0 - 2026-08-01

- Document that new Sloth Money personal access tokens are view-only by
  default, and identify the CLI operations that require explicit write access.
- Add the read-only `sloth-agent accounts` command with strict runtime
  validation for opaque references, ownership, native balances, sources, and
  freshness metadata.
- Prepare 0.4.0 by removing the obsolete `joint-budget-settings` command. Shared
  personal transactions now enter the joint budget through their assignment.
- Verify each trusted npm release from a fresh temporary directory so the
  registry smoke test cannot resolve a repository-local CLI executable.

## 0.3.1 - 2026-07-31

- Coordinate transaction reads with the Sloth Budget daily refresh process.
- Wait up to 45 seconds for fresh persisted data, then return readable cached
  transactions with structured refresh status when work continues or fails.
- Validate the additive transaction refresh response contract.

## 0.3.0 - 2026-07-30

- Add command-specific help for every command and auth subcommand, including
  required inputs, option constraints, output, examples, and write safety.
- Explain that categories are parents and line items are scoped children, and
  that line-item labels may repeat across categories.
- Clarify local native credential storage and environment-only authentication
  for containers, CI, and other headless systems.
- Read and preview or apply the linked joint-budget shared-transaction setting.
- Filter transactions by personal or joint assignment scope.
- Categorise shared personal-account contributions against the joint catalogue
  with `assignmentScope: "joint"`.
- Validate the nested `jointBudgetContribution` response contract.
- Add goal listing, creation, partial updates, and deletion through the Agent
  API, with goal document ID validation and typed response validation.
- Keep goal writes in preview mode unless `--apply` is provided, including
  explicit amount and month clearing.
- Explain that active shared goal target amounts remain app-managed so balance
  allocations can be recalculated safely.

## 0.2.0 - 2026-07-23

- Add `auth login`, `auth status`, and `auth logout`.
- Store PATs in native OS credential storage, separated by API origin.
- Keep `SLOTH_AGENT_TOKEN` as the highest-precedence option for CI and
  headless systems.
- Validate imported PATs before saving and report live authentication status
  without exposing credentials.

## 0.1.0 - 2026-07-18

- Publish the first installable Sloth Agent CLI.
- Read categories and filtered transactions from the Agent API.
- Preview or apply transaction assignments.
- Create partner clarification links.
- Validate commands, payloads, API responses, and production URL safety.
