# Somnia Reactivity for ZKGameClient

The game contract `ZKGameClient` inherits **SomniaEventHandler** and implements on-chain reactivity. When a subscribed event (e.g. `GameLogEvent`) is emitted, the chain calls the contract’s handler so you can run logic (e.g. emit `ReactedToGameLog`) without off-chain servers.

## What’s in the contract

- **Inheritance**: `ZKGameClient is Ownable, SomniaEventHandler`
- **`_onEvent(emitter, eventTopics, data)`**: Overridden to:
  - Increment `reactivityInvocationCount`
  - Decode ABI-encoded `GameLogEvent`-shaped `data` (uint, uint, address, uint, uint)
  - Emit `ReactedToGameLog(emitter, player, grade)` (no reentrancy into game logic)
- **Storage**: `reactivityInvocationCount` (number of handler invocations)
- **Event**: `ReactedToGameLog(address indexed emitter, address indexed player, uint256 grade)`

Subscriptions are created **off-chain** (or via the precompile). The contract only implements the handler.

## Create a subscription (TypeScript SDK)

1. Install the SDK:
   ```bash
   npm i @somnia-chain/reactivity
   ```

2. Ensure the subscription **owner** holds at least **32 SOM** on Somnia (testnet or mainnet as needed).

3. Create a subscription that targets your deployed game contract as the handler and filters for `GameLogEvent`:

   ```ts
   import { SDK } from '@somnia-chain/reactivity';
   import { defineChain } from 'viem';
   import { privateKeyToAccount } from 'viem/accounts';
   import { createPublicClient, createWalletClient, http } from 'viem';

   const somniaTestnet = defineChain({
     id: 50312,
     name: 'Somnia Testnet',
     nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
     rpcUrls: { default: { http: ['https://dream-rpc.somnia.network/'] } },
     blockExplorers: {
       default: { name: 'Shannon Explorer', url: 'https://shannon-explorer.somnia.network/' },
     },
   });

   const sdk = new SDK({
     public: createPublicClient({ chain: somniaTestnet, transport: http() }),
     wallet: createWalletClient({
       account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
       chain: somniaTestnet,
       transport: http(),
     }),
   });

   // Deployed game contract address (handler)
   const handlerContractAddress = '0x468D2FCd8EBc64B885b3e8573A6e5eCE4687abAF';

   // Optional: filter by GameLogEvent topic (event signature hash).
   // In viem: keccak256(toHex('GameLogEvent(uint256,uint256,address,uint256,uint256)')).
   const subData = {
     handlerContractAddress,
     priorityFeePerGas: parseGwei('2'),
     maxFeePerGas: parseGwei('10'),
     gasLimit: 500_000n,
     isGuaranteed: true,
     isCoalesced: false,
     // eventTopics: [gameLogEventTopic],  // optional
     // emitter: handlerContractAddress,    // optional: only this contract
   };

   const txHash = await sdk.createSoliditySubscription(subData);
   ```

4. To list or cancel subscriptions, use the SDK (e.g. `getSubscriptionInfo`, `cancelSoliditySubscription`) or the Somnia reactivity precompile at `0x0100`.

## SDK integration (web3-api)

The **web3-api** app integrates `@somnia-chain/reactivity` so the game (Cocos) and the dashboard can use subscriptions without extra tooling.

### Auto on-chain subscription (player wallet)

When a wallet connects, **web3-api** runs `tryEnsureAutoSoliditySubscription` (`web3-api/src/autoOnchainReactivity.ts`): if the address holds **≥1 STT** and localStorage does not already record a successful run for that address, it submits `createSoliditySubscription` for **GameLogEvent** from the game contract with **handler = game contract**. After a successful receipt, it sets `localStorage` key `onchainVsReactivityAutoSub_v1_<address>`. Use `clearAutoSoliditySubscriptionFlag(address)` if the player cancels the subscription on-chain and should be allowed to auto-create again.

Players below 1 STT skip silently (no tx). Failed txs are logged to the console only. (Somnia may still require a higher minimum balance for the subscription to stay active; see network docs.)

