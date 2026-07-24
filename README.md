# Sloth Agent CLI

Use your own agent to read and categorise transactions through the
[Sloth Money Agent API](https://slothmoney.app/developers/).

## Install

The CLI requires Node.js 22 or newer.

```bash
npm install --global @slothmoney/agent-cli
sloth-agent --version
```

For a one-off pinned run:

```bash
npm exec --yes --package=@slothmoney/agent-cli@0.2.0 -- sloth-agent --help
```

## Authenticate

Create a personal access token in Sloth Money under
**Settings > Developer access**, then save it in your operating system's
secure credential store:

```bash
sloth-agent auth login
```

The prompt hides the token. The CLI validates it before replacing any
credential already stored for the selected API origin.

For a non-interactive import, pass the token through stdin or import it from
the environment:

```bash
printf '%s' "$SLOTH_AGENT_TOKEN" | sloth-agent auth login --token-stdin
sloth-agent auth login --from-env
```

Never put a token in a command argument. For CI and headless systems, keep
using an environment secret:

```bash
export SLOTH_AGENT_TOKEN="sloth_pat_v1_..."
```

`SLOTH_AGENT_TOKEN` always overrides a stored credential.

To migrate from an existing environment-only setup:

```bash
sloth-agent auth login --from-env
unset SLOTH_AGENT_TOKEN
sloth-agent auth status
sloth-agent categories
```

Check the active credential with a live API request:

```bash
sloth-agent auth status
```

This updates the PAT's `lastUsedAt` value. To remove the local credential:

```bash
sloth-agent auth logout
```

Logout does not unset `SLOTH_AGENT_TOKEN` or revoke the PAT. Revoke a PAT
remotely in **Sloth Money Settings > Developer access**.

## Commands

Read categories and available budget line items:

```bash
sloth-agent categories
```

Read uncategorised transactions:

```bash
sloth-agent transactions --uncategorized --limit 50
```

Search a date range:

```bash
sloth-agent transactions \
  --q "tesco" \
  --start-date 2026-05-01 \
  --end-date 2026-05-31
```

Preview an assignment file without writing:

```bash
sloth-agent assign --input assignments.json
```

Apply the same file:

```bash
sloth-agent assign --input assignments.json --apply
```

Create a partner clarification link:

```bash
sloth-agent ask-partner --transaction-ref sloth_txn_...
```

Assignment files use the Agent API request shape:

```json
{
  "assignments": [
    {
      "transactionRef": "sloth_txn_...",
      "categoryId": "groceries",
      "lineItemId": "weekly"
    }
  ]
}
```

## Configuration and output

The CLI defaults to `https://budget.slothmoney.app`. For local development,
set `SLOTH_AGENT_API_BASE_URL=http://localhost:4000` or pass
`--base-url http://localhost:4000`. Non-local HTTP origins are rejected so a
token cannot be sent over an unencrypted connection.

Stored credentials are separated by normalized API origin. One credential is
stored per origin; log out and log in again to switch accounts on the same
origin.

Command results are JSON on stdout. Diagnostics are written to stderr.

| Exit code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | API, network, credential-store, response-validation, or partial assignment failure |
| `2` | Invalid command, option, URL, date, auth input, or assignment input |
| `3` | No credential or native secure storage is unavailable |

Assignment writes are best-effort. A response containing any failed assignment
returns exit code `1` while preserving the complete API response on stdout.

## Development

```bash
npm ci
npm run verify
```

`npm run test:package` packs the exact npm artifact, installs it into a clean
temporary project, and runs the installed binary.
