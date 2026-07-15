import { useEffect } from "react";
import { DailyChallengePanel } from "./DailyChallengePanel";
import { notifyGameStarted, notifyGameOver } from "./devvitBridge";

// ── Turntable reward table (must match gameDate.ts) ────────────────────────
const TURNTABLE_REWARDS = [
  { type: 0, num: 100 },  // Gold
  { type: 0, num: 50 },   // Gold
  { type: 1, num: 10 },   // Diamond
  { type: 0, num: 50 },   // Gold
  { type: 0, num: 150 },  // Gold
  { type: 3, num: 18 },   // Weapon (id 18)
  { type: 0, num: 200 },  // Gold
  { type: 0, num: 100 },  // Gold
  { type: 0, num: 50 },   // Gold
  { type: 1, num: 5 },    // Diamond
  { type: 0, num: 100 },  // Gold
  { type: 2, num: 1 },    // Skin (id 1)
];

function getUsername(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("user") || "Guest";
}

function storageKey(user: string, key: string): string {
  return `wvw_${user}_${key}`;
}

function getNum(user: string, key: string, def: number): number {
  const v = localStorage.getItem(storageKey(user, key));
  return v == null ? def : parseInt(v, 10);
}

function setNum(user: string, key: string, val: number): void {
  localStorage.setItem(storageKey(user, key), String(val));
}

