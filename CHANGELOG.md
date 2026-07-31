# Changelog

## Unreleased

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
