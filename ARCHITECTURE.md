# PIKO Protocol Architecture

PIKO Protocol enables businesses to program real-world incentives that execute on-chain using location verification and AI validation.

The current repository keeps the historical codebase name `DePokemonGo`, but the public-facing product narrative is now `PIKO Protocol`: location-based incentive infrastructure for merchants, events, communities, and real-world activation campaigns.

At a glance, the protocol has four layers: a demo client that captures real-world actions, an API that verifies and orchestrates them, AI agents that score risk and adjust rewards, and Solana programs that settle the final result. The point of the stack is simple: real-world merchant engagement can be priced, filtered, and paid out on-chain without rebuilding separate product logic for every campaign.

## Protocol Stack

```text
┌─────────────────────────────────────────────────────┐
│  LAYER 4 - Demo Client                             │
│  Next.js PWA - Map Discovery - Wallet UX           │
├─────────────────────────────────────────────────────┤
│  LAYER 3 - Incentive API                           │
│  Merchant Registration - Incentive Triggers -      │
│  Payment Verification - Leaderboard                │
├─────────────────────────────────────────────────────┤
│  LAYER 2 - AI Validation Engine                    │
│  Fraud Detection Agent - Reward Optimization Agent │
│  Growth Intelligence Agent - Merchant Vetting      │
├─────────────────────────────────────────────────────┤
│  LAYER 1 - Solana Protocol                         │
│  Merchant Registry Program - Incentive Program     │
│  PIKO Token - Proof-of-Completion NFTs             │
└─────────────────────────────────────────────────────┘
```

## Layer 1: Solana Protocol

Layer 1 is the trust and settlement layer. It stores merchant and incentive state on-chain, enforces PDA-based account derivation, and keeps claim history auditable.

- `programs/merchant-registry/src/lib.rs`
  Stores merchant registry records with wallet authority, location hash privacy, and anti-spam staking.
- `programs/quest/src/lib.rs`
  Tracks incentive trigger creation, claim state, and completion eligibility on-chain.
- `packages/server/src/lib/pikoMinter.ts`
  Mints programmable PIKO token rewards after backend verification.
- `packages/server/src/services/nftService.ts`
  Mints proof-of-completion NFTs through Metaplex for persistent achievement records.

Why it matters:
- Merchants have verifiable on-chain presence.
- Incentive triggers can be audited independently of the frontend.
- Reward issuance and claim completion are tied to recorded protocol events.

## Layer 2: AI Validation Engine

Layer 2 evaluates whether the protocol should approve, price, or optimize incentives before rewards are issued.

- `packages/ai/src/agents/fraud.agent.ts`
  Scores suspicious behavior using LLM-first fraud analysis with deterministic rule fallback.
- `packages/ai/src/agents/reward.agent.ts`
  Dynamically adjusts reward multipliers to match traffic and budget conditions.
- `packages/ai/src/agents/growth.agent.ts`
  Produces operator-facing growth recommendations from protocol activity.
- `packages/ai/src/agents/merchant.agent.ts`
  Reviews merchant onboarding requests before they are admitted into the network.

Why it matters:
- Fraud risk is evaluated before rewards are finalized.
- Merchants can tune spend and conversion instead of using static reward schedules.
- The protocol can operate with resilient fallback rules even if live model inference is unavailable.

## Layer 3: Incentive API

Layer 3 connects wallets, merchants, payments, AI validation, and on-chain reward execution.

- `packages/server/src/routes/merchants.ts`
  Merchant registry onboarding, duplicate detection, and nearby business discovery.
- `packages/server/src/routes/quests.ts`
  Incentive trigger creation, claim orchestration, and completion flows.
- `packages/server/src/routes/payments.ts`
  Solana Pay request generation plus recipient and amount verification.
- `packages/server/src/routes/ai.ts`
  AI routing, fraud validation, reward execution, and growth analysis endpoints.
- `packages/server/src/services/questService.ts`
  Coordinates payment verification, claim tracking, PIKO minting, and NFT issuance.

Why it matters:
- Businesses integrate through HTTP without dealing directly with on-chain instruction assembly.
- Payment verification is enforced before protocol rewards settle.
- AI decisions, business rules, and settlement orchestration are unified in one API layer.

## Layer 4: Demo Client

Layer 4 is the operator and end-user showcase. It demonstrates how the protocol behaves in a consumer-facing application without changing the underlying primitives.

- `apps/web/app/page.tsx`
  Map-based business discovery and live incentive network visibility.
- `apps/web/app/quest/[id]/page.tsx`
  Incentive detail, verification checklist, and reward completion flow.
- `apps/web/app/dashboard/page.tsx`
  Merchant protocol view showing trigger creation, live claims, AI validation, and on-chain reward output.
- `apps/web/components/app-shell.tsx`
  Navigation shell that frames the PWA as protocol infrastructure rather than a game.

Why it matters:
- Businesses can see how an incentive lifecycle feels in practice.
- Users can move from discovery to payment to reward in a single mobile-first flow.
- Demo pages help judges, partners, and merchants understand the full stack quickly.

## End-to-End Incentive Flow

1. A merchant registers through the Merchant Registry API and is evaluated by the Merchant Agent.
2. The backend records the merchant, computes location privacy data, and can mirror that identity on-chain through the Merchant Registry program.
3. The merchant creates an incentive trigger with reward amount, conditions, expiry, and claim caps.
4. The incentive is surfaced in the demo client as a nearby business activation opportunity.
5. A user enters the location, satisfies spend or activity conditions, and initiates payment via Solana Pay.
6. The backend verifies recipient, amount, reference, and wallet context.
7. The Fraud Agent evaluates behavioral and location signals before reward settlement.
8. If approved, PIKO tokens are minted and an optional proof-of-completion NFT is issued.
9. Claim status and leaderboard activity update across the protocol experience.

## Business Use Cases

### Retail

Brands can reward store visits, minimum spend actions, or repeat purchase behavior with on-chain incentives.

### Events

Organizers can reward attendance, booth check-ins, sponsor engagement, or venue-specific actions using location-aware triggers.

### Tourism

Cities, venues, or travel operators can guide movement across real-world destinations and reward completed routes.

### Web3 Proof of Activity

Protocols and communities can issue proof-of-participation rewards tied to real-world presence, not just wallet clicks.

## Security Model

PIKO Protocol combines multiple layers of defense:

- Anti-spam merchant staking
  Merchant onboarding requires stake-based commitment to reduce low-quality registrations.
- PDA-based state
  Merchant, incentive, and claim state are derived predictably and verified on-chain.
- Location-aware validation
  Claim evaluation uses geospatial context rather than accepting blind reward requests.
- Solana Pay verification
  Payments are checked for correct recipient, amount, and transaction signature before rewards settle.
- AI fraud controls
  Fraud scoring reviews GPS quality, claim frequency, impossible travel, and account behavior patterns.
- Deterministic fallback logic
  If model inference is unavailable, core fraud and reward decisions continue through explicit rules.

## Why This Repo Matters

This repository is more than a location-based rewards demo. It already contains the key primitives for a reusable incentive protocol:

- On-chain merchant identity
- On-chain incentive state
- AI-assisted fraud gating
- Solana Pay verification
- Programmable token rewards
- NFT completion proofs

The web experience is now positioned as a demo client for the protocol rather than the protocol itself.
