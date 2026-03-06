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
   const handlerContractAddress = '0xYourDeployedZKGameClientAddress';

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

4. To list or cancel subscriptions, use the SDK (e.g. `getAllSoliditySubscriptionsForOwner`, `cancelSoliditySubscription`) or the Somnia reactivity precompile at `0x0100`.

## Deploy and compile

- For **Somnia** (EVM), use a standard Solidity compiler (e.g. Hardhat’s default `solc`), not the zkSync compiler. Point Hardhat at Somnia testnet and run your deploy script.
- Ensure `@somnia-chain/reactivity-contracts` is installed so the `SomniaEventHandler` import resolves.

## Warnings

- **Gas**: Handlers run in validator context; keep `_onEvent` cheap.
- **Reentrancy**: The contract does not call back into game logic from `_onEvent`; it only emits `ReactedToGameLog`. Do not subscribe to `ReactedToGameLog` with this same handler to avoid loops.
- **Filters**: Use `emitter` / `eventTopics` so only the intended events trigger the handler.
