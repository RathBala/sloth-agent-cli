# Changelog

## 0.3.0 - 2026-07-30

- Read and preview or apply the linked joint-budget shared-transaction setting.
- Filter transactions by personal or joint assignment scope.
- Categorise shared personal-account contributions against the joint catalogue
  with `assignmentScope: "joint"`.
- Validate the nested `jointBudgetContribution` response contract.

## 0.2.1 - 2026-07-25

- Explain that categories are parents and line items are scoped children.
- Document that line-item labels such as `Other` may repeat across categories.
- Add command-specific help for every command and auth subcommand, including
  required inputs, option constraints, output, examples, and write safety.

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
