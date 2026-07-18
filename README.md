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
npm exec --yes --package=@slothmoney/agent-cli@0.1.0 -- sloth-agent --help
```

## Authenticate

Create a personal access token in Sloth Money under
**Settings > Developer access**. Load it from your environment or secret
manager:

```bash
export SLOTH_AGENT_TOKEN="sloth_pat_v1_..."
```

Do not paste the token into prompts, chat, source control, shared logs, or
assignment files. The CLI reads the token from the environment, sends it only
as an HTTPS bearer token, and never stores it.

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

Command results are JSON on stdout. Diagnostics are written to stderr.

| Exit code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | API, network, response-validation, or partial assignment failure |
| `2` | Invalid command, option, URL, date, or assignment input |
| `3` | Missing required configuration |

Assignment writes are best-effort. A response containing any failed assignment
returns exit code `1` while preserving the complete API response on stdout.

## Development

```bash
npm ci
npm run verify
```

`npm run test:package` packs the exact npm artifact, installs it into a clean
temporary project, and runs the installed binary.
