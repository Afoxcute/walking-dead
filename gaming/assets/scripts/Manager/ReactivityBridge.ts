import Constant from "./Constant";

/** Topic0 for `GameLogEvent(uint256,uint256,address,uint256,uint256)` (matches ZKGameClient). */
const GAME_LOG_EVENT_TOPIC =
  "0x66286673e71e7c3a4012d09fbb56001733372c438dc9ba84cc4ca1ef2c84a2b0";

/**
 * Starts Somnia reactivity off-chain subscription (web3-api `window` API) when a wallet is connected.
 * Forwards chain pushes into `cc.game` as {@link Constant.E_SOMNIA_REACTIVITY}.
 */
export default class ReactivityBridge {
  private static _started = false;
  private static _starting = false;

  static tryStart(): void {
    if (typeof window === "undefined") return;
    const w = window as Window & {
      reactivitySubscribeOffChain?: (opts: {
        wildcard?: boolean;
        onData: (data: unknown) => void;
        eventTopics?: `0x${string}`[];
        onError?: (err: unknown) => void;
      }) => Promise<boolean>;
    };
    if (!w.reactivitySubscribeOffChain) return;
    if (ReactivityBridge._started || ReactivityBridge._starting) return;
    if (!w.userAccount) return;

    ReactivityBridge._starting = true;
    w
      .reactivitySubscribeOffChain({
        wildcard: false,
        eventTopics: [GAME_LOG_EVENT_TOPIC as `0x${string}`],
        onData: (data: unknown) => {
          cc.game.emit(Constant.E_GAME_LOGIC, {
            type: Constant.E_SOMNIA_REACTIVITY,
            data,
          });
        },
        onError: (err: unknown) => {
          cc.warn("[ReactivityBridge] off-chain subscribe error", err);
        },
      })
      .then((ok: boolean) => {
        ReactivityBridge._starting = false;
        if (ok) {
          ReactivityBridge._started = true;
        }
      })
      .catch(() => {
        ReactivityBridge._starting = false;
      });
  }

  static tryStop(): void {
    if (typeof window === "undefined") return;
    const w = window as Window & { reactivityUnsubscribe?: () => void };
    if (w.reactivityUnsubscribe) {
      w.reactivityUnsubscribe();
    }
    ReactivityBridge._started = false;
    ReactivityBridge._starting = false;
  }
}
