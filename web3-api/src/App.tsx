import { useEffect, useRef } from "react";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { ConnectButton, useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { ethers } from "ethers";
import {
  GAME_ABI,
  GAME_CONTRACT_ADDRESS,
  JSON_RPC_PROVIDER,
} from "./config";
import {
  createReactivitySDK,
  createReactivityPublicClientWebSocket,
  subscribeOffChain,
  subscribeOffChainWildcard,
  createSoliditySubscription,
  getSubscriptionInfo,
  cancelSoliditySubscription,
  createOnchainBlockTickSubscription,
  scheduleOnchainCronJob,
} from "./reactivity";

export function App() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const reactivityUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      window.isNetworkConnected = true;
      window.userAccount = address;
    } else {
      window.isNetworkConnected = false;
      window.userAccount = undefined;
    }
  }, [isConnected, address]);

  const onConnectButtonClick = () => {
    openConnectModal?.();
  };

  const onConnectedButtonClick = () => {
    if (isConnected && openAccountModal) {
      openAccountModal();
    } else {
      openConnectModal?.();
    }
  };

  window.onConnectButtonClick = onConnectButtonClick;
  window.onConnectedButtonClick = onConnectedButtonClick;

  const getGameContract = async () => {
    const provider = new ethers.JsonRpcProvider(JSON_RPC_PROVIDER);
    const contract = new ethers.Contract(
      GAME_CONTRACT_ADDRESS,
      GAME_ABI,
      provider
    );
    return contract;
  };

  const parseChainHash = (_chainHash: unknown) => {
    return "Somnia Testnet";
  };

  window.parseChainHash = parseChainHash;

  const waitForReceipt = async (hash: `0x${string}`) => {
    if (!publicClient) return null;
    return publicClient.waitForTransactionReceipt({ hash });
  };

  const getTopListInfo = async (onSuccess?: (receipt: unknown) => void) => {
    try {
      const contract = await getGameContract();
      const data = await contract.getTopListInfo();
      onSuccess?.(data);
    } catch (err) {
      console.error("Error getTopListInfo:", err);
    }
  };

  const getPlayerAllAssets = async (onSuccess?: (receipt: unknown) => void) => {
    try {
      const contract = await getGameContract();
      if (address) {
        const data = await contract.getPlayerAllAssets(address);
        onSuccess?.(data);
      }
    } catch (err) {
      console.error("Error getPlayerAllAssets:", err);
    }
  };

  const getPlayerLastLotteryResult = async (
    onSuccess?: (receipt: unknown) => void
  ) => {
    try {
      const contract = await getGameContract();
      if (address) {
        const data = await contract.getPlayerLastLotteryResult(address);
        onSuccess?.(data);
      }
    } catch (err) {
      console.error("Error getPlayerLastLotteryResult:", err);
    }
  };

  const getPlayerAllWeaponInfo = async (
    onSuccess?: (receipt: unknown) => void
  ) => {
    try {
      const contract = await getGameContract();
      if (address) {
        const data = await contract.getPlayerAllWeaponInfo(address);
        onSuccess?.(data);
      }
    } catch (err) {
      console.error("Error getPlayerAllWeaponInfo:", err);
    }
  };

  const getPlayerAllSkinInfo = async (
    onSuccess?: (receipt: unknown) => void
  ) => {
    try {
      const contract = await getGameContract();
      if (address) {
        const data = await contract.getPlayerAllSkinInfo(address);
        onSuccess?.(data);
      }
    } catch (err) {
      console.error("Error getPlayerAllSkinInfo:", err);
    }
  };

  window.getTopListInfo = getTopListInfo;
  window.getPlayerAllAssets = getPlayerAllAssets;
  window.getPlayerLastLotteryResult = getPlayerLastLotteryResult;
  window.getPlayerAllWeaponInfo = getPlayerAllWeaponInfo;
  window.getPlayerAllSkinInfo = getPlayerAllSkinInfo;

  const startGame = async (
    onSuccess?: (receipt: unknown) => void,
    onError?: (receipt: unknown) => void
  ) => {
    try {
      if (address) {
        const hash = await writeContractAsync({
          address: GAME_CONTRACT_ADDRESS as `0x${string}`,
          abi: GAME_ABI,
          functionName: "startGame",
          value: BigInt(10 ** 16),
          gas: BigInt(2_500_000),
        });
        const resp = await waitForReceipt(hash);
        if (resp) {
          resp.status === "success" ? onSuccess?.(resp) : onError?.(resp);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message != null && message !== "") {
        alert(message);
      }
    }
  };

  const gameOver = async (
    time: bigint,
    kills: bigint,
    onSuccess?: (receipt: unknown) => void,
    onError?: (receipt: unknown) => void
  ) => {
    try {
      if (!address) {
        onError?.(undefined);
        return;
      }
      const hash = await writeContractAsync({
        address: GAME_CONTRACT_ADDRESS as `0x${string}`,
        abi: GAME_ABI,
        functionName: "gameOver",
        args: [time, kills],
        value: BigInt(0),
        gas: BigInt(3_000_000),
      });
      const resp = await waitForReceipt(hash);
      if (resp) {
        resp.status === "success" ? onSuccess?.(resp) : onError?.(resp);
      } else {
        onError?.(undefined);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message != null && message !== "") {
        alert(message);
      }
      onError?.(e);
    }
  };

  const buyOrUpgradeSkin = async (
    id: bigint,
    onSuccess?: (receipt: unknown) => void,
    onError?: (receipt: unknown) => void
  ) => {
    try {
      if (address) {
        const hash = await writeContractAsync({
          address: GAME_CONTRACT_ADDRESS as `0x${string}`,
          abi: GAME_ABI,
          functionName: "buyOrUpgradeSkin",
          args: [id],
          value: BigInt(0),
        });
        const resp = await waitForReceipt(hash);
        if (resp) {
          resp.status === "success" ? onSuccess?.(resp) : onError?.(resp);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message != null && message !== "") {
        alert(message);
      }
    }
  };

  const buyOrUpgradeWeapon = async (
    id: bigint,
    onSuccess?: (receipt: unknown) => void,
    onError?: (receipt: unknown) => void
  ) => {
    try {
      if (address) {
        const hash = await writeContractAsync({
          address: GAME_CONTRACT_ADDRESS as `0x${string}`,
          abi: GAME_ABI,
          functionName: "buyOrUpgradeWeapon",
          args: [id],
          value: BigInt(0),
        });
        const resp = await waitForReceipt(hash);
        if (resp) {
          resp.status === "success" ? onSuccess?.(resp) : onError?.(resp);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message != null && message !== "") {
        alert(message);
      }
    }
  };

  const requestLottery = async (
    onSuccess?: (receipt: unknown) => void,
    onError?: (receipt: unknown) => void
  ) => {
    try {
      if (address) {
        const hash = await writeContractAsync({
          address: GAME_CONTRACT_ADDRESS as `0x${string}`,
          abi: GAME_ABI,
          functionName: "requestLottery",
          args: [],
          value: BigInt(4 * 10 ** 16),
        });
        const resp = await waitForReceipt(hash);
        if (resp) {
          resp.status === "success" ? onSuccess?.(resp) : onError?.(resp);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message != null && message !== "") {
        alert(message);
      }
    }
  };

  const mintGold = async (
    onSuccess?: (receipt: unknown) => void,
    onError?: (receipt: unknown) => void
  ) => {
    try {
      if (address) {
        const hash = await writeContractAsync({
          address: GAME_CONTRACT_ADDRESS as `0x${string}`,
          abi: GAME_ABI,
          functionName: "mintGold",
          args: [],
          value: BigInt(10 ** 16),
        });
        const resp = await waitForReceipt(hash);
        if (resp) {
          resp.status === "success" ? onSuccess?.(resp) : onError?.(resp);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message != null && message !== "") {
        alert(message);
      }
    }
  };

  const reLive = async (
    onSuccess?: (receipt: unknown) => void,
    onError?: (receipt: unknown) => void
  ) => {
    try {
      if (address) {
        const hash = await writeContractAsync({
          address: GAME_CONTRACT_ADDRESS as `0x${string}`,
          abi: GAME_ABI,
          functionName: "reLive",
          args: [],
          value: BigInt(5 * 10 ** 16),
        });
        const resp = await waitForReceipt(hash);
        if (resp) {
          resp.status === "success" ? onSuccess?.(resp) : onError?.(resp);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message != null && message !== "") {
        alert(message);
      }
    }
  };

  window.startGame = startGame;
  window.gameOver = gameOver;
  window.buyOrUpgradeSkin = buyOrUpgradeSkin;
  window.buyOrUpgradeWeapon = buyOrUpgradeWeapon;
  window.requestLottery = requestLottery;
  window.mintGold = mintGold;
  window.reLive = reLive;

  // Somnia reactivity: off-chain and on-chain subscription API for Cocos / game
  window.reactivitySubscribeOffChain = async (opts) => {
    try {
      reactivityUnsubscribeRef.current?.();
      reactivityUnsubscribeRef.current = null;
      const wsClient = createReactivityPublicClientWebSocket();
      const onData = (data: unknown) => {
        opts.onData(data);
        window.onReactivityData?.(data);
      };
      const sub = opts.wildcard
        ? await subscribeOffChainWildcard(wsClient, {
            ethCalls: [],
            onData,
            onError: opts.onError,
          })
        : await subscribeOffChain(wsClient, {
            ethCalls: [],
            onData,
            onError: opts.onError,
            eventTopics: opts.eventTopics,
          });
      if (sub) {
        reactivityUnsubscribeRef.current = sub.unsubscribe;
        return true;
      }
      return false;
    } catch (e) {
      opts.onError?.(e);
      return false;
    }
  };
  window.reactivityUnsubscribe = () => {
    reactivityUnsubscribeRef.current?.();
    reactivityUnsubscribeRef.current = null;
  };
  window.reactivityCreateSoliditySubscription = async (data) => {
    const wallet = walletClient?.data;
    if (!publicClient || !wallet?.account) {
      return { error: "Wallet not connected" };
    }
    try {
      const sdk = createReactivitySDK({
        public: publicClient,
        wallet: wallet as Parameters<typeof createReactivitySDK>[0]["wallet"],
      });
      const txHash = await createSoliditySubscription(sdk, {
        handlerContractAddress: data.handlerContractAddress as `0x${string}`,
        priorityFeePerGas: data.priorityFeePerGas,
        maxFeePerGas: data.maxFeePerGas,
        gasLimit: data.gasLimit,
        isGuaranteed: data.isGuaranteed,
        isCoalesced: data.isCoalesced,
        eventTopics: data.eventTopics,
        emitter: data.emitter as `0x${string}` | undefined,
      });
      if (txHash instanceof Error) return { error: txHash.message };
      return txHash;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: message };
    }
  };
  window.reactivityGetSubscriptionInfo = async (subscriptionId) => {
    if (!publicClient) return undefined;
    const sdk = createReactivitySDK({ public: publicClient });
    const info = await getSubscriptionInfo(sdk, subscriptionId);
    return info instanceof Error ? undefined : info;
  };
  window.reactivityCancelSubscription = async (subscriptionId) => {
    const wallet = walletClient?.data;
    if (!publicClient || !wallet?.account) {
      return { error: "Wallet not connected" };
    }
    try {
      const sdk = createReactivitySDK({
        public: publicClient,
        wallet: wallet as Parameters<typeof createReactivitySDK>[0]["wallet"],
      });
      const txHash = await cancelSoliditySubscription(sdk, subscriptionId);
      if (txHash instanceof Error) return { error: txHash.message };
      return txHash;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: message };
    }
  };
  window.reactivityCreateBlockTickSubscription = async (data) => {
    const wallet = walletClient?.data;
    if (!publicClient || !wallet?.account) {
      return { error: "Wallet not connected" };
    }
    try {
      const sdk = createReactivitySDK({
        public: publicClient,
        wallet: wallet as Parameters<typeof createReactivitySDK>[0]["wallet"],
      });
      const txHash = await createOnchainBlockTickSubscription(sdk, {
        handlerContractAddress: data.handlerContractAddress as `0x${string}`,
        blockNumber: data.blockNumber,
        handlerFunctionSelector: data.handlerFunctionSelector,
        priorityFeePerGas: data.priorityFeePerGas,
        maxFeePerGas: data.maxFeePerGas,
        gasLimit: data.gasLimit,
        isGuaranteed: data.isGuaranteed,
        isCoalesced: data.isCoalesced,
      });
      if (txHash instanceof Error) return { error: txHash.message };
      return txHash;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: message };
    }
  };
  window.reactivityScheduleCronJob = async (data) => {
    const wallet = walletClient?.data;
    if (!publicClient || !wallet?.account) {
      return { error: "Wallet not connected" };
    }
    try {
      const sdk = createReactivitySDK({
        public: publicClient,
        wallet: wallet as Parameters<typeof createReactivitySDK>[0]["wallet"],
      });
      const txHash = await scheduleOnchainCronJob(sdk, {
        timestampMs: data.timestampMs,
        handlerContractAddress: data.handlerContractAddress as `0x${string}`,
        handlerFunctionSelector: data.handlerFunctionSelector,
        priorityFeePerGas: data.priorityFeePerGas,
        maxFeePerGas: data.maxFeePerGas,
        gasLimit: data.gasLimit,
        isGuaranteed: data.isGuaranteed,
        isCoalesced: data.isCoalesced,
      });
      if (txHash instanceof Error) return { error: txHash.message };
      return txHash;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: message };
    }
  };

  return (
    <main>
      <div style={{ display: "none" }}>
        <ConnectButton />
        {isConnected && address && (
          <p>Somnia Testnet Account: {address}</p>
        )}
      </div>
    </main>
  );
}
