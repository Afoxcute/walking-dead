const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEPLOYMENTS_PATH = path.join(__dirname, "..", "deployments", "somnia.json");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "STT");

  console.log("Compiling and deploying ZKGameClient...");
  const ZKGameClient = await hre.ethers.getContractFactory("ZKGameClient");
  const game = await ZKGameClient.deploy({
    gasLimit: 50_000_000,
  });
  console.log("Transaction sent. Waiting for confirmation (this may take 1–2 minutes)...");
  await game.waitForDeployment();
  const address = await game.getAddress();
  console.log("ZKGameClient deployed to:", address);

  const dir = path.dirname(DEPLOYMENTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DEPLOYMENTS_PATH, JSON.stringify({ ZKGameClient: address }, null, 2));
  console.log("Saved address to", DEPLOYMENTS_PATH);

  const CONFIG_PATH = path.join(__dirname, "..", "..", "web3-api", "src", "config.ts");
  if (fs.existsSync(CONFIG_PATH)) {
    let src = fs.readFileSync(CONFIG_PATH, "utf8");
    const next = src.replace(
      /export const GAME_CONTRACT_ADDRESS = "0x[a-fA-F0-9]{40}";/,
      `export const GAME_CONTRACT_ADDRESS = "${address}";`
    );
    if (next !== src) {
      fs.writeFileSync(CONFIG_PATH, next);
      console.log("Updated GAME_CONTRACT_ADDRESS in", CONFIG_PATH);
    } else {
      console.warn("Could not auto-patch GAME_CONTRACT_ADDRESS (pattern not found). Update web3-api/src/config.ts manually.");
    }
  } else {
    console.warn("web3-api/src/config.ts not found; skip auto-patch.");
  }

  console.log("\nNext steps:");
  console.log("1. Rebuild web3-api and copy wallet bundle: cd web3-api && yarn build && node ../scripts/copy-wallet-to-cocos.cjs");
  console.log("2. (Optional) npm run call-gameover  (uses deployments/somnia.json)");
  console.log("3. (Optional) Create Somnia reactivity subscription - see contracts/README.md");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
