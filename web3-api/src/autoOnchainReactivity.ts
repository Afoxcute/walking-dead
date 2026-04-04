/**
 * Auto-create a Somnia on-chain reactivity subscription for the connected wallet
 * so ZKGameClient's handler runs on GameLogEvent without a manual script.
 * Gates auto-create on **≥1 STT** native balance (client-side); Somnia may still enforce stricter rules on-chain. Deduplicated via localStorage.
 *
 * Note: Each wallet that completes this flow owns a separate on-chain subscription. Many
 * subscribers matching the same event each incur a handler invocation when that event fires.
 * For a single global callback, prefer one funded wallet or an indexer instead of per-player subs.
 */
import { parseEther, parseGwei, toEventSelector } from "viem";
import type { PublicClient } from "viem";
import { GAME_CONTRACT_ADDRESS } from "./config";
import { createReactivitySDK, createSoliditySubscription } from "./reactivity";

const STORAGE_PREFIX = "onchainVsReactivityAutoSub_v1";

/** Minimum native balance before we attempt auto subscription (avoids pointless txs). */
const MIN_OWNER_BALANCE_WEI = parseEther("1");

const GAME_LOG_TOPIC = toEventSelector(
  "GameLogEvent(uint256,uint256,address,uint256,uint256)"
);

export type AutoSubResult =
  | { status: "skipped"; reason: string }
  | { status: "ok"; txHash: `0x${string}` }
  | { status: "error"; message: string };

function storageKey(address: string): string {
  return `${STORAGE_PREFIX}_${address.toLowerCase()}`;
}

const inflight = new Map<string, Promise<AutoSubResult>>();

/**
 * Creates one GameLogEvent → handler subscription per wallet (emitter + topic filtered).
 * Safe to call on every connect; no-ops if already recorded in localStorage or balance too low.
 */
export async function tryEnsureAutoSoliditySubscription(options: {
  address: `0x${string}`;
  publicClient: PublicClient;
  wallet: unknown;
}): Promise<AutoSubResult> {
  const { address, publicClient, wallet } = options;
  const addrKey = address.toLowerCase();

  const existing = inflight.get(addrKey);
  if (existing) return existing;

  const work = doEnsureAutoSoliditySubscription(address, publicClient, wallet).finally(() => {
    inflight.delete(addrKey);
  });
  inflight.set(addrKey, work);
  return work;
}

async function doEnsureAutoSoliditySubscription(
  address: `0x${string}`,
  publicClient: PublicClient,
  wallet: unknown
): Promise<AutoSubResult> {
  if (typeof localStorage !== "undefined" && localStorage.getItem(storageKey(address)) === "1") {
    return { status: "skipped", reason: "already_created" };
  }

  try {
    const balance = await publicClient.getBalance({ address });
    if (balance < MIN_OWNER_BALANCE_WEI) {
      return {
        status: "skipped",
        reason: "below_min_stt",
      };
    }
  } catch {
    return { status: "skipped", reason: "balance_read_failed" };
  }

  const game = GAME_CONTRACT_ADDRESS as `0x${string}`;
  const sdk = createReactivitySDK({
    public: publicClient as Parameters<typeof createReactivitySDK>[0]["public"],
    wallet,
  });

  const txHash = await createSoliditySubscription(sdk, {
    handlerContractAddress: game,
    emitter: game,
    eventTopics: [GAME_LOG_TOPIC],
    priorityFeePerGas: parseGwei("2"),
    maxFeePerGas: parseGwei("10"),
    gasLimit: 500_000n,
    isGuaranteed: true,
    isCoalesced: false,
  });

  if (txHash instanceof Error) {
    return { status: "error", message: txHash.message };
  }

  let receipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "error", message: `receipt: ${message}` };
  }

  if (receipt.status !== "success") {
    return { status: "error", message: "subscription transaction reverted" };
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(storageKey(address), "1");
  }

  return { status: "ok", txHash };
}

/** Clear dedupe flag (e.g. after canceling subscription on-chain). */
export function clearAutoSoliditySubscriptionFlag(address: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(storageKey(address));
  }
}
