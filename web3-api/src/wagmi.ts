import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { defineChain } from "viem";
import {
  JSON_RPC_PROVIDER,
  SOMNIA_TESTNET_CHAIN_ID,
} from "./config";

export const somniaTestnet = defineChain({
  id: SOMNIA_TESTNET_CHAIN_ID,
  name: "Somnia Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "STT",
    symbol: "STT",
  },
  rpcUrls: {
    default: {
      http: [JSON_RPC_PROVIDER],
    },
  },
  blockExplorers: {
    default: {
      name: "Shannon Explorer",
      url: "https://shannon-explorer.somnia.network/",
    },
  },
  contracts: {
    multicall3: {
      address: "0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223",
      blockCreated: 0,
    },
  },
});

export const config = getDefaultConfig({
  appName: "Onchain Vampire Survivors",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0",
  chains: [somniaTestnet],
  transports: {
    [somniaTestnet.id]: http(JSON_RPC_PROVIDER),
  },
  ssr: false,
});
