const hre = require("hardhat");

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

  console.log("\nNext steps:");
  console.log("1. Update web3-api .env or config: GAME_CONTRACT_ADDRESS =", address);
  console.log("2. (Optional) Create Somnia reactivity subscription - see contracts/REACTIVITY.md");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
