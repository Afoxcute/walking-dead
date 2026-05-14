import type { PublicClient } from "viem";
import { GAME_ABI, GAME_CONTRACT_ADDRESS } from "./config";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export type WriteContractAsyncFn = (args: {
  address: `0x${string}`;
  abi: typeof GAME_ABI;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  gas?: bigint;
}) => Promise<`0x${string}`>;

function notifyTxError(message: string) {
  window.dispatchEvent(new CustomEvent("ovs-wallet-error", { detail: { message } }));
  if (message) alert(message);
}

export function createGameWindowApi(deps: {
  address?: `0x${string}`;
  publicClient: PublicClient | null | undefined;
  writeContractAsync: WriteContractAsyncFn;
  waitForReceipt: (hash: `0x${string}`) => Promise<unknown | null>;
}) {
  const { address, publicClient, writeContractAsync, waitForReceipt } = deps;
  const game = GAME_CONTRACT_ADDRESS;

  const read = async (functionName: string, args: readonly unknown[] = []) => {
    if (!publicClient) return undefined;
    return publicClient.readContract({
      address: game,
      abi: GAME_ABI,
      functionName: functionName as never,
      args: args as never,
    });
  };

  const estimateGas = async (p: { functionName: string; args?: readonly unknown[]; value?: bigint }) => {
    if (!publicClient || !address) return undefined;
    try {
      const g = await publicClient.estimateContractGas({
        account: address,
        address: game,
        abi: GAME_ABI,
        functionName: p.functionName as never,
        args: (p.args ?? []) as never,
        value: p.value ?? 0n,
      });
      return (g * 130n) / 100n;
    } catch {
      return undefined;
    }
  };

  const writeAndWait = async (
    params: { functionName: string; args?: readonly unknown[]; value?: bigint },
    onSuccess?: (receipt: unknown) => void,
    onError?: (receipt: unknown) => void
  ) => {
    try {
      if (!address) {
        onError?.(undefined);
        return;
      }
      const gas = await estimateGas({
        functionName: params.functionName,
        args: params.args,
        value: params.value,
      });
      const hash = await writeContractAsync({
        address: game,
        abi: GAME_ABI,
        functionName: params.functionName,
        args: (params.args ?? []) as never,
        value: params.value ?? 0n,
        ...(gas != null ? { gas } : {}),
      });
      const resp = await waitForReceipt(hash);
      if (!resp) onError?.(undefined);
      else if ((resp as { status?: string }).status === "success") onSuccess?.(resp);
      else onError?.(resp);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message) notifyTxError(message);
      onError?.(e);
    }
  };

  return {
    getTopListInfo: async (onSuccess?: (d: unknown) => void) => {
      try {
        const data = await read("getTopListInfo", []);
        if (data !== undefined) onSuccess?.(data);
      } catch (err) {
        console.error("Error getTopListInfo:", err);
      }
    },

    getPlayerAllAssets: async (onSuccess?: (d: unknown) => void) => {
      try {
        if (!address) return;
        const data = await read("getPlayerAllAssets", [address]);
        if (data !== undefined) onSuccess?.(data);
      } catch (err) {
        console.error("Error getPlayerAllAssets:", err);
      }
    },

    getPlayerLastLotteryResult: async (onSuccess?: (d: unknown) => void) => {
      try {
        if (!address) return;
        const data = await read("getPlayerLastLotteryResult", [address]);
        if (data !== undefined) onSuccess?.(data);
      } catch (err) {
        console.error("Error getPlayerLastLotteryResult:", err);
      }
    },

    getPlayerAllWeaponInfo: async (onSuccess?: (d: unknown) => void) => {
      try {
        if (!address) return;
        const data = await read("getPlayerAllWeaponInfo", [address]);
        if (data !== undefined) onSuccess?.(data);
      } catch (err) {
        console.error("Error getPlayerAllWeaponInfo:", err);
      }
    },

    getPlayerAllSkinInfo: async (onSuccess?: (d: unknown) => void) => {
      try {
        if (!address) return;
        const data = await read("getPlayerAllSkinInfo", [address]);
        if (data !== undefined) onSuccess?.(data);
      } catch (err) {
        console.error("Error getPlayerAllSkinInfo:", err);
      }
    },

    getClaimableNative: async (onSuccess?: (wei: bigint) => void) => {
      try {
        if (!address) return;
        const v = await read("claimableNative", [address]);
        if (v !== undefined) onSuccess?.(BigInt(String(v)));
      } catch (err) {
        console.error("Error getClaimableNative:", err);
      }
    },

    startGame: async (onSuccess?: (r: unknown) => void, onError?: (r: unknown) => void) => {
      await writeAndWait({ functionName: "startGame", value: BigInt(10 ** 16) }, onSuccess, onError);
    },

    gameOver: async (
      time: bigint,
      kills: bigint,
      onSuccess?: (r: unknown) => void,
      onError?: (r: unknown) => void,
      proofHex?: string
    ) => {
      try {
        if (!address || !publicClient) {
          onError?.(undefined);
          return;
        }
        const verifier = (await read("gameOverVerifier", [])) as `0x${string}` | undefined;
        const needsProof =
          typeof verifier === "string" && verifier.toLowerCase() !== ZERO.toLowerCase();

        let proofData: `0x${string}` = "0x";
        if (proofHex && proofHex.length > 2) {
          proofData = (proofHex.startsWith("0x") ? proofHex : `0x${proofHex}`) as `0x${string}`;
        }

        if (needsProof && proofData.length <= 2) {
          const msg =
            "This deployment requires a ZK proof to submit scores (gameOverVerifier is set). " +
            "Pass proof as the 5th argument to window.gameOver(time, kills, onSuccess, onError, proofHex), or clear the verifier on the contract.";
          notifyTxError(msg);
          onError?.("proof_required");
          return;
        }

        const gas = await estimateGas({
          functionName: needsProof ? "gameOverWithProof" : "gameOver",
          args: needsProof ? [time, kills, proofData] : [time, kills],
          value: 0n,
        });
        const hash = await writeContractAsync({
          address: game,
          abi: GAME_ABI,
          functionName: needsProof ? "gameOverWithProof" : "gameOver",
          args: (needsProof ? [time, kills, proofData] : [time, kills]) as never,
          value: 0n,
          ...(gas != null ? { gas } : {}),
        });
        const resp = await waitForReceipt(hash);
        if (!resp) onError?.(undefined);
        else if ((resp as { status?: string }).status === "success") onSuccess?.(resp);
        else onError?.(resp);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (message) notifyTxError(message);
        onError?.(e);
      }
    },

    buyOrUpgradeSkin: async (id: bigint, onSuccess?: (r: unknown) => void, onError?: (r: unknown) => void) => {
      await writeAndWait({ functionName: "buyOrUpgradeSkin", args: [id], value: 0n }, onSuccess, onError);
    },

    buyOrUpgradeWeapon: async (id: bigint, onSuccess?: (r: unknown) => void, onError?: (r: unknown) => void) => {
      await writeAndWait({ functionName: "buyOrUpgradeWeapon", args: [id], value: 0n }, onSuccess, onError);
    },

    requestLottery: async (onSuccess?: (r: unknown) => void, onError?: (r: unknown) => void) => {
      await writeAndWait(
        { functionName: "requestLottery", args: [], value: BigInt(4 * 10 ** 16) },
        onSuccess,
        onError
      );
    },

    mintGold: async (onSuccess?: (r: unknown) => void, onError?: (r: unknown) => void) => {
      await writeAndWait({ functionName: "mintGold", args: [], value: BigInt(10 ** 16) }, onSuccess, onError);
    },

    reLive: async (onSuccess?: (r: unknown) => void, onError?: (r: unknown) => void) => {
      await writeAndWait({ functionName: "reLive", args: [], value: BigInt(5 * 10 ** 16) }, onSuccess, onError);
    },

    claimNativeRewards: async (onSuccess?: (r: unknown) => void, onError?: (r: unknown) => void) => {
      await writeAndWait({ functionName: "claimNativeRewards", args: [], value: 0n }, onSuccess, onError);
    },
  };
}
