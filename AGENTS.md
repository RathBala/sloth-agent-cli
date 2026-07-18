# Agent guidance

## Package contract

- `@slothmoney/agent-cli` exposes one executable: `sloth-agent`.
- Keep command results as JSON on stdout and diagnostics on stderr.
- Never persist, print, or include `SLOTH_AGENT_TOKEN` in errors or fixtures.
- The production API origin is `https://budget.slothmoney.app`; allow HTTP only
  for localhost development.
- Do not add telemetry or automatic categorisation without explicit product and
  privacy review.

## Development workflow

- Use npm and commit `package-lock.json`.
- Use Red / Green / Refactor for functional changes.
- Run `npm run verify` before publishing.
- Inspect `npm pack --dry-run --json` and pass the clean-install package test.
- Publish only from a reviewed version tag through the trusted GitHub workflow
  after the initial package has established the npm trusted publisher.
