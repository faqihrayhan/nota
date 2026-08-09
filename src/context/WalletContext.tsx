"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MetaMaskProvider, useSDK } from "@metamask/sdk-react";
import {
  ARC_TESTNET_CHAIN_ID_HEX,
  ARC_TESTNET_PARAMS,
} from "@/lib/arc-chain";

export type WalletId = "metamask" | "okx" | "rabby" | "rainbow";

type WalletState = {
  address: string | null;
  chainIdHex: string | null;
  walletId: WalletId | null;
  status: "idle" | "connecting" | "connected" | "error";
  error: string | null;
};

type WalletContextValue = WalletState & {
  isCorrectNetwork: boolean;
  isProviderAvailable: (id: WalletId) => boolean;
  isMobile: boolean;
  connect: (id: WalletId) => Promise<void>;
  disconnect: () => void;
  switchToArc: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = "arc-nota:last-wallet";
const VALID_IDS: WalletId[] = ["metamask", "okx", "rabby", "rainbow"];

// ── Provider detection helpers (for non-MetaMask wallets) ──

type EipProvider = {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isRainbow?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
};

function findProvider(
  predicate: (p: EipProvider) => boolean
): EipProvider | undefined {
  if (typeof window === "undefined") return undefined;
  const eth = window.ethereum as
    | (EipProvider & { providers?: EipProvider[] })
    | undefined;
  if (!eth) return undefined;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find(predicate);
  }
  return predicate(eth) ? eth : undefined;
}

function resolveProvider(id: WalletId): EipProvider | undefined {
  if (typeof window === "undefined") return undefined;
  switch (id) {
    case "okx":
      return (
        (window as unknown as { okxwallet?: { ethereum?: EipProvider } }).okxwallet
          ?.ethereum ??
        (window as unknown as { okxwallet?: EipProvider }).okxwallet ??
        undefined
      );
    case "rabby":
      return findProvider((p) => "isRabby" in p && p.isRabby === true);
    case "rainbow":
      return findProvider((p) => "isRainbow" in p && p.isRainbow === true);
    default:
      return undefined; // MetaMask uses SDK
  }
}

function isMobileUserAgent() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ── Inner provider (child of MetaMaskProvider) ──

