/**
 * Standalone script to call startGame + gameOver on the deployed ZKGameClient.
 * Use this to see if failures are at the contract/RPC level or the game level.
 *
 * Required order (contract enforces this):
 *   1. startGame() — pay 0.01 STT, creates an active game log for msg.sender.
 *   2. gameOver(time, kills) — end that run; reverts with "Call startGame first" if (1) was not done.
 * The game/frontend must call startGame() when the player starts a run, then gameOver() when they finish.
 *
 * Prerequisites:
 *   - .env with PRIVATE_KEY (and optionally RPC_URL, GAME_CONTRACT_ADDRESS)
 *   - Account must have some STT on Somnia Testnet
 *
 * Usage:
 *   npm run call-gameover
 *   npx hardhat run scripts/call-gameover.js --network somniaTestnet
 *
 * Optional env:
 *   GAME_CONTRACT_ADDRESS  default: 0x468D2FCd8EBc64B885b3e8573A6e5eCE4687abAF
 *   GAMEOVER_TIME=60       (default 60)
 *   GAMEOVER_KILLS=10      (default 10)
 *   SKIP_START=1           (skip startGame; gameOver will revert if no active game)
 */

try {
  require("dotenv").config();
} catch (_) {}

const path = require("path");
const fs = require("fs");
const DEPLOYMENTS_PATH = path.join(__dirname, "..", "deployments", "somnia.json");
const DEFAULT_GAME_ADDRESS = "0x468D2FCd8EBc64B885b3e8573A6e5eCE4687abAF";

const GAMEOVER_TIME = parseInt(process.env.GAMEOVER_TIME || "60", 10);
const GAMEOVER_KILLS = parseInt(process.env.GAMEOVER_KILLS || "10", 10);
const SKIP_START = process.env.SKIP_START === "1" || process.env.SKIP_START === "true";

function getGameAddress() {
  if (process.env.GAME_CONTRACT_ADDRESS) return process.env.GAME_CONTRACT_ADDRESS;
  try {
    if (fs.existsSync(DEPLOYMENTS_PATH)) {
      const j = JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf8"));
      if (j.ZKGameClient) return j.ZKGameClient;
    }
  } catch (_) {}
  return DEFAULT_GAME_ADDRESS;
}

async function main() {
  const hre = require("hardhat");
  const GAME_ADDRESS = getGameAddress();
  const [signer] = await hre.ethers.getSigners();
  if (!signer) {
    console.error("No signer. Set PRIVATE_KEY in .env");
    process.exit(1);
  }

  const artifact = require("../artifacts/contracts/Contract.sol/ZKGameClient.json");
  const game = new hre.ethers.Contract(GAME_ADDRESS, artifact.abi, signer);

  console.log("Network: somniaTestnet (Somnia Testnet)");
  console.log("Account:", signer.address);
  console.log("Contract:", GAME_ADDRESS);
  console.log("gameOver(time, kills) =", GAMEOVER_TIME, GAMEOVER_KILLS);
  console.log("");

  let blockAfterStart = null;
  if (!SKIP_START) {
    console.log("Step 1: startGame() with 0.01 STT...");
    try {
      const tx1 = await game.startGame({ value: hre.ethers.parseEther("0.01"), gasLimit: 2_500_000 });
      console.log("  Tx hash:", tx1.hash);
      const rec1 = await tx1.wait();
      blockAfterStart = rec1.blockNumber;
      console.log("  Status:", rec1.status === 1 ? "success" : "reverted");
      if (rec1.status !== 1) {
        console.error("  startGame reverted. Check contract/state.");
        process.exit(1);
      }
      console.log("  Block:", rec1.blockNumber);
    } catch (e) {
      console.error("  startGame failed:", e.message || e);
      if (e.data) console.error("  Data:", e.data);
      if (e.reason) console.error("  Reason:", e.reason);
      process.exit(1);
    }
    console.log("");
  }

  // Debug: read state so we know why gameOver might revert (RPC often returns empty revert data)
  const logId = await game.playerLatestGameLogIdMap(signer.address);
  const log = await game.gameLogMap(logId);
  const logPlayer = (log && (log.player ?? log[2])) || ""; // struct: startTime, endTime, player, reLive, grade
  const match = (logPlayer || "").toLowerCase() === signer.address.toLowerCase();
  console.log("  State: logId =", logId.toString(), "| gameLogMap[logId].player =", logPlayer, "| match signer:", match);
  if (!match) {
    console.error("  => require(gameLogMap[logId].player == msg.sender) will fail. Call startGame first in this run.");
    process.exit(1);
  }

  console.log("Step 2: gameOver(" + GAMEOVER_TIME + ", " + GAMEOVER_KILLS + ")...");
  try {
    // Simulate at block after startGame so state is committed (some RPCs lag)
    const simOpts = { gasLimit: 3_000_000 };
    if (blockAfterStart != null) simOpts.blockTag = blockAfterStart;
    await game.gameOver.staticCall(
      BigInt(GAMEOVER_TIME),
      BigInt(GAMEOVER_KILLS),
      simOpts
    );
    console.log("  Simulation: OK");
  } catch (simErr) {
    const msg = simErr.reason || simErr.message || String(simErr);
    const data = simErr.data || (simErr.error && simErr.error.data);
    console.error("  Simulation reverted:", msg);
    if (data) console.error("  Revert data:", data);
    try {
      const iface = new hre.ethers.Interface(artifact.abi);
      const frag = iface.parseError(data);
      if (frag) console.error("  Parsed error:", frag.name, frag.args);
    } catch (_) {}
    console.log("");
    console.log("Result: gameOver would revert. State matched signer, so revert is likely inside pushDataToTopList (e.g. UEA at 0xea or top list update). Check contract.");
    process.exit(1);
  }

  try {
    const tx2 = await game.gameOver(
      BigInt(GAMEOVER_TIME),
      BigInt(GAMEOVER_KILLS),
      { gasLimit: 3_000_000 }
    );
    console.log("  Tx hash:", tx2.hash);
    const rec2 = await tx2.wait();
    console.log("  Status:", rec2.status === 1 ? "success" : "reverted");
    if (rec2.status !== 1) {
      console.error("  gameOver reverted on-chain. Check contract/state.");
      process.exit(1);
    }
    console.log("  Block:", rec2.blockNumber);
    console.log("");
    console.log("Result: contract-level gameOver succeeded. If the game still shows 'End game failed', the issue is on the game/frontend side (e.g. wallet, chain, or callback).");
  } catch (e) {
    console.error("  gameOver failed:", e.message || e);
    if (e.data) console.error("  Data:", e.data);
    if (e.reason) console.error("  Reason:", e.reason);
    if (e.error && e.error.data) console.error("  Error data:", e.error.data);
    console.log("");
    console.log("Result: contract-level gameOver failed. Fix contract/state or RPC (e.g. 'Call startGame first' => call startGame before gameOver).");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
