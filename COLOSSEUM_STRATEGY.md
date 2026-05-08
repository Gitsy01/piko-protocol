# PIKO Protocol - Colosseum Strategy

## Positioning for Solana Frontier x Metaplex Track

## The Pitch in One Line

> PIKO is programmable real-world incentive infrastructure. Merchants fund reward campaigns, AI prevents abuse, and every verified visit becomes a composable on-chain proof via Metaplex.

Judges do not care about PDAs in isolation. They care about three questions:

1. Can this be a business?
2. Can it scale?
3. Why can people not just cheat?

This strategy doc focuses on those three pillars.

## Pillar 1: Anti-Cheat Is the Moat

### Why This Matters

Most location-based reward systems fail the same way: bots drain the pool. PIKO already has a real multi-layer anti-cheat design, which is one of the strongest differentiators in the project.

### What To Sell Hard

```text
PIKO Anti-Cheat Stack
---------------------

Layer 1: Identity Gate
- World ID (1 human = 1 wallet)

Layer 2: Payment Proof
- Solana Pay signature verification
- Sender + recipient + amount + reference

Layer 3: Location Proof
- GPS accuracy threshold (< 100m)
- Haversine proximity check (< 200m)
- Impossible travel detection (> 200km/h)

Layer 4: Behavioral AI
- Fraud scoring (0-100, threshold: 60)
- Rapid claim detection
- New account burst detection
- LLM-augmented risk assessment
- Deterministic fallback if LLM fails

Layer 5: Economic Guardrails
- Per-wallet daily cap
- Cooldown between claims (60s)
- Idempotent reward ledger (no double-mint)
- On-chain claim PDA (1 claim per user x quest)
```

Demo talking point:

> We do not just detect fraud. We have five independent layers an attacker must beat simultaneously. Even if they spoof GPS, they still need a real Solana Pay transaction to the correct merchant, a verified World ID, and an AI fraud score under 60.

### Demo Card To Show Judges

This is the anti-cheat moment that makes the product feel real:

```text
[OK] Identity: World ID verified
[OK] Payment: 0.05 SOL -> Merchant (confirmed)
[OK] Location: 47m from merchant (GPS accuracy: 12m)
[OK] Fraud Score: 8/100 - LOW RISK
[OK] AI Decision: APPROVED (multiplier: 1.25x)
```

That card says the system is infrastructure, not a toy.

### Gaps To Fix Before Submission

| Gap | Why It Matters | Recommended Fix |
| --- | --- | --- |
| World ID is stubbed | Sybil defense looks incomplete | Wire the real flow or simulate it with realistic nullifier storage |
| Impossible travel is not visible in the demo | A full anti-cheat layer is effectively hidden | Track prior claim location and pass it into fraud review |
| Fraud score is not visible in the UI | Judges cannot see the AI enforcement working | Surface `fraudScore`, `fraudFlags`, and `aiSummary` in the reward completion UI |

### Concrete Code Change: Previous Location Tracking

The fraud stack already supports `prevLat`, `prevLng`, and `timeDelta`, but the settlement flow should pass those values in.

Suggested target:

- [`packages/server/src/services/rewardService.ts`](./packages/server/src/services/rewardService.ts)

Example implementation sketch:

```ts
const lastClaim = await this.db.questClaim.findFirst({
  where: { userWallet: wallet, status: "REWARDED" },
  orderBy: { claimedAt: "desc" },
  include: { quest: { include: { merchant: true } } },
});

const prevLat = lastClaim?.quest.merchant.lat;
const prevLng = lastClaim?.quest.merchant.lng;
const timeDelta = lastClaim
  ? (Date.now() - lastClaim.claimedAt.getTime()) / 1000
  : undefined;
```

Pass `prevLat`, `prevLng`, and `timeDelta` into the fraud review call so impossible travel detection becomes live in the demo.

## Pillar 2: Economic Control Is the Business Model

### Why This Matters

The key economic question is simple: who pays for rewards, and what prevents runaway inflation?

The wrong framing is:

```text
Merchant creates quest
  -> User completes quest
    -> AI computes reward
      -> Protocol mints from thin air
```

The stronger framing is:

```text
PIKO Economic Control Loop
--------------------------

Merchant
  -> funds Reward Vault (fixed pool)
Reward Vault
  -> distributes rewards
Reward Agent
  -> prices rewards dynamically based on traffic, timing, and budget
Real Visits
  -> feed the system with verified demand

Controls
- AI adjusts multiplier from 0.1x to 3.0x per claim
- Budget guard caps multiplier when funds run low
- Daily per-wallet emission cap
- Cooldown prevents rapid draining
- Fraud gate rejects before reward is computed
```

Demo talking point:

> Merchants do not just set flat rewards. The AI continuously reprices rewards based on traffic, time-of-day, and budget. Low traffic can trigger a higher multiplier. Low budget can automatically cap rewards. It behaves more like surge pricing for foot traffic than a fixed coupon.

### Judge Questions and Strong Answers

| Judge Question | Answer |
| --- | --- |
| What happens when the token inflates? | Merchants fund fixed reward pools. When the vault is empty, the campaign ends. No infinite minting. |
| What prevents users from gaming the multiplier? | The Fraud Agent runs before the Reward Agent. If the fraud score is too high, no reward is computed. |
| How do merchants control spend? | Budget guards cap reward multipliers when balance drops below thresholds. |
| Is the AI real or just rules? | Both. The system uses LLM inference for nuance and deterministic fallbacks for reliability. |

### Concrete Code Change: Make Budget State Visible

Budget control exists, but it should be explicit in settlement responses and the demo UI.

Suggested target:

