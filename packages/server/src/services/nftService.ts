import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { env } from "../config/env";
import { HttpError } from "../config/http";
import { loadAnchorWalletKeypair, resolveAnchorWalletPath } from "../lib/anchorWallet";

let metaplex: Metaplex | null = null;

function initializeMetaplex(): Metaplex {
  if (metaplex) {
    return metaplex;
  }

  try {
    const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");

    let wallet: Keypair;
    try {
      wallet = loadAnchorWalletKeypair();
    } catch (err) {
      console.error("Failed to load wallet:", err);
      throw new HttpError(
        500,
        `Failed to initialize NFT minting - wallet not configured at ${resolveAnchorWalletPath()}`,
      );
    }

    metaplex = Metaplex.make(connection)
      .use(keypairIdentity(wallet));

    return metaplex;
  } catch (err) {
    console.error("Failed to initialize Metaplex:", err);
    throw new HttpError(500, "Failed to initialize NFT service");
  }
}

export type MintNFTResult = {
  nftMint: string;
  txSignature: string;
  name: string;
  metadata: ProofNftMetadata;
};

export type ProofNftMetadata = {
  fraud_score: string;
  payment_verified: string;
  location_verified: string;
  reward_multiplier: string;
  merchant: string;
  visit_date: string;
  world_id_verified?: string;
};

export async function mintRewardNFT(
  userWallet: string,
  questName: string,
  merchantName: string,
  fraudScore: number,
  rewardMultiplier: number,
  worldVerified: boolean,
): Promise<MintNFTResult> {
  try {
    if (!env.NFT_REWARDS_ENABLED) {
      throw new HttpError(400, "NFT rewards are not enabled");
    }

    // Validate user wallet format
    try {
      new PublicKey(userWallet);
    } catch {
      throw new HttpError(400, "Invalid user wallet address");
    }

    const mx = initializeMetaplex();

    const visitDate = new Date().toISOString().split("T")[0];
    const badgeName = `${merchantName} Visit Proof`;
    const metadata = {
      fraud_score: String(fraudScore),
      payment_verified: "true",
      location_verified: "true",
      reward_multiplier: String(rewardMultiplier),
      merchant: merchantName,
      visit_date: visitDate,
      world_id_verified: String(worldVerified),
    } satisfies ProofNftMetadata;
    const metadataUri = buildMetadataUri({
      name: badgeName,
      description: `Proof of visit for ${questName} at ${merchantName}`,
      image: env.NFT_REWARD_IMAGE_URL || undefined,
      attributes: [
        { trait_type: "merchant", value: merchantName },
        { trait_type: "quest", value: questName },
        { trait_type: "visit_date", value: visitDate },
        { trait_type: "fraud_score", value: String(fraudScore) },
        { trait_type: "reward_multiplier", value: String(rewardMultiplier) },
        { trait_type: "payment_verified", value: "true" },
        { trait_type: "location_verified", value: "true" },
        { trait_type: "world_id_verified", value: String(worldVerified) },
      ],
      properties: {
        category: "proof-of-visit",
        protocol: "piko",
      },
    });
    const tokenOwner = new PublicKey(userWallet);

    // Mint the NFT
    const { nft, response } = await mx.nfts().create({
      uri: metadataUri,
      name: badgeName,
      symbol: env.NFT_REWARD_SYMBOL,
      tokenOwner,
      creators: [
        {
          address: mx.identity().publicKey,
          share: 100,
        },
      ],
      sellerFeeBasisPoints: 0,
      collection: undefined, // Can be extended to use a collection later
      uses: undefined,
      isCollection: false,
    });

    console.log(`NFT minted: ${nft.address.toBase58()}`);

    return {
      nftMint: nft.address.toBase58(),
      txSignature: response.signature,
      name: badgeName,
      metadata,
    };
  } catch (err) {
    if (err instanceof HttpError) {
      throw err;
    }

    console.error("Failed to mint NFT:", err);
    // Don't fail quest completion if NFT minting fails - just log it
    throw new HttpError(500, `NFT minting failed: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

function buildMetadataUri(payload: {
  name: string;
  description: string;
  image?: string;
  attributes: Array<{ trait_type: string; value: string }>;
  properties: {
    category: string;
    protocol: string;
  };
}) {
  const metadataJson = {
    name: payload.name,
    symbol: env.NFT_REWARD_SYMBOL,
    description: payload.description,
    image: payload.image,
    attributes: payload.attributes,
    properties: payload.properties,
  };

  return `data:application/json;base64,${Buffer.from(JSON.stringify(metadataJson)).toString("base64")}`;
}

export async function getNFTMetadata(nftMint: string) {
  try {
    const mx = initializeMetaplex();
    const mintPublicKey = new PublicKey(nftMint);
    const nft = await mx.nfts().findByMint({ mintAddress: mintPublicKey });
    return nft;
  } catch (err) {
    console.error("Failed to fetch NFT metadata:", err);
    throw new HttpError(500, "Failed to fetch NFT metadata");
  }
}
