# Changelog

## Unreleased

- Run applied transaction-assignment batches through resumable server
  operations while keeping the existing `assign --input ... --apply` command
  and terminal `succeeded`/`failed` JSON output unchanged.
- Retry transient submission and status requests with a deterministic
  request key, so re-running an interrupted command resumes the same operation.
- Strictly validate operation progress, expiry, counts, and ordered terminal
  item receipts before printing an assignment result.

## 0.16.0 - 2026-08-21

- Add receipt image extraction plus read, preview-by-default attach, and remove
  commands for reviewed receipt items.
- Keep receipt images and extraction drafts transient; only reviewed JSON is
  sent to the confirmed evidence endpoint.
- Keep reviewed receipt rows simple: `id`, `label`, and a signed amount, with
  discounts represented as negative rows.
- Match notification-rule writes to the Agent API by sending only the optional
  email choice while keeping in-app delivery server-owned and always enabled.
- Accept computed renewal reminder dates and nullable rule timestamps in rule
  responses, and accept a null extracted date when a PDF contains no usable
  renewal date.
- Send contract PDFs with the required filename and content fields, and align
  the local 6 MB limit with the API's encoded-content limit.

## 0.15.0 - 2026-08-21

- Add `rules` commands to list, read, preview, apply, and delete notification
  rules anchored to existing transaction references.
- Add optional one-time PDF renewal-date extraction. Preview mode keeps the
  file local; apply mode sends it for extraction and the service discards it
  without storing the contract.
- Keep recurring predictions and transaction creation outside the Rules
  contract.
- Remove the legacy transaction `--account-id` filter and stop exposing
  internal account and connection locator fields in transaction responses.
  Use the opaque `accountRef` returned by `sloth-agent accounts`.

## 0.14.1 - 2026-08-21

- Make every parent help page list its nested commands, and give
  `line-items --help` its own group page instead of generic top-level usage.

## 0.14.0 - 2026-08-20

- Add `transactions --account-ref REF` using the opaque reference returned by
  `sloth-agent accounts`, while retaining `--account-id` for compatibility.
- Require every transaction result to include its matching `accountRef`.

## 0.13.0 - 2026-08-19

- Let `assign` share or unshare an owned booked personal transaction, update
  its ratio and exclusive amounts in pence, and combine sharing with category
  assignment in one atomic item.
- Add `transactions --shared[=true|false]` and strict validation for persisted
  sharing results, including the resulting joint-budget contribution.
- Keep preview local and credential-free while printing the exact payload that
  apply mode will send.

## 0.12.0 - 2026-08-16

- Add read-only `budget status` for current-period assigned, spent, and
  available category amounts, including refresh and unallocated-activity
  signals for safer automated budget review.

## 0.11.0 - 2026-08-16

- Add preview-by-default `budget move` for atomically moving current assigned
  money between categories or To Assign without changing planned budgets.
- Accept human-readable currency amounts at the CLI boundary, send integer
  pence to the Agent API, and validate the returned affected balances.

## 0.10.0 - 2026-08-15

- Require every goal create to specify a positive target amount and Keep or
  Spend type, matching the breaking Agent Goals API v1 contract.
- Expose `goalType` and nullable `spentAt`, allow active goal type changes, and
  remove obsolete `isAchieved` and target-amount clearing assumptions.
- Add preview-by-default `goals mark-spent` and `goals restore` actions that
  send the canonical `isSpent` lifecycle update only with `--apply`.

## 0.9.1 - 2026-08-15

- Clarify how personal and joint category assignments appear in transaction
  results and how assignment scope affects uncategorised filters.
- Document complete category and line-item assignments, including the
  category-specific `Other` fallback when no more specific line item fits.
- Extend command-help and clean-installed package checks for the categorisation
  workflow.

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
