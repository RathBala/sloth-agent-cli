# Agent guidance

## Package contract

- `@slothmoney/agent-cli` exposes one executable: `sloth-agent`.
- Keep command results as JSON on stdout and diagnostics on stderr.
- Persist PATs only through the native OS credential store. Never write them to
  files, print them, or include them in errors, logs, argv, or fixtures.
- Keep `SLOTH_AGENT_TOKEN` as the highest-precedence credential source and do
  not load the native credential addon on environment-only paths.
- The production API origin is `https://budget.slothmoney.app`; allow HTTP only
  for localhost development.
- Do not add telemetry or automatic categorisation without explicit product and
  privacy review.

## Development workflow

- Use npm and commit `package-lock.json`.
- Use Red / Green / Refactor for functional changes.
- When adding or changing a command or option, update its command-specific
  `-h`/`--help` in the same change. State required and optional inputs,
  accepted formats or ranges, defaults, output, and write/dry-run behaviour,
  then add a help-routing or packed-binary regression test.
- Run `npm run verify` before publishing.
- Inspect `npm pack --dry-run --json` and pass the clean-install package test.
- Publish only from a reviewed version tag through the trusted GitHub workflow
  after the initial package has established the npm trusted publisher.
