import { PrismaClient, Category, QuestType } from "@prisma/client";
import { Keypair } from "@solana/web3.js";

const prisma = new PrismaClient();

const center = { lat: 28.6139, lng: 77.209 };

const categories = [
  Category.CAFE,
  Category.RESTAURANT,
  Category.RETAIL,
  Category.GROCERY,
  Category.ENTERTAINMENT,
  Category.FITNESS,
  Category.BEAUTY,
  Category.OTHER,
] as const;

const merchantNames = [
  "Cafe Bloom",
  "Pixel Pizza",
  "Sol Street Market",
  "Mint & Masala",
  "Arcade Orbit",
  "Glow Lab",
  "Fit Forge",
  "Spice Sprint",
  "Nectar Nook",
  "Quest Corner",
];

function makeWallet(index: number) {
  const seed = new Uint8Array(32);
  seed.fill(index + 1);
  return Keypair.fromSeed(seed).publicKey.toBase58();
}

function coordinateOffset(index: number) {
  const ring = Math.floor(index / 10) + 1;
  const angle = ((index % 10) / 10) * Math.PI * 2;
  const latOffset = Math.sin(angle) * ring * 0.003;
  const lngOffset = Math.cos(angle) * ring * 0.003;

  return {
    lat: center.lat + latOffset,
    lng: center.lng + lngOffset,
  };
}

async function main() {
  for (let index = 0; index < 50; index += 1) {
    const coords = coordinateOffset(index);
    const category = categories[index % categories.length];
    const name = `${merchantNames[index % merchantNames.length]} ${index + 1}`;
    const merchant = await prisma.merchant.upsert({
      where: { wallet: makeWallet(index) },
      update: {
        name,
        category,
        lat: coords.lat,
        lng: coords.lng,
        locationHash: `${coords.lat.toFixed(4)}:${coords.lng.toFixed(4)}`,
        isVerified: true,
        isActive: true,
        totalVisits: (index + 1) * 3,
        conversionRate: Number((0.25 + (index % 5) * 0.08).toFixed(2)),
        stakeAmount: 0.1,
      },
      create: {
        wallet: makeWallet(index),
        name,
        description: `Demo merchant for DePokemonGo seed set #${index + 1}`,
        category,
        lat: coords.lat,
        lng: coords.lng,
        locationHash: `${coords.lat.toFixed(4)}:${coords.lng.toFixed(4)}`,
        isVerified: true,
        isActive: true,
        totalVisits: (index + 1) * 3,
        conversionRate: Number((0.25 + (index % 5) * 0.08).toFixed(2)),
        stakeAmount: 0.1,
      },
    });

    await prisma.quest.upsert({
      where: { id: `demo-quest-${index + 1}` },
      update: {
        merchantId: merchant.id,
        title: `Visit ${name}`,
        description: `Check in and complete a reward quest at ${name}.`,
        rewardAmount: Number((0.4 + (index % 4) * 0.15).toFixed(2)),
        rewardToken: "USDC",
        xpReward: 10 + (index % 4) * 5,
        minSpend: index % 3 === 0 ? 5 : 0,
        maxClaims: 100,
        questType: index % 4 === 0 ? QuestType.SPONSORED : QuestType.PURCHASE,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        isActive: true,
      },
      create: {
        id: `demo-quest-${index + 1}`,
        merchantId: merchant.id,
        title: `Visit ${name}`,
        description: `Check in and complete a reward quest at ${name}.`,
        rewardAmount: Number((0.4 + (index % 4) * 0.15).toFixed(2)),
        rewardToken: "USDC",
        xpReward: 10 + (index % 4) * 5,
        minSpend: index % 3 === 0 ? 5 : 0,
        maxClaims: 100,
        claimedCount: 0,
        questType: index % 4 === 0 ? QuestType.SPONSORED : QuestType.PURCHASE,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        isActive: true,
      },
    });
  }

  console.log("Seeded 50 demo merchants and quests.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