### Where it lives

- **Package**: `web3-api` depends on `@somnia-chain/reactivity`.
- **Module**: `web3-api/src/reactivity.ts` — helpers for SDK, off-chain subscribe, wildcard subscribe, and on-chain create/get/cancel.
- **Config**: `SOMNIA_WSS_RPC` in `web3-api/src/config.ts` (WebSocket URL for off-chain push).
- **Window API** (for Cocos / in-app): set by `App.tsx` when the app loads.

### Off-chain (WebSocket) subscription

- **Subscribe** (with optional filters):  
  `window.reactivitySubscribeOffChain({ wildcard: false, onData: (data) => { ... }, eventTopics: [...], onError })`  
  Uses a WebSocket client under the hood for real-time push.
- **Wildcard off-chain subscription** (all events):  
  `window.reactivitySubscribeOffChain({ wildcard: true, onData: (data) => { ... }, onError })`  
  No `eventTopics` filter; you receive every event the chain pushes.
- **Unsubscribe**:  
  `window.reactivityUnsubscribe()`  
  Stops the current off-chain subscription.
- Optional: set `window.onReactivityData = (data) => { ... }`; it is called in addition to the `onData` you pass to `reactivitySubscribeOffChain`.

### On-chain (Solidity) subscription

- **Create**:  
  `window.reactivityCreateSoliditySubscription({ handlerContractAddress, priorityFeePerGas, maxFeePerGas, gasLimit, isGuaranteed, isCoalesced, eventTopics?, emitter? })`  
  Requires connected wallet with ≥32 STT. Returns tx hash or `{ error: string }`.
- **Get info**:  
  `window.reactivityGetSubscriptionInfo(subscriptionId)`  
  Returns subscription info or `undefined`.
- **Cancel**:  
  `window.reactivityCancelSubscription(subscriptionId)`  
  Owner only. Returns tx hash or `{ error: string }`.

### System event and cron subscriptions (SDK ≥0.1.9)

From [Cron subscriptions via SDK](https://docs.somnia.network/developer/reactivity/tutorials/cron-subscriptions-via-sdk) and [System Events](https://docs.somnia.network/developer/reactivity/system-events):

- **BlockTick** — Fires at the start of every block (or at a specific block if `blockNumber` is set).
- **Schedule** — One-off cron: handler runs once at `timestampMs` (milliseconds; must be ≥12 seconds in the future). Subscription is removed after it runs.

**Window API:**

- **BlockTick subscription**:  
  `window.reactivityCreateBlockTickSubscription({ handlerContractAddress, priorityFeePerGas, maxFeePerGas, gasLimit, isGuaranteed, isCoalesced, blockNumber?, handlerFunctionSelector? })`  
  Requires connected wallet with ≥32 STT. Returns tx hash or `{ error: string }`.
- **One-off cron (Schedule)**:  
  `window.reactivityScheduleCronJob({ timestampMs, handlerContractAddress, priorityFeePerGas, maxFeePerGas, gasLimit, isGuaranteed, isCoalesced, handlerFunctionSelector? })`  
  Same wallet requirement. `timestampMs` is in milliseconds (e.g. from `Date.now() + 15000` for ~15s from now).

Use `reactivityGetSubscriptionInfo` / `reactivityCancelSubscription` to inspect or cancel a BlockTick subscription. Schedule jobs are one-off and are not listed after they fire.

## Deploy and compile

- For **Somnia** (EVM), use a standard Solidity compiler (e.g. Hardhat’s default `solc`), not the zkSync compiler. Point Hardhat at Somnia testnet and run your deploy script.
- Ensure `@somnia-chain/reactivity-contracts` is installed so the `SomniaEventHandler` import resolves.

## Warnings

- **Gas**: Handlers run in validator context; keep `_onEvent` cheap.
- **Reentrancy**: The contract does not call back into game logic from `_onEvent`; it only emits `ReactedToGameLog`. Do not subscribe to `ReactedToGameLog` with this same handler to avoid loops.
- **Filters**: Use `emitter` / `eventTopics` so only the intended events trigger the handler.
