import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { ConnectButton, useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { GAME_ABI, GAME_CONTRACT_ADDRESS } from "./config";
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
import { tryEnsureAutoSoliditySubscription } from "./autoOnchainReactivity";
import { createGameWindowApi, type WriteContractAsyncFn } from "./gameWindowApi";

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

  useEffect(() => {
    if (!isConnected || !address || !publicClient || !walletClient?.data) return;
    let cancelled = false;
    void tryEnsureAutoSoliditySubscription({
      address: address as `0x${string}`,
      publicClient,
      wallet: walletClient.data as Parameters<typeof createReactivitySDK>[0]["wallet"],
    }).then((r) => {
      if (cancelled) return;
      if (r.status === "ok") {
        console.info("[reactivity] Auto on-chain subscription confirmed:", r.txHash);
      } else if (r.status === "error") {
        console.warn("[reactivity] Auto on-chain subscription failed:", r.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, publicClient, walletClient?.data]);

  const waitForReceipt = useCallback(
    async (hash: `0x${string}`) => {
      if (!publicClient) return null;
      return publicClient.waitForTransactionReceipt({ hash });
    },
    [publicClient]
  );

  const gameApi = useMemo(
    () =>
      createGameWindowApi({
        address: address as `0x${string}` | undefined,
        publicClient: publicClient ?? undefined,
        writeContractAsync: writeContractAsync as unknown as WriteContractAsyncFn,
        waitForReceipt,
      }),
    [address, publicClient, writeContractAsync, waitForReceipt]
  );

  useEffect(() => {
    window.getTopListInfo = gameApi.getTopListInfo;
    window.getPlayerAllAssets = gameApi.getPlayerAllAssets;
    window.getPlayerLastLotteryResult = gameApi.getPlayerLastLotteryResult;
    window.getPlayerAllWeaponInfo = gameApi.getPlayerAllWeaponInfo;
    window.getPlayerAllSkinInfo = gameApi.getPlayerAllSkinInfo;
    window.getClaimableNative = gameApi.getClaimableNative;
    window.startGame = gameApi.startGame;
    window.gameOver = gameApi.gameOver;
    window.buyOrUpgradeSkin = gameApi.buyOrUpgradeSkin;
    window.buyOrUpgradeWeapon = gameApi.buyOrUpgradeWeapon;
    window.requestLottery = gameApi.requestLottery;
    window.mintGold = gameApi.mintGold;
    window.reLive = gameApi.reLive;
    window.claimNativeRewards = gameApi.claimNativeRewards;
    return () => {
      const w = window as unknown as Record<string, unknown>;
      delete w.getTopListInfo;
      delete w.getPlayerAllAssets;
      delete w.getPlayerLastLotteryResult;
      delete w.getPlayerAllWeaponInfo;
      delete w.getPlayerAllSkinInfo;
      delete w.getClaimableNative;
      delete w.startGame;
      delete w.gameOver;
      delete w.buyOrUpgradeSkin;
      delete w.buyOrUpgradeWeapon;
      delete w.requestLottery;
      delete w.mintGold;
      delete w.reLive;
      delete w.claimNativeRewards;
    };
  }, [gameApi]);

  useEffect(() => {
    if (!publicClient || !address) {
      window.gameOverVerifierAddress = undefined;
      return;
    }
    let cancelled = false;
    void publicClient
      .readContract({
        address: GAME_CONTRACT_ADDRESS,
        abi: GAME_ABI,
        functionName: "gameOverVerifier",
        args: [],
      })
      .then((v: unknown) => {
        if (!cancelled) window.gameOverVerifierAddress = v as `0x${string}`;
      })
      .catch(() => {
        if (!cancelled) window.gameOverVerifierAddress = undefined;
      });
    return () => {
      cancelled = true;
    };
  }, [publicClient, address]);

  const onConnectButtonClick = useCallback(() => {
    openConnectModal?.();
  }, [openConnectModal]);

  const onConnectedButtonClick = useCallback(() => {
    if (isConnected && openAccountModal) {
      openAccountModal();
    } else {
      openConnectModal?.();
    }
  }, [isConnected, openAccountModal, openConnectModal]);

  const parseChainHash = useCallback((_chainHash: unknown) => {
    return "Somnia Testnet";
  }, []);

  useEffect(() => {
    window.onConnectButtonClick = onConnectButtonClick;
    window.onConnectedButtonClick = onConnectedButtonClick;
    window.parseChainHash = parseChainHash;
    return () => {
      delete (window as unknown as Record<string, unknown>).onConnectButtonClick;
      delete (window as unknown as Record<string, unknown>).onConnectedButtonClick;
      delete (window as unknown as Record<string, unknown>).parseChainHash;
    };
  }, [onConnectButtonClick, onConnectedButtonClick, parseChainHash]);

  useEffect(() => {
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
    return () => {
      const w = window as unknown as Record<string, unknown>;
      delete w.reactivitySubscribeOffChain;
      delete w.reactivityUnsubscribe;
      delete w.reactivityCreateSoliditySubscription;
      delete w.reactivityGetSubscriptionInfo;
      delete w.reactivityCancelSubscription;
      delete w.reactivityCreateBlockTickSubscription;
      delete w.reactivityScheduleCronJob;
    };
  }, [publicClient, walletClient?.data]);

  return (
    <main>
      <div style={{ display: "none" }}>
        <ConnectButton />
        {isConnected && address && <p>Somnia Testnet Account: {address}</p>}
      </div>
    </main>
  );
}
