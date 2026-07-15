interface Window {
  isNetworkConnected: boolean;
  userAccount?: string;
  onConnectButtonClick: () => void;
  onConnectedButtonClick: () => void;
  parseChainHash: (chainHash: unknown) => string | undefined;
  // read functions
  getTopListInfo: (onSuccess?: (receipt: unknown) => void) => Promise<void>;
  getPlayerAllAssets: (onSuccess?: (receipt: unknown) => void) => Promise<void>;
  getPlayerLastLotteryResult: (onSuccess?: (receipt: unknown) => void) => Promise<void>;
  getPlayerAllWeaponInfo: (onSuccess?: (receipt: unknown) => void) => Promise<void>;
  getPlayerAllSkinInfo: (onSuccess?: (receipt: unknown) => void) => Promise<void>;
  getClaimableNative: (onSuccess?: (wei: bigint) => void) => Promise<void>;
  // write functions
  startGame: (onSuccess?: (receipt: unknown) => void, onError?: (receipt: unknown) => void) => Promise<void>;
  gameOver: (
    time: bigint,
    kills: bigint,
    onSuccess?: (receipt: unknown) => void,
    onError?: (receipt: unknown) => void
  ) => Promise<void>;
  buyOrUpgradeSkin: (id: bigint, onSuccess?: (receipt: unknown) => void, onError?: (receipt: unknown) => void) => Promise<void>;
  buyOrUpgradeWeapon: (id: bigint, onSuccess?: (receipt: unknown) => void, onError?: (receipt: unknown) => void) => Promise<void>;
  requestLottery: (onSuccess?: (receipt: unknown) => void, onError?: (receipt: unknown) => void) => Promise<void>;
  mintGold: (onSuccess?: (receipt: unknown) => void, onError?: (receipt: unknown) => void) => Promise<void>;
  reLive: (onSuccess?: (receipt: unknown) => void, onError?: (receipt: unknown) => void) => Promise<void>;
  claimNativeRewards: (onSuccess?: (receipt: unknown) => void, onError?: (receipt: unknown) => void) => Promise<void>;
  // daily challenge (Devvit-backed)
  getDailyChallenge?: (onSuccess?: (d: unknown) => void) => Promise<void>;
  getPlayerChallengeInfo?: (onSuccess?: (d: unknown) => void) => Promise<void>;
  completeDailyChallenge?: (kills: bigint, survivalTime: bigint, onSuccess?: (r: unknown) => void, onError?: (r: unknown) => void) => Promise<void>;
  // reactivity stubs
  onReactivityData?: (data: unknown) => void;
  reactivitySubscribeOffChain?: (opts: {
    wildcard?: boolean;
    onData: (data: unknown) => void;
    eventTopics?: string[];
    onError?: (err: unknown) => void;
  }) => Promise<boolean>;
  reactivityUnsubscribe?: () => void;
  reactivityCreateSoliditySubscription?: (data: unknown) => Promise<unknown>;
  reactivityGetSubscriptionInfo?: (subscriptionId: bigint) => Promise<unknown>;
  reactivityCancelSubscription?: (subscriptionId: bigint) => Promise<unknown>;
  reactivityCreateBlockTickSubscription?: (data: unknown) => Promise<unknown>;
  reactivityScheduleCronJob?: (data: unknown) => Promise<unknown>;
  // internal
  gameOverVerifierAddress?: string;
}
