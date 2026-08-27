# Sloth Agent CLI competitor research

**Research date:** 27 August 2026

**Scope:** YNAB, Actual Budget, Finlynq, Lunch Money, and Plaid paired with the community `plaid-mcp` project.

**Method:** Product, price, authentication, API, CLI, MCP, and bank-sync claims below come from first-party product documentation or official source repositories. The supplied comparison image was used only to identify candidates, not as evidence.

## Corrections to the supplied image

- The product labelled **“Finly”** is almost certainly **[Finlynq](https://finlynq.com/about)**. Its official repository and site describe the distinctive combination shown in the image: a native MCP server, REST API, and local stdio transport. The image’s “studio” is likely a typo for **stdio**.
- Finlynq does **not** currently provide direct UK bank connections. Its only live-feed connector is SimpleFIN, whose official institution search says it supports the US and Canada, including only the US or Canadian versions of international banks. See [Finlynq’s connector documentation](https://github.com/finlynq/finlynq/blob/main/docs/import-connectors.md) and [SimpleFIN’s institution coverage](https://beta-bridge.simplefin.org/search-institutions).
- Actual Budget’s API is an official Node.js package that runs a headless local client; it is **not** a conventional hosted REST API. See [Actual’s API overview](https://actualbudget.org/docs/api/).
- Lunch Money has an official REST API and JavaScript SDK, but the MCP implementations it lists are community projects, not first-party MCP servers. See [Lunch Money’s developer page](https://lunchmoney.app/developers) and [AI/MCP guide](https://lunchmoney.dev/using-with-ai).
- Plaid now has an experimental official CLI. The “MCP + CLI + SQL” combination in the image still appears to refer to the community [yuechen/plaid-mcp](https://github.com/yuechen/plaid-mcp) project, whose distinguishing feature is read-only SQL over a local SQLite cache.

## Sloth baseline

[Sloth's developer guide](https://slothmoney.app/developers/) documents a first-party JSON CLI and versioned REST Agent API. Version 0.19.0 covers authentication, accounts, cached investment holdings, personal and joint budgets, budget status and money moves, categories and line items, transaction reads and batch assignment, goals, payment-change and renewal rules, receipt evidence, contract scanning, and partner clarification links. It does not currently publish a first-party MCP server, OpenAPI description, or official language SDK.

Authentication is one of Sloth's strongest current contracts. Personal access tokens expire after 7, 30, or 90 days, start view-only, and gain write authority only when the user explicitly chooses it. The CLI stores a token in the native operating-system credential store; `SLOTH_AGENT_TOKEN` can provide a non-persisted token and takes precedence. Most writes are previews until `--apply`, and batch transaction assignments are durable, idempotent operations with retry/resume support and seven-day receipts. The principal missing authentication capability is delegated remote-agent access: there is no OAuth flow, Dynamic Client Registration, or MCP-native consent screen comparable with Finlynq.

Sloth is currently in a [free beta](https://slothmoney.app/) with no card required, and the site promises beta users £0 access forever, including the app and Agent API. That is unusually attractive for current adopters. The unresolved pricing gap is that no post-beta price is published for future users, so a durable acquisition-cost comparison cannot yet be made.

[Sloth's privacy notice](https://slothmoney.app/privacy/) identifies GoCardless Bank Account Data for open-banking connections and SnapTrade for linked investments. This makes Sloth a managed UK-oriented consumer product rather than a toolkit that asks the user to obtain provider credentials, host a server, or complete Plaid production onboarding. The CLI can request transaction refresh at most once per day and reads provider-cached investment holdings; it does not expose investment activity, brokerage refresh control, or bank-link setup.

## Direct comparison with Sloth

| Area | Sloth today | Stronger alternative in this set | Result |
|---|---|---|---|
| Safe local-agent authentication | Expiring view-only-by-default PATs, optional fixed write scope, native credential storage, environment override | Finlynq has similarly explicit read/write scopes; others generally use broader PATs, server credentials, or developer secrets | Sloth advantage over YNAB, Actual, Lunch Money, and community `plaid-mcp`; Finlynq is the closest peer |
| Delegated remote-agent authentication | PAT only | Finlynq has OAuth 2.1, Dynamic Client Registration, consent, and read/write MCP scopes; YNAB supports OAuth for third-party apps | Material Sloth gap |
| First-party agent interface | JSON CLI + versioned REST API | Finlynq has native HTTP and stdio MCP plus REST; Actual has a broader JSON CLI | Material discoverability/integration gap: no native MCP, OpenAPI, or official SDK |
| Write safety | Local preview followed by explicit `--apply`; durable and idempotent batch assignments | Finlynq also uses preview and signed confirmation tokens; `plaid-mcp` is hard read-only | Sloth strength, although not unique versus Finlynq |
| UK bank connectivity | Managed GoCardless connection in the consumer app | YNAB also provides turnkey UK Direct Import; Plaid has raw UK institution reach but requires a business integration | Sloth advantage over Actual, Finlynq, Lunch Money, and self-assembled Plaid; roughly peer territory with YNAB |
| Transaction and ledger operations | Read and filter booked transactions; atomically assign sharing and personal/joint categories | Actual, Finlynq, Lunch Money, and YNAB expose broader transaction creation/editing/deletion; Actual and Finlynq add imports, reconciliation, schedules, rules, and queries | Largest functional Sloth gap |
| Reporting and open-ended analysis | Current/historical budget status plus agent-readable JSON | Actual has ActualQL and reports; Finlynq has cash-flow, health, anomaly, FIRE, and portfolio tools; Lunch Money has mature analytics; `plaid-mcp` offers local SQL | Material Sloth gap |
| Whole-finance coverage | Budgeting, goals, connected accounts, and cached holdings | Finlynq and Plaid cover liabilities and investment activity; Finlynq and Lunch Money add net worth and multi-currency; YNAB adds loan planning | Material Sloth gap in liabilities, net worth, FX, and portfolio activity/performance |
| Local control and portability | Hosted service; no self-hosted or local-first Agent API, and no full-data export command in the CLI | Actual is local-first and self-hostable; Finlynq is self-hostable; `plaid-mcp` keeps a local analytical cache | Gap for privacy- or control-led users, but not necessarily aligned with Sloth's managed-service position |
| Current consumer price | £0 forever for beta users; future-user price unpublished | Actual and Finlynq software are free but can incur hosting or feed costs; YNAB and Lunch Money charge subscriptions; Plaid production is commercial infrastructure | Strong current-user advantage; post-beta price uncertainty is a sales gap |

## What Sloth has that the others do not

These are distinctive combinations within the compared set, not claims that no product anywhere offers an individual ingredient.

1. **A real personal-versus-joint money model.** Sloth keeps personal and joint category assignments separate, can split a shared transaction by ratio and exclusive personal amounts, and preserves settlement separately from joint-budget spend. The shared goal can be visible while the owner's private funding account remains hidden. YNAB and Lunch Money support collaborators, and Actual supports shared budgets, but their published contracts do not describe this combination of household allocation, partner privacy, and settlement semantics.
2. **Atomic sharing and categorisation.** One reviewed assignment can set both who owes what and where the transaction belongs, instead of making an agent coordinate loosely related edits across a generic ledger.
3. **Partner clarification as a product action.** `ask-partner` creates a time-limited link for the person who knows the transaction to supply context. None of the compared agent surfaces documents an equivalent human-in-the-loop handoff.
4. **Reviewed receipt evidence rather than raw receipt storage.** Sloth extracts a transient draft from an image, saves only confirmed structured line-item evidence, uses revisions to prevent stale overwrites, and does not silently change the transaction's category or budget.
5. **Contract-aware payment monitoring.** An agent can scan a contract PDF transiently, then configure amount-change or renewal-date notifications. Competitors offer recurring-item and subscription tracking, but not this same privacy-conscious contract-to-rule workflow in their documented agent surfaces.
6. **A goal roadmap tied to real funding accounts.** Goals combine Keep/Spend behaviour, priority, an explicit personal funding account, previewed scenarios, and a computed forecast month. That is more operational than a generic target value.
7. **Managed UK bank data plus linked investments at the current price.** Actual and Finlynq ask the user to host or configure provider infrastructure, Lunch Money needs a UK workaround, and Plaid requires a developer/business integration. Sloth packages the consumer workflow and Agent API together for current beta users at £0.

## Sloth's most important gaps

1. **Native MCP and delegated OAuth.** This is the clearest agent-platform gap. A first-party remote MCP server with OAuth 2.1, Dynamic Client Registration, read/write scopes, and the existing preview/apply semantics would remove wrapper work without weakening Sloth's safety model. An OpenAPI contract or official TypeScript SDK would make the REST path easier in parallel.
2. **Broader ledger control.** The CLI cannot create, edit, delete, or import transactions; manage payees or tags; reconcile accounts; define general categorisation rules; or manage scheduled/recurring transactions. Actual and Finlynq set the high bar, while YNAB and Lunch Money expose much of this through their APIs.
3. **Liabilities, net worth, and multi-currency.** Sloth has cached holdings, but not debt accounts and payoff plans, investment activities/cost basis/returns, whole-household net worth, or a multi-currency/FX analytical layer. Finlynq is the breadth benchmark; Plaid is the raw-data benchmark.
4. **Queries, reports, and forecasts.** Budget status is useful but narrower than ActualQL, `plaid-mcp` SQL, Lunch Money analytics, or Finlynq's cash-flow and scenario tools. A privacy-safe read-only query/report layer could add considerable agent value without expanding write risk.
5. **Recurring cash-flow intelligence.** Sloth can monitor changes and renewal dates, but it does not provide a general bills/subscriptions calendar, projected balance, or debt-payoff plan. This is the functional bridge between its existing rules and goals.
6. **Portability and a published future price.** A full-data export would answer more of the trust concern than self-hosting alone. Separately, publishing the intended post-beta price and Agent API entitlement would make comparison easier for new prospects; the lifetime-free beta promise only resolves the question for beta users.

### Suggested sequence

The narrowest high-value sequence is: first ship native MCP plus delegated OAuth over the existing typed Agent API; next add a read-only whole-finance layer for liabilities, net worth, recurring commitments, and query/reporting; then expand transaction CRUD/import/reconciliation only where Sloth can preserve preview, idempotency, and household semantics. Self-hosting and an exhaustive general-purpose finance engine are lower-priority responses unless user demand shows that Sloth should compete on infrastructure control or breadth rather than its current managed couples-finance position.

## At a glance

| Solution | Agent access | Authentication | Consumer-relevant price | UK bank sync | Main distinction | Material limitation |
|---|---|---|---|---|---|---|
| YNAB | Official REST API; community MCPs; no official CLI | Non-expiring personal access token, or OAuth for third-party apps | $109/year or $14.99/month; 34-day trial | Native Direct Import is available for selected UK banks | Mature category-first budgeting product, polished apps, goals, loans, and household sharing | Agent path depends on a community wrapper; API has a 200 requests/hour/token limit and does not expose bank-link control |
| Actual Budget | Official CLI and Node API; community MCPs | Server password or session token; optional OpenID/OAuth2; optional budget E2E encryption | No licence fee; self-hosting/provider costs remain | Possible through Enable Banking, but experimental; legacy GoCardless is closed to new accounts | Local-first, open source, self-hostable, powerful JSON CLI, ActualQL, rules, reports, and imports | Operational setup burden; no REST or first-party MCP; bank sync is manual/on-demand and provider secrets are outside budget E2E encryption |
| Finlynq | First-party MCP over HTTP and stdio; REST API | OAuth 2.1 with read/write scopes for HTTP MCP; bearer API keys for scripts; local binding for stdio | App and managed cloud are free; proprietary hosting/embedding requires an undisclosed commercial licence; SimpleFIN costs extra | No native UK connection | Broadest first-party agent surface here, with scoped OAuth, explicit confirmation for risky writes, self-hosting, investments, loans, goals, FIRE, and multi-currency | SimpleFIN-only live feeds, no UK coverage or brokerage sync, no background feed schedule, and stdio cannot perform every encrypted-name operation |
| Lunch Money | Official REST API and JS SDK; community MCPs; no official CLI | Revocable bearer token per budget, without separate read/write scopes | $10/month; annual pay-what-you-want with a $60 minimum; 30-day trial | No native UK feed; paid third-party connectors are offered | Polished multi-currency finance product with rules, analytics, crypto, net worth, recurring items, and collaborators | Community-dependent MCP/CLI experience; API writes are permanent; UK connection requires another vendor and fee |
| Plaid + `plaid-mcp` | Experimental official Plaid CLI; community production-data MCP with local SQL; official sandbox MCP for coding/testing | Plaid developer credentials plus per-bank Item access tokens; local MCP has no remote user OAuth | Sandbox is free; production pricing is product-specific and generally quote/dashboard based | Plaid covers many UK institutions, but production access requires business/compliance onboarding | Deep raw bank, investment, and liability data; local agent-safe SQL analytics | Infrastructure rather than a budgeting product; no budgets, targets, allocation workflow, consumer UI, or household collaboration; access and compliance overhead is substantial |

## Capability matrix

“First-party” means shipped and supported by the product owner, rather than merely listed or linked by it.

| Capability | YNAB | Actual Budget | Finlynq | Lunch Money | Plaid + `plaid-mcp` |
|---|---:|---:|---:|---:|---:|
| First-party CLI | No | Yes | No general-purpose CLI; first-party stdio MCP | No | Yes, experimental Plaid CLI; `plaid-mcp` also has a community CLI |
| First-party programmable API | REST | Node package/local client | REST | REST + JS SDK | Plaid REST APIs |
| First-party production-data MCP | No | No | Yes | No | No; Plaid’s official MCP is sandbox/developer tooling |
| Supported writes through agent surface | Yes through API/community wrappers | Yes | Yes, with scoped grants and confirmations | Yes | No financial writes in `plaid-mcp`; connection management only |
| Native/easy UK consumer bank sync | Yes, selected institutions | No; experimental/awkward | No | No | Institution coverage exists, but not consumer-ready onboarding |
| Self-hostable | No | Yes | Yes | No | Community MCP/cache only; Plaid remains hosted infrastructure |
| Multi-currency finance view | Limited: one currency per plan | Limited/manual | Yes | Yes | Raw currency fields, not a finance-planning layer |
| Investment/portfolio modelling | No | No | Yes | Crypto tracking, not a full portfolio engine | Raw investment holdings and transactions |
| Shared household budget | Up to six people on one subscription | Shared budgets/multi-user server | No clear household-sharing model | Unlimited collaborators per budget | Not a budgeting product |

## YNAB

### Agent surface and authentication

[YNAB’s official API](https://api.ynab.com/) is a JSON REST API. An individual can create a revocable, non-expiring personal access token in developer settings. A third-party application can instead use OAuth; authorization-code grants support refresh tokens, and OAuth applications can request a read-only scope. Before review, a third-party OAuth client is restricted to 25 users other than its owner. The documented limit is 200 requests per hour per access token.

YNAB does not publish an official CLI or MCP server. Its official “Works with YNAB” directory links to a third-party local MCP server, and several other community wrappers exist. Consequently, MCP authentication, write restrictions, confirmation behaviour, and maintenance quality depend on the selected wrapper rather than a YNAB-owned contract.

The API now supports more writes than older comparisons imply, including transactions, scheduled transactions, accounts, categories, category groups, payees, and goals/targets. It does not expose YNAB’s bank-link setup or Direct Import control, so an agent cannot establish or repair a bank connection through the API.

### Price, bank sync, and product features

[YNAB pricing](https://www.ynab.com/pricing) is $109 USD per year or $14.99 per month, plus applicable tax, after a 34-day trial. One subscription can be shared with up to six people. The same page confirms Direct Import for selected institutions in the US, Canada, UK, and EU.

Its advantage is the mature human product around zero-based/category-first budgeting: browser and mobile applications, category targets, scheduled and imported transactions, loan/debt planning, household sharing, reports, and extensive budgeting education. The main comparison limits are price, a single currency per spending plan, reliance on community MCP software, a broad non-expiring PAT for personal automation, the API rate cap, and no agent control over bank connectivity.

## Actual Budget

### Agent surface and authentication

Actual has the strongest conventional CLI of the incumbent budgeting apps. The official [`@actual-app/cli`](https://actualbudget.org/docs/api/cli/) returns JSON by default and supports accounts, budgets, categories, transactions, payees, rules, schedules, bank-sync triggering, and ActualQL queries. It connects using a server URL, sync ID, and server password or session token. The documentation allows credentials in flags, environment variables, or config, while warning that config files store them as plain text.

The official [`@actual-app/api`](https://actualbudget.org/docs/api/) is a Node.js package that launches a headless Actual client and downloads a local copy of a budget. It is not a hosted REST endpoint, and Node is the only officially supported language. MCP servers such as [type0labs-dev/actual-mcp](https://github.com/type0labs-dev/actual-mcp) are community wrappers around that API.

Actual Server can use its default password authentication or optional [OpenID/OAuth2 authentication](https://actualbudget.org/docs/config/oauth-auth/). It also supports [multi-user access and budget sharing](https://actualbudget.org/docs/config/multi-user/) and optional end-to-end encryption for synced budget data. Actual’s [sync documentation](https://actualbudget.org/docs/getting-started/sync/) makes an important boundary clear: bank-sync credentials must remain usable by the server and are not protected by the budget’s end-to-end encryption.

### Price, bank sync, and product features

Actual is [MIT-licensed](https://github.com/actualbudget/actual/blob/master/LICENSE.txt), so the application itself has no subscription fee. A user still bears the cost and effort of running a server or paying a host, plus any bank-data provider charge.

[Bank sync](https://actualbudget.org/docs/advanced/bank-sync/) requires Actual Server and the user’s own provider credentials. It is manual/on-demand rather than an automatic background process, although the CLI or API can trigger it. For Europe, [Enable Banking](https://actualbudget.org/docs/advanced/bank-sync/enable-banking/) is experimental and its setup documentation calls for a nightly build. The former GoCardless path is not viable for new users because [new bank-account connections have been unavailable since July 2025](https://actualbudget.org/docs/advanced/bank-sync/gocardless/). Other supported providers target North America, Brazil, and New Zealand; [SimpleFIN](https://actualbudget.org/docs/advanced/bank-sync/simplefin/) costs $1.50/month or $15/year.

Actual’s product strengths are local-first/offline operation, envelope or tracking budgets, custom dashboards and [reports](https://actualbudget.org/docs/reports/), rules, recurring [schedules](https://actualbudget.org/docs/schedules/), file import, multi-user budgets, and full self-hosting. Its trade-offs are setup and maintenance work, no first-party REST or MCP endpoint, awkward UK bank connectivity, manual sync, and weaker turnkey mobile/SaaS convenience than YNAB or Lunch Money.

## Finlynq

### Agent surface and authentication

Finlynq is unusually agent-first. Its first-party [MCP guide and tool catalogue](https://finlynq.com/mcp-guide/tools) describe both remote HTTP and local stdio transports. At the research date, the catalogue lists 54 HTTP tools and 89 stdio tools across accounts, transactions, budgets, goals, loans, subscriptions, rules, exchange rates, net worth, cash flow, anomaly detection, reconciliation, imports, and investments.

Remote MCP uses OAuth 2.1 with Dynamic Client Registration and separate `mcp:read` and `mcp:write` scopes. Scripts can use revocable `pf_*` bearer API keys against the REST API. Riskier operations use a preview → signed confirmation token → execute sequence rather than treating possession of a token as blanket approval.

Finlynq’s [privacy design](https://finlynq.com/privacy) uses password-derived key wrapping and per-user encryption keys for sensitive data. That creates one practical transport difference: local stdio lacks the user’s in-session decryption key and therefore cannot reliably create or update every entity that has encrypted names. HTTP MCP is the complete remote-agent path.

### Price, bank sync, and product features

The app, managed cloud, and self-hosted deployment are presented as free and donation-funded in the [official repository](https://github.com/finlynq/finlynq) and [about page](https://finlynq.com/about). The code is AGPLv3; proprietary hosting or embedding requires a commercial licence whose price is not published. Live bank feeds use SimpleFIN, currently [$1.50/month or $15/year plus tax](https://beta-bridge.simplefin.org/).

Finlynq’s [connector documentation](https://github.com/finlynq/finlynq/blob/main/docs/import-connectors.md) says SimpleFIN is the only live-feed connector. Sync is on demand and login-triggered sync is throttled to roughly 12 hours; there is no unattended scheduled feed. SimpleFIN itself is US/Canada focused, recommends no more than 24 requests per day, and limits each request to a 90-day range; see its [developer documentation](https://beta-bridge.simplefin.org/info/developers). Finlynq therefore has no native UK bank sync, and its feed does not sync brokerage accounts.

Its functional breadth is the differentiator: budgets and rollover, rules and suggestions, transaction splits and transfers, goals, amortised loans and debt strategies, subscriptions, health/cash-flow/anomaly analysis, multi-currency FX, staged imports and reconciliation, plus portfolio lots, realised gains, dividends, XIRR, benchmarks, rebalancing, Canadian registered accounts, and FIRE/Monte Carlo tooling. It is open source, self-hostable, exports user data, and ships mobile clients. Against that breadth, it is a young single-user product with no clear household collaboration model, no UK feed, no brokerage feed, a paid external data connector, no background bank-sync schedule, and some stdio/HTTP feature asymmetry.

Some older Finlynq FAQ/getting-started pages still describe bank feeds as future work. The connector implementation, current site, and release documentation show that SimpleFIN has since shipped; the newer connector documentation is the evidence used here.

## Lunch Money

### Agent surface and authentication

Lunch Money has an official [OpenAPI-first REST API and JavaScript SDK](https://lunchmoney.app/developers). Version 2 supports reads and writes across accounts, transactions, categories, tags, recurring items, budgets, crypto, Plaid accounts, and user metadata. A user creates a revocable bearer access token for one budgeting account in the Developers settings; the token does not offer separate read/write scopes. The API’s [rate limit](https://lunchmoney.dev/rate-limits) is 100 requests per minute per IP address.

Lunch Money’s own [AI integration guide](https://lunchmoney.dev/using-with-ai) says MCP servers are community-built. The developer page lists several of them, but Lunch Money does not ship a first-party CLI or production MCP server. API write and delete operations are permanent, so safe preview and confirmation behaviour must be implemented by the consuming agent or wrapper.

### Price, bank sync, and product features

[Lunch Money pricing](https://lunchmoney.app/pricing) is $10/month or a user-selected annual amount after a 30-day trial. Its official [2026 annual-plan notice](https://lunchmoney.app/blog/an-update-to-our-annual-plan-minimum-effective-march-15-2026) sets the annual minimum at $60 from 15 March 2026; the pricing control currently displays $100 as a suggested/default amount. All product features are included.

Native [automatic imports](https://support.lunchmoney.app/guides/automatic-imports) use Plaid for most US and Canadian institutions and a number of EU banks. Lunch Money does not claim native UK coverage. Its [import page](https://lunchmoney.app/features/import-transactions/) instead points UK and EU users to paid third-party services Lunch Flow or Synci, alongside CSV, PDF, manual, and API import.

The product covers multi-currency personal finance, category and tag budgets, recurring items, a calendar, rules, analytics and trends, net worth, crypto, and web/mobile clients. One administrator pays for a budget and can invite [unlimited collaborators](https://support.lunchmoney.app/settings/collaborators) with separate logins. Its [security documentation](https://lunchmoney.app/features/security) describes read-only bank aggregation, two-factor authentication, and AES-256 encryption. Its comparison weaknesses are no native UK feed, another paid vendor for UK automation, no first-party CLI/MCP, broad bearer-token authority, and irreversible API mutations.

## Plaid plus `plaid-mcp`

### What is first-party and what is community software

[Plaid’s experimental official CLI](https://plaid.com/docs/resources/cli/) can access Balance, Transactions, Investments, and Liabilities, produce JSON, and launch Link. It authenticates a developer through a browser-based Plaid Dashboard flow with automatically refreshed tokens, or through environment-supplied API credentials.

The production-data MCP in the supplied comparison is the community [yuechen/plaid-mcp](https://github.com/yuechen/plaid-mcp) project, not an official Plaid product. It ingests Plaid data into local SQLite and gives an agent one read-only SQL query tool over curated views. The database is opened read-only, queries have a five-second timeout and 1,000-row result limit, and the project supports accounts, balances, transactions, investments, and liabilities. It intentionally excludes Plaid Auth, Identity, and money movement. Connection-management commands can link, relink, unlink, sync, inspect status, or run a polling daemon.

Plaid also publishes an [official sandbox MCP server](https://github.com/plaid/ai-coding-toolkit/tree/main/sandbox), but it is coding/test tooling for documentation, mock data, and Sandbox APIs—not a personal-finance server for production bank data.

### Authentication, price, bank reach, and limitations

Production Plaid API calls require a developer `client_id`, an environment-specific secret, and a per-Item access token created through Link; see Plaid’s [quickstart glossary](https://plaid.com/docs/quickstart/glossary/). The community MCP encrypts access tokens locally with Fernet and stores its key with owner-only filesystem permissions, but its local stdio server has no remote per-user OAuth layer. The developer owns the local credential and database lifecycle.

Plaid Sandbox is free. Production charges vary by product: one-time, subscription, or per-request models. Plaid’s [official pricing explanation](https://support.plaid.com/hc/en-us/articles/16194632655895-How-much-does-Plaid-cost-and-what-are-the-pricing-models) does not publish a simple consumer subscription price; exact prices are shown through the Dashboard or sales process. Its free Trial tier is a developer evaluation path with a small number of Production Items, not a dependable UK consumer-bank product.

Plaid’s [European institution documentation](https://plaid.com/docs/institutions/europe/) shows broad UK and European bank coverage. Coverage alone does not make this a turnkey consumer route: the [launch checklist](https://plaid.com/docs/launch-checklist/) requires production approval and, for UK/EU access, a separate compliance process; some OAuth institutions require additional profiles and security review.

The combined stack’s strength is deep, queryable raw data—bank balances and transactions, investment holdings and trades, and card/student-loan/mortgage liabilities—kept in a local cache that an agent can analyse safely with read-only SQL. It is nevertheless infrastructure, not a budgeting product: it supplies no budget allocation, targets, category-planning workflow, reconciliation/review experience, user application, or household collaboration. It also adds business onboarding, product-specific charges, local secret/database operations, and reliance on a community MCP maintainer.

## Cross-competitor conclusions

The supplied ranking obscures the more useful product distinctions:

1. **Authentication quality:** Finlynq sets the strongest agent-specific benchmark with OAuth read/write scopes and confirmation tokens. Sloth should be compared separately on credential storage, revocation, scope, unattended use, and whether risky writes require explicit approval.
2. **Agent surface:** Actual owns the best traditional JSON CLI; Finlynq owns the broadest first-party MCP/REST combination. YNAB and Lunch Money have good official APIs but delegate MCP/CLI ergonomics and safety to community software.
3. **UK connectivity:** YNAB is the only turnkey consumer budgeting product in this set that clearly advertises native UK Direct Import. Plaid has institution reach but requires a developer/business/compliance integration. Actual, Finlynq, and Lunch Money have material UK limitations or third-party workarounds.
4. **Budgeting depth versus finance breadth:** YNAB and Actual are strongest in budgeting method and planning. Lunch Money broadens into multi-currency, crypto, net worth, and analytics. Finlynq is broader still across investing, debt, FIRE, goals, anomaly detection, and imports. Plaid provides raw data rather than product workflow.
5. **Deployment and trust model:** Actual and Finlynq can be self-hosted. Actual favours a local-first replicated client; Finlynq exposes a remote agent service with field encryption. The SaaS products reduce setup burden but require users to trust hosted storage and their chosen community agent bridge.
6. **Write safety:** A REST endpoint that accepts writes is not equivalent to an agent-safe workflow. Finlynq’s explicit previews/confirmation tokens and `plaid-mcp`’s hard read-only query boundary are meaningful controls; YNAB, Actual, and Lunch Money rely more heavily on the client or wrapper to constrain and confirm actions.

## Evidence boundaries

- Community MCP project counts change quickly and are not treated as a durable competitive advantage. The durable distinction is whether the product owner publishes and supports the interface and authentication contract.
- “UK coverage” is separated from “easy UK consumer bank sync.” An institution may be present in a data provider’s directory while production approval, regulated access, company eligibility, pricing, or a paid intermediary still blocks a consumer workflow.
- Prices are stated in the currencies and billing models shown by each provider as of the research date; tax, hosting, data-provider, and commercial-licence costs may be additional.
- Finlynq is identified from the unique MCP/REST/stdio signature. No official source connecting the name “Finly” or “FinlyHQ” to the screenshot was found.
