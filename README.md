# Puff Puff Pass API (x402)

Technical starter for the 4/20 "virtual joint" project.

## What is included

- HTTP API skeleton (Node built-in server)
- In-memory leaderboard and feed logic
- Real x402 middleware integration for paid route enforcement
- OpenAPI document
- `.well-known/x402` discovery document
- SQL schema draft for production persistence
- Unit tests for ranking and culture-line generation

## Current status

`POST /api/joint/pass` is protected by `@x402/express` middleware.

- Missing or invalid payment returns `402 Payment Required`
- Valid payment is verified via configured facilitator and then passes through to route logic

## Run

```bash
cd puff-puff-pass
node src/server.mjs
```

Server defaults to `http://localhost:4020`.

### Required env vars for real payment settlement

```bash
PAY_TO=0xYourReceivingAddress
X402_NETWORK=eip155:8453
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
```

For local/testnet quickstart you can use:

```bash
X402_NETWORK=eip155:84532
FACILITATOR_URL=https://x402.org/facilitator
PAY_TO=0xYourBaseSepoliaAddress
```

## Test

```bash
cd puff-puff-pass
node --test src/core/*.test.mjs
```

## API routes

- `GET /api/joint/current`
- `GET /api/feed?limit=50`
- `GET /api/leaderboard`
- `GET /api/handles/:handle`
- `GET /api/health`
- `POST /api/joint/pass`
- `GET /.well-known/x402`
- `GET /openapi.json`
