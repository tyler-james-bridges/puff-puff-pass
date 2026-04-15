# Puff Puff Pass API (x402)

Technical starter for the 4/20 virtual joint project.

## What is included

- Express API with x402-protected paid pass route
- Postgres-backed persistence layer (`leaderboard_stats`, `passes`, `holder_state`)
- Built-in local Postgres-compatible fallback via PGlite (file-backed)
- Functional dark-mode frontend (`/`) for current holder, pass form, feed, and leaderboard
- OpenAPI document + `.well-known/x402`
- Unit tests for ranking, culture lines, badges, and store behavior
- Buyer E2E paid-pass script + one-command verification flow

## Current status

`POST /api/joint/pass` is protected by `@x402/express` middleware.

- Missing or invalid payment returns `402 Payment Required`
- Valid payment is verified via configured facilitator and then persisted

## Run

```bash
cd puff-puff-pass
npm install
npm start
```

Server defaults to `http://localhost:4020`.

## Storage configuration

### Option A: External Postgres

Set `DATABASE_URL` and the app uses `pg`.

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/puff_puff_pass
```

### Option B: Local embedded Postgres-compatible storage (default)

If `DATABASE_URL` is not set, app uses PGlite and persists to `./.data/pglite`.

Optional override:

```bash
PGLITE_DATA_DIR=./.data/pglite
```

Schema is auto-applied from `db/schema.sql` at startup.

## Required env vars for real payment settlement

```bash
PAY_TO=0xYourReceivingAddress
X402_NETWORKS=eip155:8453,eip155:2741
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
FACILITATOR_URL_ABSTRACT=https://facilitator.x402.abs.xyz
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
```

For local/testnet quickstart you can use:

```bash
X402_NETWORKS=eip155:84532
FACILITATOR_URL=https://x402.org/facilitator
PAY_TO=0xYourBaseSepoliaAddress
```

## Tests

Run unit tests:

```bash
npm test
```

## Buyer E2E payment test (real x402)

```bash
EVM_PRIVATE_KEY=0x... \
BUYER_API_URL=http://localhost:4020/api/joint/pass \
BUYER_HANDLE=tmoney_145 \
BUYER_X402_NETWORK=eip155:* \
npm run test:e2e:buyer
```

Notes:

- Wallet must be funded for the selected network/token.
- Server must be running with valid facilitator and `PAY_TO` config.
- For stable verification, keep `PAY_TO` different from the buyer wallet derived from `EVM_PRIVATE_KEY`.

## One-command verification (starts server, runs paid pass, asserts leaderboard changes)

```bash
npm run verify:paid-pass
```

This command:

1. Starts the API server
2. Reads leaderboard
3. Runs the real buyer paid-pass script
4. Verifies buyer pass count increased on leaderboard
5. Stops server

If you intentionally need self-pay during experiments, set `ALLOW_SELF_PAY=1`.

## API routes

- `GET /api/joint/current`
- `GET /api/feed?limit=50`
- `GET /api/leaderboard`
- `GET /api/handles/:handle`
- `GET /api/health`
- `POST /api/joint/pass` (x402 challenge)
- `GET /.well-known/x402`
- `GET /openapi.json`
