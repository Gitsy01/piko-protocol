# NFT Reward Integration - Testing Guide

## Prerequisites

1. **Environment Variables** - Add to your `.env` file:
```bash
NFT_REWARDS_ENABLED=true
NFT_REWARD_METADATA_BASE_URI=https://example.com/metadata/
NFT_REWARD_SYMBOL=DPGO
SOLANA_RPC_URL=https://api.devnet.solana.com
ANCHOR_WALLET=./wallet/dev-wallet.json
PIKO_MINT_AUTHORITY_WALLET=/secure/path/mint-authority.json
```

2. **Wallet Setup** - Make sure `ANCHOR_WALLET` points to a valid Solana devnet keypair for NFT operations. If you want live PIKO token rewards too, set `PIKO_MINT_AUTHORITY_WALLET` to a separate mint-authority keypair.

3. **User Creation** - User must exist in database (create one via `/user/register` endpoint first)

## Test Flow

### Step 1: Start the Server
```bash
npm run dev:server
```

### Step 2: Create a Test Merchant (if needed)
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

### Step 5: Complete with Payment (Mock)
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

## Expected Response

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
    "nftMint": "xxxxxxxx..." ✅ NFT ADDRESS HERE
  }
}
```

## Verification

1. **Check Badge in Database**:
```sql
SELECT * FROM "Badge" 
WHERE "userId" = (SELECT id FROM "User" WHERE wallet = 'YOUR_WALLET_ADDRESS');
```

2. **Check NFT on Solana Explorer**:
Visit: `https://explorer.solana.com/address/{NFT_MINT_ADDRESS}?cluster=devnet`

3. **Check User NFT in Frontend**:
- Navigate to user profile
- Should show earned badges with NFT mint address

## Troubleshooting

### NFT Minting Failed: Wallet not configured
- Ensure `ANCHOR_WALLET` env var points to valid keypair file
- Verify wallet has SOL for transaction fees on devnet

### PIKO Minting Failed: Mint authority not configured
- Ensure `PIKO_MINT_AUTHORITY_WALLET` points to the dedicated token mint authority keypair
- Keep the mint authority outside the repository for production deployments

### NFT Minting Failed: Invalid metadata URI
- Set `NFT_REWARD_METADATA_BASE_URI` to a valid IPFS or CDN URL
- Temporarily use: `https://arweave.net/`

### Quest Completion Blocked by NFT Error
- NFT minting errors do NOT block quest completion
- Check server logs for NFT-specific errors
- PIKO minting still completes before the NFT attempt runs

## Important Notes

- 🟢 **Non-blocking**: If NFT minting fails, the quest completion succeeds anyway
- 🟢 **User Creation**: Badges are only created if user exists in DB
- 🟢 **Devnet Only**: Current setup uses Solana devnet
- 🟡 **Production Ready**: For mainnet, update `SOLANA_RPC_URL` and wallet security