function getJSON<T>(user: string, key: string, def: T): T {
  try {
    const v = localStorage.getItem(storageKey(user, key));
    return v == null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}

function setJSON(user: string, key: string, val: unknown): void {
  localStorage.setItem(storageKey(user, key), JSON.stringify(val));
}

type WeaponEntry = { id: number; level: number };
type SkinEntry = { id: number; level: number };

export function App() {
  useEffect(() => {
    const username = getUsername();

    // Set global identity so Cocos game reads it
    window.userAccount = username;
    window.isNetworkConnected = true;

    // ── Read helpers ─────────────────────────────────────────────────────────

    window.getTopListInfo = async (onSuccess) => {
      // Return empty top-10 so rankings panel shows nothing gracefully
      const empty10 = Array(10).fill(0);
      const emptyStr10 = Array(10).fill("");
      onSuccess?.([empty10, empty10, emptyStr10, emptyStr10, ""]);
    };

    window.getPlayerAllAssets = async (onSuccess) => {
      const gold = getNum(username, "gold", 500);
      const diamond = getNum(username, "diamond", 0);
      // Contract returns [gold, diamond, ...rest]; Cocos reads [0] and [1]
      onSuccess?.([gold.toString(), diamond.toString(), "0", "0"]);
    };

    window.getPlayerLastLotteryResult = async (onSuccess) => {
      const result = getJSON<{ type: number; num: number }>(
        username, "lastLottery", { type: 0, num: 100 }
      );
      onSuccess?.([result.type, result.num]);
    };

    window.getPlayerAllWeaponInfo = async (onSuccess) => {
      const weapons: WeaponEntry[] = getJSON(username, "weapons", []);
      const ids = weapons.map((w) => w.id);
      const levels = weapons.map((w) => w.level);
      onSuccess?.([ids, levels]);
    };

    window.getPlayerAllSkinInfo = async (onSuccess) => {
      const skins: SkinEntry[] = getJSON(username, "skins", []);
      const ids = skins.map((s) => s.id);
      const levels = skins.map((s) => s.level);
      onSuccess?.([ids, levels]);
    };

    window.getClaimableNative = async (onSuccess) => {
      onSuccess?.(BigInt(0));
    };

    // ── Write helpers ─────────────────────────────────────────────────────────

    window.startGame = async (onSuccess, _onError) => {
      // No blockchain tx needed — just start
      notifyGameStarted();
      onSuccess?.(undefined);
    };

    window.gameOver = async (time, kills, onSuccess, _onError) => {
      const t = Number(time);
      const k = Number(kills);
      // Persist last run for the Devvit hub "Submit Run" form pre-fill
      setJSON(username, "lastRun", { kills: k, time: t, ts: Date.now() });
      notifyGameOver(k, t);
      onSuccess?.(undefined);
    };

    window.buyOrUpgradeSkin = async (id, onSuccess, onError) => {
      const skinId = Number(id);
      const skins: SkinEntry[] = getJSON(username, "skins", []);
      const existing = skins.find((s) => s.id === skinId);
      if (existing) {
        // Upgrade: costs gold
        const cost = 200;
        const gold = getNum(username, "gold", 500);
        if (gold < cost) { onError?.(new Error("Not enough gold")); return; }
        setNum(username, "gold", gold - cost);
        existing.level = Math.min(existing.level + 1, 6);
      } else {
        // Buy: costs gold
        const cost = 500;
        const gold = getNum(username, "gold", 500);
        if (gold < cost) { onError?.(new Error("Not enough gold")); return; }
        setNum(username, "gold", gold - cost);
        skins.push({ id: skinId, level: 0 });
      }
      setJSON(username, "skins", skins);
      onSuccess?.(undefined);
    };

    window.buyOrUpgradeWeapon = async (id, onSuccess, onError) => {
      const weaponId = Number(id);
      const weapons: WeaponEntry[] = getJSON(username, "weapons", []);
      const existing = weapons.find((w) => w.id === weaponId);
      if (existing) {
        const cost = 300;
        const gold = getNum(username, "gold", 500);
        if (gold < cost) { onError?.(new Error("Not enough gold")); return; }
        setNum(username, "gold", gold - cost);
        existing.level = Math.min(existing.level + 1, 3);
      } else {
        const cost = 800;
        const gold = getNum(username, "gold", 500);
        if (gold < cost) { onError?.(new Error("Not enough gold")); return; }
        setNum(username, "gold", gold - cost);
        weapons.push({ id: weaponId, level: 0 });
      }
      setJSON(username, "weapons", weapons);
      onSuccess?.(undefined);
    };

    window.requestLottery = async (onSuccess, _onError) => {
      // Pick a random reward and store it; Cocos polls getPlayerLastLotteryResult
      const idx = Math.floor(Math.random() * TURNTABLE_REWARDS.length);
      const reward = TURNTABLE_REWARDS[idx];
      setJSON(username, "lastLottery", reward);
      // Award the item immediately (Cocos will also add it via CJ() callback)
      if (reward.type === 0) {
        setNum(username, "gold", getNum(username, "gold", 500) + reward.num);
      } else if (reward.type === 1) {
        setNum(username, "diamond", getNum(username, "diamond", 0) + reward.num);
      }
      onSuccess?.(undefined);
    };

    window.mintGold = async (onSuccess, _onError) => {
      setNum(username, "gold", getNum(username, "gold", 500) + 500);
      onSuccess?.(undefined);
    };

    window.reLive = async (onSuccess, _onError) => {
      // Free revive for Reddit users
      onSuccess?.(undefined);
    };

    window.claimNativeRewards = async (onSuccess, _onError) => {
      onSuccess?.(undefined);
    };

    // ── Daily challenge stubs (Devvit handles these) ───────────────────────────

    window.getDailyChallenge = async (_onSuccess) => { /* Devvit handles this */ };
    window.getPlayerChallengeInfo = async (_onSuccess) => { /* Devvit handles this */ };
    window.completeDailyChallenge = async (_kills, _time, onSuccess, _onError) => {
      onSuccess?.(undefined);
    };

    // ── Wallet UI stubs (no wallet needed) ────────────────────────────────────

    window.onConnectButtonClick = () => { /* already connected as Reddit user */ };
    window.onConnectedButtonClick = () => {
      alert(`Signed in as Reddit user: ${username}`);
    };
    window.parseChainHash = () => "Reddit";

    // ── Reactivity stubs (no blockchain subscriptions) ─────────────────────────

    window.reactivitySubscribeOffChain = async (_opts) => false;
    window.reactivityUnsubscribe = () => {};

    return () => {
      // Cleanup on unmount
      const w = window as unknown as Record<string, unknown>;
      const keys = [
        "getTopListInfo", "getPlayerAllAssets", "getPlayerLastLotteryResult",
        "getPlayerAllWeaponInfo", "getPlayerAllSkinInfo", "getClaimableNative",
        "startGame", "gameOver", "buyOrUpgradeSkin", "buyOrUpgradeWeapon",
        "requestLottery", "mintGold", "reLive", "claimNativeRewards",
        "getDailyChallenge", "getPlayerChallengeInfo", "completeDailyChallenge",
        "onConnectButtonClick", "onConnectedButtonClick", "parseChainHash",
        "reactivitySubscribeOffChain", "reactivityUnsubscribe",
      ];
      keys.forEach((k) => delete w[k]);
    };
  }, []);

  // Live game stats for DailyChallengePanel
  return (
    <main>
      <DailyChallengePanel kills={0} survivalSeconds={0} inGame={false} />
    </main>
  );
}