- [`packages/server/src/services/rewardService.ts`](./packages/server/src/services/rewardService.ts)

Suggested payload shape:

```ts
economicState: {
  vaultBalance: merchantBalance,
  budgetGuardActive: merchantBalance < 25,
  multiplierCapped: budgetGuardActive,
  effectiveMultiplierRange: budgetGuardActive
    ? `0.1x - ${merchantBalance < 10 ? "0.75x" : "1.2x"}`
    : "0.1x - 3.0x",
}
```

This turns a hidden backend rule into a visible business-control mechanism.

## Pillar 3: Metaplex Proofs Are the Product

### The Reframe

Current framing:

> The user gets a badge NFT as a bonus.

Winning framing:

> Every verified real-world visit creates a composable on-chain proof. The NFT is the product.

### Why This Fits the Metaplex Track

1. Composability
   Other protocols can read visit proofs and build on top of them.
2. Compressed NFT roadmap
   Bubblegum gives a clear path to scaling visit proofs cheaply.
3. Structured metadata
   Every proof can carry merchant, date, fraud, payment, and location attestation data on-chain.

Example protocol extensions:

- DeFi: hold five merchant visit proofs to unlock a bonus rate
- Loyalty: prove ten visits to unlock VIP status
- Insurance: verified location history informs risk pricing

### Example Metadata Shape

```json
{
  "name": "Cafe Sunrise Explorer",
  "attributes": [
    { "trait_type": "merchant", "value": "cafe-sunrise" },
    { "trait_type": "visit_date", "value": "2026-05-05" },
    { "trait_type": "fraud_score", "value": "8" },
    { "trait_type": "reward_multiplier", "value": "1.25" },
    { "trait_type": "payment_verified", "value": "true" },
    { "trait_type": "location_verified", "value": "true" }
  ]
}
```

### What To Build For Submission

1. Rich NFT metadata
2. Merchant-level collection grouping
3. A clear production path to Bubblegum compressed NFTs

Suggested target:

- [`packages/server/src/services/nftService.ts`](./packages/server/src/services/nftService.ts)

Suggested metadata sketch:

```ts
const metadata = {
  name: `${merchantName} Visit Proof`,
  symbol: env.NFT_REWARD_SYMBOL,
  description: `Verified visit to ${merchantName} - Quest: ${questName}`,
  image: merchantImageUrl || env.NFT_REWARD_IMAGE_URL,
  attributes: [
    { trait_type: "merchant", value: merchantName },
    { trait_type: "quest", value: questName },
    { trait_type: "visit_date", value: new Date().toISOString().split("T")[0] },
    { trait_type: "fraud_score", value: String(fraudScore) },
    { trait_type: "reward_multiplier", value: String(rewardMultiplier) },
    { trait_type: "payment_verified", value: "true" },
    { trait_type: "location_verified", value: "true" },
    { trait_type: "world_id_verified", value: String(worldVerified) }
  ],
  properties: {
    category: "proof-of-visit",
    protocol: "piko"
  }
};
```

This makes each NFT a readable attestation, not just a collectible.

## Architecture Slide

Use this directly in the deck or submission materials:

```text
PIKO PROTOCOL
Real-World Incentive Infrastructure

Merchants
  -> fund campaigns
Users
  -> complete visits
Protocols
  -> read proofs

AI Engine
- Fraud scoring
- Reward pricing
- Merchant vetting

Settlement
- Verify payment
- GPS gate
- Emit reward

Proof Layer
- NFT mint
- PIKO token reward
- Claim PDA
- Metaplex proof data

Key differentiators
- 5-layer anti-cheat
- AI-driven dynamic pricing
- Composable proofs
- Deterministic fallback paths
```

## Pre-Submission Plan

### Week 1: Make the Demo Undeniable

| Day | Task | Impact |
| --- | --- | --- |
| 1 | Wire `prevLat`, `prevLng`, and `timeDelta` into fraud calls | Activates impossible travel detection |
| 2 | Surface fraud score and AI reasoning in the completion UI | Judges can see anti-cheat working |
| 2 | Add budget guard and multiplier state to responses | Judges can see economic control |
| 3 | Add structured NFT metadata | Makes proof NFTs meaningful |
| 4 | Fix or credibly simulate World ID | Makes sybil defense believable |
| 5 | Record the end-to-end demo video | Converts technical work into submission strength |

### Week 2: Polish the Narrative

| Task | Why |
| --- | --- |
| Write a one-page protocol spec | Judges skim fast |
| Turn the architecture block into a visual slide | Visuals land faster than text |
| Prepare a "what if someone cheats?" walkthrough | Makes the moat obvious |
| Prepare a "who pays?" economics walkthrough | Makes the business model obvious |

## What Not To Do Before Submission

- Do not rewrite Anchor programs
- Do not fully implement Bubblegum just for the demo
- Do not spend time on a token dashboard instead of the claim loop
- Do not add more AI agents
- Do not move the demo to mainnet

## The Three Sentences That Win

1. PIKO turns real-world merchant visits into verifiable on-chain proofs. Every visit becomes a composable Metaplex NFT with fraud score, payment verification, and location attestation inside the metadata.
2. PIKO uses five layers of anti-cheat before any reward is issued: identity, payment proof, GPS validation, AI behavioral scoring, and economic guardrails, so merchants can fund campaigns without bots draining them.
3. The AI does not just block fraud. It dynamically prices each reward based on traffic, timing, budget, and user history, which gives merchants surge pricing for foot traffic instead of static coupons.

## Recommended Submission Positioning

Lead the submission with these three proof points:

- Anti-cheat moat
- Merchant-funded economic control
- Metaplex-powered composable proofs

Everything else is secondary.
