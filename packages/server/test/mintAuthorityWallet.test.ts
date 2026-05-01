import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { env, repoRoot } from "../src/config/env";
import { getPikoMintAuthorityConfigError } from "../src/lib/mintAuthorityWallet";

const originalMintAuthorityWallet = env.PIKO_MINT_AUTHORITY_WALLET;
const originalNodeEnv = env.NODE_ENV;

test.afterEach(() => {
  env.PIKO_MINT_AUTHORITY_WALLET = originalMintAuthorityWallet;
  env.NODE_ENV = originalNodeEnv;
});

test("getPikoMintAuthorityConfigError requires explicit configuration", () => {
  env.PIKO_MINT_AUTHORITY_WALLET = "";
  env.NODE_ENV = "development";

  assert.equal(
    getPikoMintAuthorityConfigError(),
    "PIKO_MINT_AUTHORITY_WALLET is not configured",
  );
});

test("getPikoMintAuthorityConfigError blocks repo-hosted mint authority in production", () => {
  env.PIKO_MINT_AUTHORITY_WALLET = "./wallet/backend.json";
  env.NODE_ENV = "production";

  assert.equal(
    getPikoMintAuthorityConfigError(),
    "PIKO_MINT_AUTHORITY_WALLET must point outside the repository in production",
  );
});

test("getPikoMintAuthorityConfigError accepts an existing external wallet path", () => {
  const walletPath = path.join(os.tmpdir(), `mint-authority-${Date.now()}.json`);

  try {
    fs.writeFileSync(walletPath, "[]", "utf8");
    env.PIKO_MINT_AUTHORITY_WALLET = walletPath;
    env.NODE_ENV = "production";

    assert.equal(path.relative(repoRoot, walletPath).startsWith(".."), true);
    assert.equal(getPikoMintAuthorityConfigError(), null);
  } finally {
    if (fs.existsSync(walletPath)) {
      fs.unlinkSync(walletPath);
    }
  }
});
