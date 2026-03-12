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

  console.log("\nNext steps:");
  console.log("1. npm run call-gameover  (uses this address automatically)");
  console.log("2. Update web3-api/src/config.ts: GAME_CONTRACT_ADDRESS =", address);
  console.log("3. (Optional) Create Somnia reactivity subscription - see contracts/REACTIVITY.md");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
