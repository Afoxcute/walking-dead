/** Vite env: optional overrides for public RPC + contract (no secrets). */
const addr = import.meta.env.VITE_GAME_CONTRACT_ADDRESS;
const http = import.meta.env.VITE_SOMNIA_HTTP_RPC;
const wss = import.meta.env.VITE_SOMNIA_WSS_RPC;

const DEFAULT_GAME = "0x468D2FCd8EBc64B885b3e8573A6e5eCE4687abAF" as const;
const DEFAULT_HTTP = "https://dream-rpc.somnia.network/";
const DEFAULT_WSS = "wss://dream-rpc.somnia.network/";

function isAddress(v: unknown): v is `0x${string}` {
  return typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);
}

export const GAME_CONTRACT_ADDRESS: `0x${string}` = isAddress(addr) ? addr : DEFAULT_GAME;

export const JSON_RPC_PROVIDER = typeof http === "string" && http.length > 0 ? http : DEFAULT_HTTP;

export const SOMNIA_WSS_RPC = typeof wss === "string" && wss.length > 0 ? wss : DEFAULT_WSS;
