// Arc Testnet network config.
// Source: docs.arc.io (official) + chainlist.org, verified July 2026.
export const ARC_TESTNET_CHAIN_ID_DEC = 5042002;

// Wallets expect chain IDs as lowercase hex (EIP-3085), so we derive it
// from the decimal value instead of hardcoding it by hand.
export const ARC_TESTNET_CHAIN_ID_HEX = `0x${ARC_TESTNET_CHAIN_ID_DEC.toString(16)}`;

// Params object for `wallet_addEthereumChain` (EIP-3085).
export const ARC_TESTNET_PARAMS = {
  chainId: ARC_TESTNET_CHAIN_ID_HEX,
  chainName: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    // NOTE: Arc pays gas in USDC, but the *native* currency the wallet
    // displays here uses 18 decimals (like ETH) — not the 6 decimals of
    // the regular USDC ERC-20 token. Mixing these two up when formatting
    // balances/amounts is the most common bug when porting a dApp to Arc.
    decimals: 18,
  },
  rpcUrls: ["https://rpc.testnet.arc.io"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

export const ARC_EXPLORER_URL = "https://testnet.arcscan.app";
