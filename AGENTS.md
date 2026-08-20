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
- For work that adds, changes, or reviews a public command, option, help route,
  or CLI contract, use the canonical `agent-cli-design` skill before editing.
- When adding or changing a command or option, update its command-specific
  `-h`/`--help` in the same change. State required and optional inputs,
  accepted formats or ranges, defaults, output, and write/dry-run behaviour,
  then add a help-routing or packed-binary regression test. For a nested
  command, update both the top-level command index and its parent-group index,
  and cover the parent group in a parser or packed-binary regression test.
- For any externally visible command, option, output, authentication, or Agent
  API contract change, inventory the sibling `sloth-site` public documentation
  before release. Update applicable developer pages and review affected privacy
  pages, recording why no privacy copy change is needed when the data and
  telemetry contract is unchanged. Run the site's deploy-output checks and
  `public-site-readiness` audit, deploy the public documentation, and do not
  describe the CLI release as complete while those pages still document the
  previous contract.
- Run `npm run verify` before publishing.
- Inspect `npm pack --dry-run --json` and pass the clean-install package test.
- Publish only from a reviewed version tag through the trusted GitHub workflow
  after the initial package has established the npm trusted publisher.
