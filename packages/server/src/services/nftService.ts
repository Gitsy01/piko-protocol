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
};

export async function mintRewardNFT(
  userWallet: string,
  questName: string,
  merchantName: string
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

    // Create metadata URI - for now using a simple approach
    const badgeName = `${merchantName} Explorer`;
    const metadataUri = env.NFT_REWARD_METADATA_BASE_URI || "https://arweave.net/"; // Placeholder
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
