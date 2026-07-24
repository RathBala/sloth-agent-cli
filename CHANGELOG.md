# Changelog

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
