# Puff Puff Pass

An x402-gated virtual joint passing game. Grab the joint, pass it on, climb the leaderboard.

**Live:** [ppp.0x402.sh](https://ppp.0x402.sh)

## How it works

1. Connect your wallet (MetaMask or any browser wallet)
2. Enter your handle and hit "Pass It"
3. Sign a $0.00402 USDC transfer via the x402 protocol
4. You're now holding the joint. Climb the leaderboard.

Every pass costs $0.00402 in USDC, settled onchain via [x402](https://x402.org) payment protocol. Supports Base mainnet and Abstract mainnet.

## Stack

- **Server:** Express.js with `@x402/express` payment middleware
- **Database:** Postgres (Neon) with PGlite fallback for local dev
- **Frontend:** Vanilla HTML/CSS/JS, dark theme, mobile-responsive
- **Wallet:** Browser wallet connect via ethers.js v6 (CDN, no build step)
- **Payments:** x402 exact EVM scheme (EIP-3009 transferWithAuthorization)
- **Deploy:** Vercel serverless + GitHub Actions CI/CD
- **Chains:** Base (eip155:8453) via CDP facilitator, Abstract (eip155:2741) via Abstract facilitator

## Run locally

```bash
npm install
npm start
```

Server starts at `http://localhost:4020`. Uses PGlite by default (no external DB needed).

## Environment variables

### Required for production

```bash
PAY_TO=0xYourReceivingAddress
X402_NETWORKS=eip155:8453,eip155:2741
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
FACILITATOR_URL_ABSTRACT=https://facilitator.x402.abs.xyz
CDP_API_KEY_ID=your-cdp-key-id
CDP_API_KEY_SECRET=your-cdp-key-secret
DATABASE_URL=postgresql://...
BASE_URL=https://ppp.0x402.sh
```

### Local / testnet quickstart

```bash
X402_NETWORKS=eip155:84532
FACILITATOR_URL=https://x402.org/facilitator
PAY_TO=0xYourBaseSepoliaAddress
```

No CDP keys needed for testnet. The x402.org facilitator handles Base Sepolia for free.

## Storage

- **Production:** Set `DATABASE_URL` to a Postgres connection string
- **Local dev:** Defaults to PGlite at `./.data/pglite` (zero config)
- Schema auto-applies from `db/schema.sql` on startup

## Tests

```bash
npm test
```

## Buyer E2E test (real x402 payment)

```bash
EVM_PRIVATE_KEY=0x... \
BUYER_API_URL=http://localhost:4020/api/joint/pass \
BUYER_HANDLE=your_handle \
BUYER_X402_NETWORK=eip155:* \
npm run test:e2e:buyer
```

Note: `PAY_TO` must be different from the buyer wallet address. The CDP facilitator rejects self-payments.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Frontend UI |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/joint/current` | Current holder + total passes |
| `GET` | `/api/leaderboard` | Top players with scores and badges |
| `GET` | `/api/feed?limit=50` | Recent pass activity |
| `GET` | `/api/handles/:handle` | Stats for a specific handle |
| `POST` | `/api/joint/pass` | Pass the joint (x402-gated) |
| `GET` | `/.well-known/x402` | x402 service discovery |
| `GET` | `/openapi.json` | OpenAPI spec |

## Architecture

```
Browser (ethers.js) -> POST /api/joint/pass
                       -> 402 Payment Required (payment-required header)
Browser signs EIP-3009 transferWithAuthorization
                       -> POST /api/joint/pass + payment-signature header
Server -> CDP/Abstract facilitator /verify -> /settle
                       -> 200 OK + leaderboard update
```

## License

MIT
