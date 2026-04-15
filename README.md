# Puff Puff Pass API (x402)

Technical starter for the 4/20 "virtual joint" project.

## What is included

- HTTP API skeleton (Node built-in server)
- In-memory leaderboard and feed logic
- x402-style 402 challenge flow scaffold
- OpenAPI document
- `.well-known/x402` discovery document
- SQL schema draft for production persistence
- Unit tests for ranking and culture-line generation

## Current status

This is intentionally a production-minded scaffold, but payment verification is still a placeholder.

`POST /api/joint/pass` currently:

- Returns `402 Payment Required` with a `PAYMENT-REQUIRED` header when no payment signature is provided
- Accepts any non-empty `PAYMENT-SIGNATURE` header as valid (temporary)

Before production launch, wire real verification via a facilitator or local verifier.

## Run

```bash
cd puff-puff-pass
node src/server.mjs
```

Server defaults to `http://localhost:4020`.

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
