/**
 * Canonical ABI and address are maintained in `web3-api/src/config.ts` (ZKGameClient).
 * Re-export here so Cocos tooling / future direct reads stay aligned with the wallet bundle.
 */
export { GAME_ABI as GameABI, GAME_CONTRACT_ADDRESS } from "../../../../web3-api/src/config";
