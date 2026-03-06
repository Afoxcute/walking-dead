## Getting Started

Create a project using this example:

```bash
npx thirdweb create --contract --template hardhat-javascript-starter
```

You can start editing the page by modifying `contracts/Contract.sol`.

To add functionality to your contracts, you can use the `@thirdweb-dev/contracts` package which provides base contracts and extensions to inherit. The package is already installed with this project. Head to our [Contracts Extensions Docs](https://portal.thirdweb.com/contractkit) to learn more.

## Building the project

After any changes to the contract, run:

```bash
npm run build
# or
yarn build
```

to compile your contracts. This will also detect the [Contracts Extensions Docs](https://portal.thirdweb.com/contractkit) detected on your contract.

## Deploying Contracts

### Deploy to Somnia Testnet (recommended)

1. **Install dependencies**
   ```bash
   cd contracts
   npm install
   # or
   yarn
   ```

2. **Set your deployer wallet**
   - Create a `.env` file in the `contracts/` folder (copy from `.env.example` if present).
   - Add your Somnia testnet wallet private key (get testnet STT from the [Somnia testnet faucet](https://testnet.somnia.network/)):
   ```env
   PRIVATE_KEY=your_hex_private_key_without_0x_or_with
   ```
   - Optional: `RPC_URL=https://dream-rpc.somnia.network/` (default is already Somnia testnet).

3. **Compile**
   ```bash
   npm run compile
   # or
   yarn compile
   ```

4. **Deploy**
   ```bash
   npm run deploy:somnia
   # or
   yarn deploy:somnia
   ```
   The script will print the deployed `ZKGameClient` address. Set that as `GAME_CONTRACT_ADDRESS` in `web3-api/src/config.ts`.

### Deploy via Thirdweb CLI

You can also use the Thirdweb dashboard/CLI (if your target chain is configured there):

```bash
npm run deploy
# or
yarn deploy
```

## Releasing Contracts

If you want to release a version of your contracts publicly, you can use one of the followings command:

```bash
npm run release
# or
yarn release
```

## Join our Discord!

For any questions, suggestions, join our discord at [https://discord.gg/thirdweb](https://discord.gg/thirdweb).
