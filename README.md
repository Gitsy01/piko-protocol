# PIKO Protocol - Location-Based Incentive Infrastructure on Solana

PIKO Protocol enables businesses to program real-world incentives that execute on-chain using location verification and AI validation. This repository combines Solana programs, an incentive API, an AI validation engine, and a mobile-first demo client that showcases the protocol end to end.

The repository name remains `DePokemonGo` for code continuity, but the public-facing product narrative is now `PIKO Protocol`.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full 4-layer protocol walkthrough.

## Protocol stack

- `Layer 1 - Solana Protocol`
  `programs/merchant-registry` stores merchant identity, staking, and registry state.
- `Layer 1 - Solana Protocol`
  `programs/quest` stores incentive trigger and claim state on-chain.
- `Layer 2 - AI Validation Engine`
  `packages/ai` contains merchant vetting, fraud detection, reward optimization, and growth intelligence agents.
- `Layer 3 - Incentive API`
  `packages/server` provides merchant registration, incentive trigger creation, payment verification, AI endpoints, leaderboard data, and user routes.
- `Layer 4 - Demo Client`
  `apps/web` is a Next.js PWA for business discovery, incentive flows, wallet UX, and protocol demos.
- `Shared Infrastructure`
  `packages/common` contains shared types, constants, and utilities used across packages.
- `Testing and Tooling`
  `tests` contains Anchor and integration-style coverage, and `scripts` contains seeding plus Anchor helper scripts.

## Tech stack

- Turborepo workspaces
- Next.js 14 and React 18
- Express and Prisma
- Solana Web3, Solana Pay, and Anchor
- PostgreSQL and Redis
- TypeScript across the monorepo
- OpenRouter-backed AI integration for live model responses
- Optional Ollama integration for local AI experiments

## Prerequisites

Before running the project locally, make sure you have:

- Node.js 18 or newer
- npm
- PostgreSQL
- Redis
- Rust toolchain
- Solana CLI
- Anchor CLI
- A funded Solana devnet wallet for server/NFT operations plus a separate mint-authority wallet for live PIKO rewards
- OpenRouter API key for live AI-backed reward and fraud decisions
- Ollama if you want to keep local AI experiments available

## Environment setup

1. Copy `.env.example` to `.env`.
2. Fill in the required values.

Important variables include:

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
- `JWT_SECRET`
- `PORT`

The default config is set up for Solana devnet.

For dynamic PIKO rewards, keep `PIKO_MINT_AUTHORITY_WALLET` separate from `ANCHOR_WALLET`. In production, the mint-authority file should live outside the repository and be mounted or injected at deploy time.

The web map uses free OpenStreetMap-backed CARTO tiles and does not require a map token.

## Installation

```bash
npm install
```

## Quick start

Run the web app and API in development mode:

```bash
npm run dev
```

Useful focused commands:

```bash
npm run dev:web
npm run dev:server
```

Prepare the database:

```bash
npm run db:push
npm run db:seed
```

Build or test the Anchor programs:

```bash
npm run anchor:build
npm run anchor:test
```

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run workspace development tasks through Turbo |
| `npm run dev:web` | Start only the Next.js app |
| `npm run dev:server` | Start only the Express API |
| `npm run build` | Build all workspaces |
| `npm run lint` | Run workspace lint tasks |
| `npm run test` | Run workspace tests |
| `npm run db:push` | Push Prisma schema to the database |
| `npm run db:seed` | Seed merchant data |
| `npm run anchor:build` | Build Anchor programs |
| `npm run anchor:test` | Run Anchor tests |
| `npm run anchor:deploy` | Deploy Anchor programs |

## Development notes

- The frontend runs on `http://localhost:3000`.
- The API defaults to `http://localhost:3001`.
- Health check endpoint: `GET /api/health`
- WebSocket support is initialized by the server for realtime updates.
- Generated artifacts under `target/` come from Anchor builds and deployments.

## Suggested first run flow

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in local values.
3. Start PostgreSQL and Redis.
4. Run `npm run db:push`.
5. Run `npm run db:seed`.
6. Run `npm run anchor:build`.
7. Start the app with `npm run dev`.

## Project status

This repository is structured as an active monorepo for web, backend, AI, and Solana program development. If you are onboarding a new teammate, start with the web app and server packages first, then move to the Anchor programs once local services are running.
