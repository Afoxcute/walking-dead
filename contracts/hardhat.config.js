try { require("dotenv").config(); } catch (_) {}
require("@nomicfoundation/hardhat-ethers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks: {
    somniaTestnet: {
      // RPC: https://dream-rpc.somnia.network/
      url: process.env.RPC_URL || "https://dream-rpc.somnia.network/",
      chainId: 50312,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY.replace(/^0x/, "")] : [],
      timeout: 120000,
    },
  },
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};
