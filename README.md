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
npm exec --yes --package=@slothmoney/agent-cli@0.3.0 -- sloth-agent --help
```

## Authenticate

Create a personal access token in Sloth Money under
**Settings > Developer access**, then choose the authentication method for
where the CLI runs.

### Local computer

On an interactive desktop, save the token in your operating system's secure
credential store:

```bash
sloth-agent auth login
```

The prompt hides the token. The CLI validates it before replacing any
credential already stored for the selected API origin.

### Containers, CI, and headless systems

Native credential storage may be unavailable in a container or other headless
environment. Inject `SLOTH_AGENT_TOKEN` at runtime through your platform's
secret manager:

```bash
export SLOTH_AGENT_TOKEN="sloth_pat_v1_..."
sloth-agent auth status
```

Keep using the environment variable for later commands. You do not need to run
`sloth-agent auth login` in this setup. Do not put the token in a command
argument, source file, or container image.

`SLOTH_AGENT_TOKEN` always overrides a stored credential.

### Import an existing environment token

To save an environment token in native credential storage on a local computer:

```bash
sloth-agent auth login --from-env
unset SLOTH_AGENT_TOKEN
```

You can also pass a token to the login command through stdin:

```bash
printf '%s' "$SLOTH_AGENT_TOKEN" | sloth-agent auth login --token-stdin
```

Both commands validate the token before replacing the stored credential.

Check the active credential and read your categories:

```bash
sloth-agent auth status
sloth-agent categories
```

This updates the PAT's `lastUsedAt` value. To remove the local credential:

```bash
sloth-agent auth logout
```

Logout does not unset `SLOTH_AGENT_TOKEN` or revoke the PAT. Revoke a PAT
remotely in **Sloth Money Settings > Developer access**.

## Commands

An assignment categorises an existing transaction e.g. assigning category
Groceries to a transaction.

Every command has built-in reference documentation covering its inputs,
options, output, and examples:

```bash
sloth-agent auth login --help
sloth-agent categories --help
sloth-agent transactions --help
sloth-agent assign --help
sloth-agent joint-budget-settings --help
sloth-agent ask-partner --help
```

### Categorise a transaction end to end

1. Read categories and available budget line items:

```bash
sloth-agent categories
```

A category is the broader parent. A line item is a child within one category.
Line-item names such as `Other` may repeat, so preserve the full choice as
`(scope, categoryId, lineItemId)`. Use the personal or joint line-item map that
matches the transaction scope. For example, `Bills → Other` and `Subscriptions
→ Other` are different choices.

2. Read uncategorised transactions:

```bash
sloth-agent transactions --uncategorized --limit 50
```

3. Copy the exact `transactionRef` for the transaction and a `categoryId` from
   the earlier outputs into `assignments.json`:

```json
{
  "assignments": [
    {
      "transactionRef": "PASTE_THE_EXACT_TRANSACTION_REF_HERE",
      "categoryId": "PASTE_A_CATEGORY_ID_HERE"
    }
  ]
}
```

These are placeholders. Do not submit the example values.

4. Preview the assignment without writing:

```bash
sloth-agent assign --input assignments.json
```

Without `--apply`, the CLI checks that the file is valid and returns the
payload it would send. It does not contact Sloth Money, verify the
`transactionRef` or category values, or write anything. A successful preview
does not guarantee that applying it will succeed.

5. Apply the same file:

```bash
sloth-agent assign --input assignments.json --apply
```

Inspect every item in the returned `succeeded` and `failed` arrays.

6. Check the result. Successful assignments update the category and optional
   budget line item on the original transaction. See the result in **Sloth
   Money → Transactions**, or re-run the original transaction query without
   `--uncategorized` and inspect its category fields:

```bash
sloth-agent transactions --limit 50
```

The transaction should also disappear from the matching `--uncategorized`
query. Assignments do not create a separate list.

### Other workflows

Read uncategorised contributions to the joint budget:

```bash
sloth-agent transactions --assignment-scope joint --uncategorized
```

Set `"assignmentScope": "joint"` on an assignment to categorise the eligible
shared portion for the joint budget.

Set whether the shared portions of personal-account transactions count in the
linked joint budget. The first command previews; the second applies:

```bash
sloth-agent joint-budget-settings \
  --include-shared-personal-transactions=true
sloth-agent joint-budget-settings \
  --include-shared-personal-transactions=true \
  --apply
```

Create a partner clarification link:

```bash
sloth-agent ask-partner \
  --transaction-ref PASTE_THE_EXACT_TRANSACTION_REF_HERE
```

The value shown is a placeholder. Copy the exact `transactionRef` from
`sloth-agent transactions` output.

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
