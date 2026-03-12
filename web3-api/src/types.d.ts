interface Window {
  ethereum?: any;
  web3?: any;
  isNetworkConnected: boolean;
  userAccount?: String;
  onConnectButtonClick: Function;
  onConnectedButtonClick: Function;
  parseChainHash: (chainHash: any) => string | undefined;
  // read function
  getTopListInfo: (onSuccess?: (receipt: any) => void) => Promise<void>;
  getPlayerAllAssets: (onSuccess?: (receipt: any) => void) => Promise<void>;
  getPlayerLastLotteryResult: (onSuccess?: (receipt: any) => void) => Promise<void>;
  getPlayerAllWeaponInfo: (onSuccess?: (receipt: any) => void) => Promise<void>;
  getPlayerAllSkinInfo: (onSuccess?: (receipt: any) => void) => Promise<void>;
  // write function
  startGame: (onSuccess?: (receipt: any) => void, onError?: (receipt: any) => void) => Promise<void>;
  gameOver: (time: bigint, kills: bigint, onSuccess?: (receipt: any) => void, onError?: (receipt: any) => void) => Promise<void>;
  buyOrUpgradeSkin: (id: bigint, onSuccess?: (receipt: any) => void, onError?: (receipt: any) => void) => Promise<void>;
  buyOrUpgradeWeapon: (id: bigint, onSuccess?: (receipt: any) => void, onError?: (receipt: any) => void) => Promise<void>;
  requestLottery: (onSuccess?: (receipt: any) => void, onError?: (receipt: any) => void) => Promise<void>;
  mintGold: (onSuccess?: (receipt: any) => void, onError?: (receipt: any) => void) => Promise<void>;
  reLive: (onSuccess?: (receipt: any) => void, onError?: (receipt: any) => void) => Promise<void>;
  // Somnia reactivity (off-chain + on-chain)
  /** Callback for reactivity off-chain subscription data (set by game before subscribe). */
  onReactivityData?: (data: unknown) => void;
  /** Start off-chain subscription. wildcard=true = all events; false = use optional eventTopics. Returns success. */
  reactivitySubscribeOffChain?: (opts: {
    wildcard?: boolean;
    onData: (data: unknown) => void;
    eventTopics?: `0x${string}`[];
    onError?: (err: unknown) => void;
  }) => Promise<boolean>;
  /** Stop the current off-chain subscription. */
  reactivityUnsubscribe?: () => void;
  /** Create on-chain (Solidity) subscription; needs wallet with ≥32 STT. Returns tx hash or error message. */
  reactivityCreateSoliditySubscription?: (data: {
    handlerContractAddress: string;
    priorityFeePerGas: bigint;
    maxFeePerGas: bigint;
    gasLimit: bigint;
    isGuaranteed: boolean;
    isCoalesced: boolean;
    eventTopics?: `0x${string}`[];
    emitter?: string;
  }) => Promise<string | { error: string }>;
  /** Get on-chain subscription info by ID. */
  reactivityGetSubscriptionInfo?: (subscriptionId: bigint) => Promise<unknown>;
  /** Cancel on-chain subscription (owner only). */
  reactivityCancelSubscription?: (subscriptionId: bigint) => Promise<string | { error: string }>;
  /** Create BlockTick system-event subscription (every block, or at blockNumber). SDK ≥0.1.9. */
  reactivityCreateBlockTickSubscription?: (data: {
    handlerContractAddress: string;
    blockNumber?: bigint;
    handlerFunctionSelector?: `0x${string}`;
    priorityFeePerGas: bigint;
    maxFeePerGas: bigint;
    gasLimit: bigint;
    isGuaranteed: boolean;
    isCoalesced: boolean;
  }) => Promise<string | { error: string }>;
  /** Schedule one-off cron job at timestampMs (ms, must be ≥12s in future). SDK ≥0.1.9. */
  reactivityScheduleCronJob?: (data: {
    timestampMs: number | bigint;
    handlerContractAddress: string;
    handlerFunctionSelector?: `0x${string}`;
    priorityFeePerGas: bigint;
    maxFeePerGas: bigint;
    gasLimit: bigint;
    isGuaranteed: boolean;
    isCoalesced: boolean;
  }) => Promise<string | { error: string }>;
}
