
![tw-banner](https://github.com/thirdweb-example/vite-starter/assets/57885104/cfe2164b-b50b-4d8e-aaaa-31331da2d647)

# vite-starter

Starter template to build onchain applications with [thirdweb](https://thirdweb.com) and [vite](https://vitejs.dev/). 

## Features 

- thirdweb & vite pre-installed and configured to reduce setup steps
- ConnectButton to onboard users to your application

## Installation

Install the template using [thirdweb create](https://portal.thirdweb.com/cli/create)

```bash
  npx thirdweb create app --vite
```

## Environment Variables

To run this project, add a `.env` file in `web3-api/` with:

- **`VITE_WALLETCONNECT_PROJECT_ID`** (recommended): Your [WalletConnect Cloud](https://cloud.walletconnect.com/) project ID. Required for WalletConnect (mobile wallet scans, etc.). Get a free project ID at https://cloud.walletconnect.com/. If unset, a placeholder is used and WalletConnect may not work. 

## Run locally

Install dependencies

```bash
yarn
```

Start development server

```bash
yarn dev
```

Create a production build

```bash
yarn build
```

Preview the production build

```bash
yarn preview
```

## Additional Resources

- [Documentation](https://portal.thirdweb.com/typescript/v5)
- [Templates](https://thirdweb.com/templates)
- [YouTube](https://www.youtube.com/c/thirdweb)
- [Blog](https://blog.thirdweb.com)

## Need help?

For help or feedback, please [visit our support site](https://thirdweb.com/support)
