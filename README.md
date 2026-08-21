# Sloth Agent CLI

Use your own agent to inspect accounts, investments, and budgets, manage goals, move assigned budget money, update planned amounts, categorise transactions, and configure payment notifications through the
[Sloth Money Agent API](https://slothmoney.app/developers/).

## Install

The CLI requires Node.js 22 or newer.

```bash
npm install --global @slothmoney/agent-cli
sloth-agent --version
```

For a one-off pinned run:

```bash
npm exec --yes --package=@slothmoney/agent-cli@0.15.0 -- sloth-agent --help
```

## Authenticate

Create a personal access token in Sloth Money under
**Settings > Developer access**, then choose the authentication method for
where the CLI runs.

New tokens are view-only. That is enough for `auth status`, `accounts`, `investments`,
`budget`, `categories`, `transactions`, and `goals` list. Enable **Allow changes** when
creating the token only if the CLI must apply assignments, manage categories
or line items, move assigned budget money, update planned budgets, manage accounts, ask a partner for an explanation, or manage goals. Token
permissions cannot be changed later - revoke and reissue the token instead.

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

An assignment can change an owned transaction's sharing, categorisation, or
both.

Every command has built-in reference documentation covering its inputs,
options, output, and examples. For example:

```bash
sloth-agent auth login --help
sloth-agent accounts --help
sloth-agent budget --help
sloth-agent budget status --help
sloth-agent budget update --help
sloth-agent budget move --help
sloth-agent categories --help
sloth-agent categories create --help
sloth-agent line-items --help
sloth-agent line-items create --help
sloth-agent transactions --help
sloth-agent rules --help
sloth-agent assign --help
sloth-agent goals create --help
sloth-agent goals update --help
sloth-agent goals mark-spent --help
sloth-agent goals restore --help
sloth-agent ask-partner --help
```

### Add a transaction notification rule

Rules watch future payments that match an existing transaction. They can alert
you when the amount changes or before a renewal date. They do not create
transactions or recurring predictions.

First, run `sloth-agent transactions` and copy the exact `transactionRef` into
`rule.json` alongside this rule definition:

```json
{
  "amountChange": {
    "enabled": true,
    "comparison": "increase",
    "baselinePence": 3184
  },
  "renewalReminder": {
    "enabled": true,
    "renewalDate": "2027-07-30",
    "leadDays": 30
  },
  "delivery": {
    "inApp": true,
    "email": true
  }
}
```

Preview the write locally, then apply the same validated file:

```bash
sloth-agent rules set \
  --transaction-ref PASTE_THE_EXACT_TRANSACTION_REF_HERE \
  --input rule.json

sloth-agent rules set \
  --transaction-ref PASTE_THE_EXACT_TRANSACTION_REF_HERE \
  --input rule.json \
  --apply
```

To extract a renewal date first, scan a PDF no larger than 6 MB:

```bash
sloth-agent rules scan-contract --contract contract.pdf --apply
```

The PDF is discarded after extraction and is not stored. Scanning only returns
the date and confidence; use `rules set` to save the resulting reminder.

### How transaction categorisation is represented

Personal and joint category assignments are separate. A personal assignment
uses the transaction's top-level `categoryId`, `lineItemId`, and
`categorySplits`. A joint-budget assignment uses the corresponding fields under
`jointBudgetContribution`.

A transaction can have no personal category while its joint-budget contribution
already has a category and line item. To assess a transaction's categorisation,
inspect both locations. An included joint contribution with a category and line
item is already categorised for the joint budget. For example:

```json
{
  "categoryId": null,
  "lineItemId": null,
  "jointBudgetContribution": {
    "included": true,
    "categoryId": "groceries",
    "lineItemId": "joint-groceries"
  }
}
```

This transaction is uncategorised personally but categorised as Groceries for
the joint budget. The `--uncategorized` filter applies to the selected
assignment scope; the transaction's native scope is used when
`--assignment-scope` is omitted.

### Categorise a transaction end to end

1. Read categories and available budget line items:

```bash
sloth-agent categories
```

A category is the broader parent. A line item is a child within one category.
Line-item names such as `Other` may repeat, so preserve the full choice as
`(scope, categoryId, lineItemId)`. Use the personal or joint line-item map that
matches the transaction scope. For example, `Bills → Other` and `Subscriptions
→ Other` are different choices. Choose the most specific suitable line item;
if none fits, use that category's `Other` line item. Historical assignments
without a line item should not be treated as a recommendation to omit one.

2. Read uncategorised transactions:

```bash
sloth-agent transactions \
  --assignment-scope personal \
  --uncategorized \
  --limit 50
```

To read uncategorised joint-budget contributions instead:

```bash
sloth-agent transactions \
  --assignment-scope joint \
  --uncategorized \
  --limit 50
```

The remaining example continues with a personal assignment. For a joint
assignment, set `"assignmentScope": "joint"` in the assignment payload and use
`--assignment-scope joint` when checking the result.

3. Copy the exact `transactionRef`, `categoryId`, and `lineItemId` from the
   earlier outputs into `assignments.json`:

```json
{
  "assignments": [
    {
      "transactionRef": "PASTE_THE_EXACT_TRANSACTION_REF_HERE",
      "assignmentScope": "personal",
      "categoryId": "PASTE_A_CATEGORY_ID_HERE",
      "lineItemId": "PASTE_A_LINE_ITEM_ID_HERE"
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

This step requires a token created with **Allow changes**.

Inspect every item in the returned `succeeded` and `failed` arrays.

6. Check the result in the same assignment scope that you changed. Successful
   assignments update the category and optional budget line item on the
   original transaction. See the result in **Sloth Money → Transactions**, or
   re-run the original transaction query without `--uncategorized` and inspect
   both the personal and joint category fields:

```bash
sloth-agent transactions --assignment-scope personal --limit 50
```

The transaction should also disappear from the matching `--uncategorized`
query. Confirm that an existing assignment in the other scope was not changed.
Assignments do not create a separate list.

### Share and categorise a transaction

Find an owned, unshared booked transaction:

```bash
sloth-agent transactions --shared=false --q "sainsbury" --limit 20
```

Copy its exact `transactionRef` into `assignments.json`. This example shares
the transaction 60/40, keeps £5 for you personally, and categorises the shared
remainder as Groceries in Joint:

```json
{
  "assignments": [
    {
      "transactionRef": "PASTE_THE_EXACT_TRANSACTION_REF_HERE",
      "sharing": {
        "isShared": true,
        "shareRatio": 0.6,
        "userExclusiveAmountPence": 500,
        "partnerExclusiveAmountPence": 0
      },
      "assignmentScope": "joint",
      "categoryId": "groceries"
    }
  ]
}
```

Preview stays local and does not load credentials or call the API:

```bash
sloth-agent assign --input assignments.json
```

Apply with a token created using **Allow changes**, then read back the same
state shown in the Web App:

```bash
sloth-agent assign --input assignments.json --apply
sloth-agent transactions --shared=true --q "sainsbury" --limit 20
```

When `sharing` contains only `"isShared": true`, a first share uses the
couple's saved ratio, falling back to `0.5`, and shares the full amount. On an
already shared transaction, omitted split fields preserve their current values.
Set both exclusive pence fields to zero to share the full amount again.

To unshare, send `"sharing": { "isShared": false }` without ratio or exclusive
fields. Sloth clears the active split but keeps the Joint category dormant, so
sharing it again restores that category. Current-period Joint pay income is
reconciled; interest and completed periods keep their existing behaviour.

Sharing is available only for your booked personal-account transactions when
you have an active partner and Joint budget. Partner-owned rows and native
joint-account rows cannot be changed this way. Foreign-currency rows can still
be shared for settlement, but their returned contribution has `eligible: false`
and `included: false`.

If a combined item omits `assignmentScope`, the category uses Joint when you
have no exclusive amount and Personal when you do. Category-only items retain
their existing Personal/native default. Each item commits atomically, while a
bulk request remains best-effort across items.

### Other workflows

Read a personal or joint budget. Omit `--period` to use Sloth's current budget period:

```bash
sloth-agent budget --scope personal --period 2026-08
```

The result includes the budget period and status, currency, the effective plan,
stored funding amounts when available, categories, line items, and planned
amounts in pence.

Read current assigned, spent, and available money without aggregating
transactions yourself:

```bash
sloth-agent budget status --scope personal
```

The server applies its normal once-per-UTC-day automatic transaction refresh
policy before returning the current Sloth period dates and signed booked
activity. For each category, `availablePence` is
`assignedPence - spentPence`; a negative value is over budget, and refunds
reduce `spentPence`. Check `refresh`,
`activity.uncategorizedSpentPence`, and `activity.unmappedSpentPence` before
using the result to suggest a reallocation. This command is read-only.

Update selected line-item amounts by creating `budget.json`:

```json
{
  "allocations": [
    {
      "categoryId": "groceries",
      "lineItemId": "weekly",
      "plannedPence": 45000
    }
  ]
}
```

Preview locally, then apply the same file:

```bash
sloth-agent budget update \
  --scope personal \
  --period 2026-08 \
  --input budget.json

sloth-agent budget update \
  --scope personal \
  --period 2026-08 \
  --input budget.json \
  --apply
```

The update starts from the complete selected-period budget, changes the listed
line items, then overwrites the selected period and every explicit future plan
with that complete result. A later update from another period overwrites that
period and everything after it. Earlier and historical periods remain unchanged.

Without `--apply`, the CLI validates the file locally and does not load a token
or contact Sloth Money. Applying requires a write-enabled token.

Move current assigned money between two categories, or use the reserved
`to-assign` ID to move money to or from To Assign:

```bash
sloth-agent budget move \
  --scope personal \
  --from-category-id activities \
  --to-category-id groceries \
  --amount 52.95

sloth-agent budget move \
  --scope personal \
  --from-category-id activities \
  --to-category-id groceries \
  --amount 52.95 \
  --apply
```

Copy category IDs from `sloth-agent budget` output. `--amount` is expressed in
the budget currency and accepts up to two decimal places; the CLI converts the
decimal digits exactly and sends a positive safe-integer number of pence to the
API. Without `--apply`, the command validates and prints the exact request
without loading credentials or contacting Sloth Money.

Applying subtracts and adds the amount atomically, records the movement in the
budget history, and returns the affected assigned balances. It does not change
planned line-item amounts or future budget plans. Like the UI, it permits a
source category or To Assign to become negative; an automated workflow should
choose donors from its own available-balance policy. Historical periods cannot
be changed, and applying requires a write-enabled token.

Create or rename a custom category. Writes are previews until `--apply` is
present:

```bash
sloth-agent categories create \
  --name "Holidays" \
  --icon-key plane \
  --type Wants

sloth-agent categories create \
  --name "Holidays" \
  --icon-key plane \
  --type Wants \
  --apply

sloth-agent categories rename \
  --category-id category-id \
  --name "Travel fund" \
  --apply
```

Built-in categories cannot be renamed. A created category is available in the
next `sloth-agent categories` result without needing a budget allocation.

Create or rename a line item within a personal or joint budget:

```bash
sloth-agent line-items create \
  --scope personal \
  --category-id groceries \
  --name "Weekly shop" \
  --apply

sloth-agent line-items rename \
  --scope personal \
  --category-id groceries \
  --line-item-id line-item-id \
  --name "Essentials" \
  --apply
```

Line-item writes update the current period and explicit future plans.
Historical snapshots remain unchanged. New items start at zero and do not
change total allocation.

Filter transactions by a line-item ID. Pair it with `--category-id` when the
same ID may appear under different categories:

```bash
sloth-agent transactions \
  --assignment-scope personal \
  --category-id groceries \
  --line-item-id line-item-id
```

The category and line-item IDs must match the same primary assignment or split.

Read the existing Sloth account inventory:

```bash
sloth-agent accounts
```

The command is read-only and cache-only: it does not refresh linked banks or
change account data. Each result contains an opaque `accountRef`, personal or
joint ownership, connected or manual source, native balance/currency when
known, `lastBalanceUpdatedAt`, `connectionState`, and `isGoalSavingsSource`.
Missing values are JSON
`null`; currencies are never converted or combined. Partner personal accounts
are excluded, while enabled shared joint accounts follow Sloth's existing
visibility rules.

Use an account's opaque reference to read only its transactions. Transaction
rows return the same `accountRef`, so pagination and follow-up reads keep the
account boundary explicit:

```bash
sloth-agent transactions \
  --account-ref PASTE_THE_EXACT_ACCOUNT_REF_HERE \
  --limit 50
```

Copy the value from `sloth-agent accounts`. Account references are the public
account identifier for transaction filtering.

Account changes are previews unless `--apply` is present. Connected accounts
support only goal-savings membership. Manual current accounts support their
institution, name, currency, and ownership. Manual balance accounts also
support balance, Savings/Investments type, and goal-savings membership.
Partner-owned shared accounts return an explanatory error.

```bash
sloth-agent accounts update \
  --account-ref sloth_account_v1_... \
  --institution-name "Hargreaves Lansdown" \
  --account-name "Stocks & Shares ISA" \
  --currency GBP \
  --ownership individual \
  --balance-amount 12500.75 \
  --account-type investments \
  --goal-savings-source false

sloth-agent accounts update \
  --account-ref sloth_account_v1_... \
  --goal-savings-source false \
  --apply
```

Archive an owned manual account. The account disappears from active Sloth
surfaces, but its underlying records are retained. Repeating an applied removal
is safe and returns `changed: false`.

```bash
sloth-agent accounts remove --account-ref sloth_account_v1_...
sloth-agent accounts remove --account-ref sloth_account_v1_... --apply
```

Read linked investment accounts and their cached holdings:

```bash
sloth-agent investments
sloth-agent investments --account-ref sloth_account_v1_...
```

Investment reads are cache-only and do not refresh a brokerage. Holding
quantities, unit prices, market values, currencies, and freshness are returned
in provider-native terms. They are not converted or guaranteed to reconcile
to an account total reported in another currency. Caller-owned personal and
joint linked investment accounts are included; partner-owned accounts, manual
holdings, and investment activities are not.

List your goals:

```bash
sloth-agent goals
```

Goal writes are previews unless `--apply` is present:

```bash
sloth-agent goals create \
  --name "Emergency fund" \
  --target-amount 12000 \
  --type keep

sloth-agent goals create \
  --name "Wedding" \
  --target-amount 22000 \
  --target-month 2027-06 \
  --type spend \
  --apply
```

Every goal is either Keep or Spend. A Keep goal continues reserving its funded
money. A Spend goal reserves money until you explicitly mark it spent. Goal
list, create, and update output includes lowercase `goalType` and nullable
`spentAt`; `spentAt` is an ISO timestamp only after a Spend goal is marked
spent.

Use the `id` from list or create output to update a goal, change its type, or
move it in the priority order:

```bash
sloth-agent goals update \
  --goal-id goal-id \
  --target-month 2027-12 \
  --type spend \
  --apply

sloth-agent goals update \
  --goal-id house-goal-id \
  --priority 2 \
  --apply
```

Marking spent and restoring are also previews by default:

```bash
sloth-agent goals mark-spent --goal-id goal-id
sloth-agent goals mark-spent --goal-id goal-id --apply

sloth-agent goals restore --goal-id goal-id
sloth-agent goals restore --goal-id goal-id --apply

sloth-agent goals delete --goal-id goal-id --apply
```

Updates are partial. Use `--clear-target-month` to remove the optional month.
A Keep goal cannot be marked spent. A spent goal must be restored before its
type can change; the API returns these lifecycle conflicts without hiding the
required recovery action. Restoring clears `spentAt` and returns the goal to
allocation at its saved priority. Deleting a goal also removes its forecast
assignments and drift history.

Goal sharing remains app-managed. Change an active shared goal's pot-tracked
target amount in the Sloth Budget app, where account balances can be
reallocated across goals in priority order. Goal list output includes a
one-based `priority`; `1` is highest. Moving one goal automatically shifts the
goals between its old and new positions. The priority option must be used on
its own. Forecast assignments and shared pot progress are browser-owned
derived state and refresh when the owner next opens the Forecast screen.

Read uncategorised contributions to the joint budget:

```bash
sloth-agent transactions --assignment-scope joint --uncategorized
```

The first transaction read after the UTC day changes may refresh linked bank
data. The CLI waits up to 45 seconds for that refresh to persist, then returns
the requested booked transactions. If the refresh is still running, partially
fails, or fails globally, readable cached transactions are still returned with
a structured `refresh` object:

```json
{
  "refresh": {
    "status": "in_progress",
    "reason": "wait_timeout",
    "utcDate": "2026-07-31"
  }
}
```

Re-run the transaction query later to observe the completed refresh. A partial
account failure remains eligible for an automatic retry.

Set `"assignmentScope": "joint"` on an assignment to categorise the eligible
shared portion for the joint budget.

Transaction reads expose `personalBudgetAmountPence` for the caller's explicit
personal-only portion and `jointBudgetContribution.amountPence` for the full
shared portion. The 60/40 settlement ratio does not reduce joint-budget spend.

Shared personal-account transactions with a joint assignment are included in
the joint budget automatically. The settlement ratio remains independent from
the amount attributed to the joint budget.

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
| `2` | Invalid command, option, URL, date, auth input, goal input, or assignment input |
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

## Releasing

Releases are published only through the trusted `Publish npm release` GitHub
workflow from a reviewed `v*` tag whose version matches `package.json`. The
workflow runs the full verification suite before publishing.

After npm accepts the package, the workflow verifies the exact published
version with `npm run test:registry -- VERSION`. That script runs `npm exec`
from a fresh temporary directory with an isolated npm cache, so a checkout's
older local `sloth-agent` executable cannot satisfy the registry smoke test.
The temporary directory is removed after the check.
