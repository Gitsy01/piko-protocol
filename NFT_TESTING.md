# NFT Reward Integration - Testing Guide

## Prerequisites

1. Environment variables - add to your `.env` file:

```bash
NFT_REWARDS_ENABLED=true
NFT_REWARD_METADATA_BASE_URI=https://piko-protocol-web.vercel.app/metadata/
NFT_REWARD_METADATA_TEMPLATE=contributor.json
NFT_REWARD_IMAGE_URL=https://piko-protocol-web.vercel.app/nft/contributor-proof.svg
NFT_REWARD_SYMBOL=CPN
SOLANA_RPC_URL=https://api.devnet.solana.com
ANCHOR_WALLET=./wallet/dev-wallet.json
# Railway/Vercel-style production deploys should use ANCHOR_WALLET_SECRET instead of a file path.
PIKO_MINT_AUTHORITY_WALLET=/secure/path/mint-authority.json
```

2. Wallet setup - make sure `ANCHOR_WALLET` points to a valid Solana devnet keypair for NFT operations. If you want live PIKO token rewards too, set `PIKO_MINT_AUTHORITY_WALLET` to a separate mint-authority keypair.
3. User creation - the user must exist in the database first, for example via `/user/register`.

## Test Flow

### Step 1: Start the Server

```bash
npm run dev:server
```

### Step 2: Create a Test Merchant

```bash
POST http://localhost:3001/merchants
```

### Step 3: Create a Test Quest

```bash
POST http://localhost:3001/quests
Content-Type: application/json

{
  "merchantId": "merchant_id_here",
  "title": "Coffee Explorer",
  "description": "Visit our cafe",
  "rewardAmount": 1,
  "rewardToken": "PIKO",
  "xpReward": 50,
  "minSpend": 2,
  "maxClaims": 50,
  "questType": "VISIT",
  "expiresAt": "2025-12-31T23:59:59Z",
  "conditions": {}
}
```

### Step 4: Claim the Quest

```bash
POST http://localhost:3001/quests/{questId}/claim
Content-Type: application/json

{
  "wallet": "YOUR_WALLET_ADDRESS",
  "lat": 40.7128,
  "lng": -74.0060,
  "gpsAccuracy": 5
}
```

### Step 5: Complete with Payment

```bash
POST http://localhost:3001/quests/complete
Content-Type: application/json

{
  "questId": "quest_id_here",
  "userWallet": "YOUR_WALLET_ADDRESS",
  "reference": "payment_reference_here",
  "paymentSignature": "signature_here",
  "lat": 40.7128,
  "lng": -74.0060,
  "gpsAccuracy": 5
}
```

## Expected API Response

```json
{
  "success": true,
  "data": {
    "verified": true,
    "txSignature": "...",
    "approved": true,
    "rewardAmount": 1,
    "rewardToken": "PIKO",
    "rewardMultiplier": 1,
    "aiSummary": "Quest completed successfully",
    "fraudScore": 0,
    "xpEarned": 50,
    "newLevel": 2,
    "transactionId": "...",
    "nftMint": "xxxxxxxx..."
  }
}
```

The raw API response only proves the NFT mint exists. For judge-facing flows, that is not enough.

## Expected Proof NFT Presentation

The frontend should render the NFT as a proof artifact, not just a badge or address:

```text
Proof NFT Created
- Fraud Score: 8
- Verified Payment: Yes
- Location Verified: Yes
- Multiplier: 1.3x
```

The mint address should be secondary.

## Expected Metaplex Proof Metadata

The proof NFT should map to structured metadata like:

```json
{
  "name": "Cafe Bloom Visit Proof",
  "attributes": [
    { "trait_type": "merchant", "value": "cafe-bloom" },
    { "trait_type": "quest", "value": "Buy any drink, earn 5 PIKO" },
    { "trait_type": "visit_date", "value": "2026-05-07" },
    { "trait_type": "fraud_score", "value": "8" },
    { "trait_type": "payment_verified", "value": "true" },
    { "trait_type": "location_verified", "value": "true" },
    { "trait_type": "reward_multiplier", "value": "1.4" },
    { "trait_type": "world_id_verified", "value": "true" }
  ]
}
```

For Metaplex track judges, this is the real output: the NFT is the proof.

## Verification

1. Check badge records in the database:

```sql
SELECT *
FROM "Badge"
WHERE "userId" = (
  SELECT id
  FROM "User"
  WHERE wallet = 'YOUR_WALLET_ADDRESS'
);
```

2. Check the NFT on Solana Explorer:
   `https://explorer.solana.com/address/{NFT_MINT_ADDRESS}?cluster=devnet`
3. Check the frontend:
   the user-facing flow should show the proof NFT card with fraud score, payment verification, location verification, and multiplier.

## Troubleshooting

### NFT Minting Failed: Wallet Not Configured

- Ensure `ANCHOR_WALLET` points to a valid keypair file.
- Verify the wallet has SOL for devnet transaction fees.

### PIKO Minting Failed: Mint Authority Not Configured

- Ensure `PIKO_MINT_AUTHORITY_WALLET` points to the dedicated token mint authority keypair.
- Keep the mint authority outside the repository for production deployments.

### NFT Minting Failed: Invalid Metadata URI

- Set `NFT_REWARD_METADATA_BASE_URI` to a valid IPFS or CDN URL.
- If using the bundled static metadata, set `NFT_REWARD_METADATA_TEMPLATE=contributor.json`.
- Temporary fallback: leave `NFT_REWARD_METADATA_BASE_URI` empty to use the local data URI metadata generator.

### Metadata Changed but Explorer Still Shows the Old NFT

- Mint a new NFT after changing metadata URLs. The metadata URI is embedded at mint time.
- Existing NFTs only update if their Metaplex metadata is mutable and the update authority explicitly changes the on-chain URI.

### Quest Completion Blocked by NFT Error

- NFT minting errors do not block quest completion.
- Check server logs for NFT-specific errors.
- PIKO minting still completes before the NFT attempt runs.

## Important Notes

- Non-blocking: if NFT minting fails, quest completion still succeeds.
- User creation: badges are only created if the user exists in the database.
- Devnet only: the current setup uses Solana devnet.
- Production ready path: for mainnet, update `SOLANA_RPC_URL` and harden wallet security.
