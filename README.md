# PIKO Protocol

Earn rewards for real-world actions instantly on-chain.

## Colosseum Positioning

For the Solana Frontier x Metaplex submission story, lead with three ideas:

- Anti-cheat moat: identity, payment, GPS, AI scoring, and economic guardrails
- Economic control: merchant-funded reward logic with budget-aware pricing
- Metaplex proofs: each verified visit becomes a composable on-chain proof

Full strategy: [COLOSSEUM_STRATEGY.md](./COLOSSEUM_STRATEGY.md)

## Demo in 10 Seconds

1. Open the map
2. Tap the merchant pin
3. Confirm the payment
4. AI verifies it
5. 5 PIKO settles instantly

Some internal repo paths still use the legacy name for continuity, but every public-facing surface should present `PIKO Protocol`.

## Run the Demo

```bash
npm install
npm run dev
```

Open these exact URLs:

- Main judge flow: `http://localhost:3000/?demo=1`
- Focused reward loop: `http://localhost:3000/demo-flow?demo=1`
- Merchant simulation: `http://localhost:3000/merchant/cafe-bloom`
- System reveal console: `http://localhost:3000/demo`

If you only have time for one flow, use `http://localhost:3000/?demo=1`.

## What Judges Should Experience

`/?demo=1` is now the forced path:

1. See one merchant pin: **Cafe Bloom** (third-wave coffee · Connaught Place · 500 PIKO/day budget)
2. Tap it
3. Start the incentive flow — or tap **View full merchant profile** to see the economics dashboard
4. Confirm the scripted payment
5. See a structured anti-cheat decision receipt with fraud score, payment proof, location proof, and final reward
6. See `5 PIKO` and the NFT proof appear

## Why This Matters

PIKO turns a real-world merchant action into a programmable on-chain incentive loop:

- Discover a merchant on the map
- Complete the action
- Let AI verify fraud risk and reward logic
- Settle the reward on Solana
- Mint proof of completion

## Architecture

The architecture is already separated cleanly:

- `programs/` - Solana programs for registry and incentive state
- `packages/ai` - fraud scoring, reward optimization, merchant intelligence
- `packages/server` - API layer for merchants, incentives, payments, AI, and rewards
- `apps/web` - mobile-first demo client and judge-facing flows
- `packages/common` - shared types and utilities

Full breakdown: [ARCHITECTURE.md](./ARCHITECTURE.md)

## Quick Start

Prerequisites:

- Node.js 18+
- PostgreSQL
- Redis
- Rust toolchain
- Solana CLI
- Anchor CLI

Environment:

1. Copy `.env.example` to `.env`
2. Fill in the required values

Important variables:

- `DATABASE_URL`
- `REDIS_URL`
- `SOLANA_RPC_URL`
- `SOLANA_WS_URL`
- `NEXT_PUBLIC_SOLANA_RPC_URL`
- `ANCHOR_WALLET`
- `PIKO_MINT_AUTHORITY_WALLET`
- `PIKO_MINT_ADDRESS`
- `PIKO_DECIMALS`
- `MERCHANT_REGISTRY_PROGRAM_ID`
- `QUEST_PROGRAM_ID`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OLLAMA_URL`
- `OLLAMA_MODEL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_DEMO_MODE`
- `JWT_SECRET`
- `LOG_LEVEL`
- `PORT`

Database and local services:

```bash
npm run db:push
npm run db:seed
```

Anchor:

```bash
npm run anchor:build
npm run anchor:test
```

Deployment verification:

```bash
npm install
npm run build
npm run lint
npm run test
npm run anchor:build
```

Before any judge demo, keep `Anchor.toml` on devnet and verify the app still degrades cleanly when Redis, AI inference, NFT minting, RPC confirmation, or wallet connection is unavailable. `/?demo=1` should remain a controlled simulation with selective real primitives, not a dependency on live geolocation, payment latency, or fresh merchant data.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run web app and server through Turbo |
| `npm run dev:web` | Run only the Next.js app |
| `npm run dev:server` | Run only the Express API |
| `npm run build` | Build all workspaces |
| `npm run lint` | Run workspace lint tasks |
| `npm run test` | Run workspace tests |
| `npm run db:push` | Push Prisma schema |
| `npm run db:seed` | Seed merchant data |
| `npm run anchor:build` | Build Anchor programs |
| `npm run anchor:test` | Run Anchor tests |
| `npm run anchor:deploy` | Deploy Anchor programs |

## Development Notes

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`
- Demo mode: `/?demo=1`
- Focused scripted flow: `/demo-flow?demo=1`
- Merchant simulation: `/merchant/cafe-bloom`
- System reveal: `/demo`
- Health check: `GET /api/health`

## Project Status

This repo already has the full loop:

`discover -> claim -> AI verify -> reward -> NFT`

The main work now is presentation, clarity, and demo quality, not core architecture.