function WalletProviderInner({ children }: { children: React.ReactNode }) {
  const { sdk, provider, account, chainId, connected, status } = useSDK();
  const [state, setState] = useState<WalletState>({
    address: null,
    chainIdHex: null,
    walletId: null,
    status: "idle",
    error: null,
  });
  const [isMobile, setIsMobile] = useState(false);
  const prevMmConnected = useRef(false);

  useEffect(() => {
    setIsMobile(isMobileUserAgent());
  }, []);

  // Sync MetaMask SDK state
  useEffect(() => {
    if (state.walletId !== "metamask") return;

    if (connected && account && !prevMmConnected.current) {
      prevMmConnected.current = true;
      setState({
        address: account,
        chainIdHex: chainId ?? null,
        walletId: "metamask",
        status: "connected",
        error: null,
      });
      window.localStorage.setItem(STORAGE_KEY, "metamask");
    }

    if (!connected && prevMmConnected.current) {
      prevMmConnected.current = false;
      setState({
        address: null,
        chainIdHex: null,
        walletId: null,
        status: "idle",
        error: null,
      });
    }
  }, [connected, account, chainId, state.walletId]);

  // Listen for MetaMask SDK provider events
  useEffect(() => {
    if (state.walletId !== "metamask" || !provider) return;

    const onAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        setState({
          address: null,
          chainIdHex: null,
          walletId: null,
          status: "idle",
          error: null,
        });
        window.localStorage.removeItem(STORAGE_KEY);
        prevMmConnected.current = false;
      } else {
        setState((s) => ({ ...s, address: list[0] ?? null }));
      }
    };

    const onChainChanged = (chainIdHex: unknown) => {
      setState((s) => ({ ...s, chainIdHex: chainIdHex as string }));
    };

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [state.walletId, provider]);

  // Subscribe to non-MetaMask wallet provider events
  useEffect(() => {
    if (!state.walletId || state.walletId === "metamask") return;

    const p = resolveProvider(state.walletId);
    if (!p?.on) return;

    const onAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        setState({
          address: null,
          chainIdHex: null,
          walletId: null,
          status: "idle",
          error: null,
        });
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        setState((s) => ({ ...s, address: list[0] ?? null }));
      }
    };

    const onChainChanged = (chainIdHex: unknown) => {
      setState((s) => ({ ...s, chainIdHex: chainIdHex as string }));
    };

    p.on("accountsChanged", onAccountsChanged);
    p.on("chainChanged", onChainChanged);

    return () => {
      p.removeListener?.("accountsChanged", onAccountsChanged);
      p.removeListener?.("chainChanged", onChainChanged);
    };
  }, [state.walletId]);

  const switchToArc = useCallback(async () => {
    if (!state.walletId) throw new Error("no_wallet");

    // MetaMask: use SDK provider
    if (state.walletId === "metamask") {
      if (!provider) throw new Error("no_provider");
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ARC_TESTNET_CHAIN_ID_HEX }],
        });
      } catch (err) {
        const code = (err as { code?: number })?.code;
        if (code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [ARC_TESTNET_PARAMS],
          });
        } else {
          throw err;
        }
      }
      return;
    }

    // Other wallets: use injected provider
    const p = resolveProvider(state.walletId);
    if (!p) throw new Error("no_provider");

    try {
      await p.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET_CHAIN_ID_HEX }],
      });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        await p.request({
          method: "wallet_addEthereumChain",
          params: [ARC_TESTNET_PARAMS],
        });
      } else {
        throw err;
      }
    }
  }, [state.walletId, provider]);

  const connect = useCallback(
    async (id: WalletId) => {
      // MetaMask → use SDK sdk.connect() (handles deeplink on mobile, extension on desktop)
      if (id === "metamask") {
        setState((s) => ({
          ...s,
          status: "connecting",
          error: null,
          walletId: id,
        }));

        // Wait for SDK to be ready
        let attempts = 0;
        while (!sdk && attempts < 10) {
          await new Promise((r) => setTimeout(r, 500));
          attempts++;
        }

        if (!sdk) {
          setState((s) => ({
            ...s,
            status: "error",
            error: "not_found",
          }));
          return;
        }

        try {
          // sdk.connect() handles:
          // - Desktop: MetaMask extension popup
          // - Mobile: deeplink to MetaMask app → sign → return to Chrome
          const accounts = (await sdk.connect()) as string[];

          if (accounts && accounts.length > 0) {
            const chainIdHex = provider
              ? ((await provider.request({
                  method: "eth_chainId",
                })) as string)
              : null;

            setState({
              address: accounts[0] ?? null,
              chainIdHex,
              walletId: id,
              status: "connected",
              error: null,
            });
            window.localStorage.setItem(STORAGE_KEY, id);
            prevMmConnected.current = true;
          }
        } catch (err) {
          const code = (err as { code?: number })?.code;
          if (code === 4001) {
            setState((s) => ({ ...s, status: "error", error: "rejected" }));
          } else {
            setState((s) => ({ ...s, status: "error", error: "rejected" }));
          }
        }
        return;
      }

      // Non-MetaMask wallets: injected provider only
      const p = resolveProvider(id);

      if (!p) {
        setState((s) => ({ ...s, status: "error", error: "not_found" }));
        return;
      }

      setState((s) => ({
        ...s,
        status: "connecting",
        error: null,
        walletId: id,
      }));

      try {
        const accounts = (await p.request({
          method: "eth_requestAccounts",
        })) as string[];
        const chainIdHex = (await p.request({
          method: "eth_chainId",
        })) as string;

        setState({
          address: accounts[0] ?? null,
          chainIdHex,
          walletId: id,
          status: "connected",
          error: null,
        });
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        setState((s) => ({ ...s, status: "error", error: "rejected" }));
      }
    },
    [sdk, provider]
  );

  const disconnect = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    prevMmConnected.current = false;
    setState({
      address: null,
      chainIdHex: null,
      walletId: null,
      status: "idle",
      error: null,
    });
  }, []);

  // Quietly reconnect on page load
  useEffect(() => {
    const last = window.localStorage.getItem(STORAGE_KEY) as WalletId | null;
    if (!last || !VALID_IDS.includes(last)) return;

    if (last === "metamask") {
      // MetaMask SDK handles reconnection internally
      if (connected && account) {
        prevMmConnected.current = true;
        setState({
          address: account,
          chainIdHex: chainId ?? null,
          walletId: "metamask",
          status: "connected",
          error: null,
        });
      }
      return;
    }

    // Other wallets: check accounts silently
    const p = resolveProvider(last);
    if (!p) return;
    p.request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list.length > 0) {
          connect(last);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, account, chainId]);

  const isProviderAvailable = useCallback((id: WalletId) => {
    if (id === "metamask") {
      // MetaMask is always available — SDK handles both extension and mobile deeplink
      return true;
    }
    return Boolean(resolveProvider(id));
  }, []);

  const isCorrectNetwork = state.chainIdHex === ARC_TESTNET_CHAIN_ID_HEX;

  const value = useMemo<WalletContextValue>(
    () => ({
      ...state,
      isCorrectNetwork,
      isProviderAvailable,
      isMobile,
      connect,
      disconnect,
      switchToArc,
    }),
    [
      state,
      isCorrectNetwork,
      isProviderAvailable,
      isMobile,
      connect,
      disconnect,
      switchToArc,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

// ── Outer provider (wraps with MetaMaskProvider) ──

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [hostname] = useState(() => {
    if (typeof window === "undefined") return "mynota-delta.vercel.app";
    return window.location.host;
  });

  return (
    <MetaMaskProvider
      debug={false}
      sdkOptions={{
        dappMetadata: {
          name: "Nota",
          url: hostname,
        },
        // No Infura key — we use Arc Testnet, not Ethereum mainnet
        infuraAPIKey: undefined,
        // Use deeplink on mobile — opens MetaMask app, then returns to browser
        useDeeplink: true,
        // Defaults: communication layer for mobile, extension for desktop
      }}
    >
      <WalletProviderInner>{children}</WalletProviderInner>
    </MetaMaskProvider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}