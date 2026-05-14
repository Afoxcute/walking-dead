/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAME_CONTRACT_ADDRESS?: string;
  readonly VITE_SOMNIA_HTTP_RPC?: string;
  readonly VITE_SOMNIA_WSS_RPC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
