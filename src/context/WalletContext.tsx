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
import MetaMaskSDK from "@metamask/sdk";
import {
  ARC_TESTNET_CHAIN_ID_HEX,
  ARC_TESTNET_PARAMS,
} from "@/lib/arc-chain";
import { signInWithWallet, signOutWallet } from "@/lib/auth/client";

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

export type { EipProvider };

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

// ── WalletProvider ──

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainIdHex: null,
    walletId: null,
    status: "idle",
    error: null,
  });
  const [isMobile, setIsMobile] = useState(false);
  const mmSdkRef = useRef<MetaMaskSDK | null>(null);
  const mmProviderRef = useRef<EipProvider | null>(null);
  const prevMmConnected = useRef(false);
  const mmInitRef = useRef(false);

  useEffect(() => {
    setIsMobile(isMobileUserAgent());
  }, []);

  // Initialize MetaMask SDK once
  useEffect(() => {
    if (mmInitRef.current) return;
    mmInitRef.current = true;

    const hostname = typeof window !== "undefined" ? window.location.host : "mynota-delta.vercel.app";

    const sdk = new MetaMaskSDK({
      dappMetadata: {
        name: "Nota",
        url: hostname,
      },
      useDeeplink: true,
      headless: true,
      checkInstallationImmediately: false,
      injectProvider: false,
      logging: {
        sdk: false,
      },
    });

    // Init the SDK (this sets up the provider and communication layer)
    // sdk.init() returns a promise but we don't need to await it here
    sdk.init().then(() => {
      const provider = sdk.getProvider() as unknown as EipProvider | undefined;
      if (provider) {
        mmProviderRef.current = provider;
      }

      // Listen for provider events
      provider?.on?.("accountsChanged", (accounts: unknown) => {
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
      });

      provider?.on?.("chainChanged", (chainIdHex: unknown) => {
        setState((s) => ({ ...s, chainIdHex: chainIdHex as string }));
      });

      // Auto-reconnect if previously connected
      const last = window.localStorage.getItem(STORAGE_KEY);
      if (last === "metamask") {
        provider
          ?.request({ method: "eth_accounts" })
          .then((accounts) => {
            const list = accounts as string[];
            if (list.length > 0) {
              setState({
                address: list[0] ?? null,
                chainIdHex: null,
                walletId: "metamask",
                status: "connected",
                error: null,
              });
              prevMmConnected.current = true;
            }
          })
          .catch(() => {});
      }
    });

    mmSdkRef.current = sdk;
  }, []);

  /**
   * Wallet sign-in: request a nonce, ask the wallet to sign, exchange for JWT.
   * Called automatically after a successful connect.
   */
  const signInWallet = useCallback(
    async (addr: string, provider: EipProvider): Promise<void> => {
      try {
        const token = await signInWithWallet(provider, addr);
      } catch (err) {
        // Non-fatal: app still works read-only/anon; log & continue.
        console.warn("wallet sign-in skipped:", (err as Error)?.message ?? err);
      }
    },
    []
  );

  const switchToArc = useCallback(async () => {
    if (!state.walletId) throw new Error("no_wallet");

    // MetaMask: use SDK provider
    if (state.walletId === "metamask") {
      const provider = mmProviderRef.current;
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
  }, [state.walletId]);

  const connect = useCallback(async (id: WalletId) => {
    // MetaMask → use SDK connect()
    if (id === "metamask") {
      const sdk = mmSdkRef.current;
      if (!sdk) {
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
        // sdk.connect() handles:
        // - Desktop: MetaMask extension popup (auto-detected)
        // - Mobile: deeplink to MetaMask app → sign → return to Chrome
        const accounts = (await sdk.connect()) as string[];

        if (accounts && accounts.length > 0) {
          const provider = mmProviderRef.current;
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
          // Auto sign-in: exchange a signed message for a JWT (RLS auth).
          if (accounts[0] && provider) {
            void signInWallet(accounts[0], provider);
          }
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
      // Auto sign-in: exchange a signed message for a JWT (RLS auth).
      if (accounts[0]) {
        void signInWallet(accounts[0], p);
      }
    } catch {
      setState((s) => ({ ...s, status: "error", error: "rejected" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = useCallback(() => {
    // Revoke extension permissions if possible (Rabby, Rainbow, OKX support this)
    const walletId = state.walletId;
    if (walletId && walletId !== "metamask") {
      const p = resolveProvider(walletId);
      // Try to revoke permissions — wallet_revokePermissions is EIP-2255
      // If the wallet doesn't support it, this silently fails
      p?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      }).catch(() => {
        // Some wallets don't support revoke — that's fine
      });
    }

    window.localStorage.removeItem(STORAGE_KEY);
    prevMmConnected.current = false;
    signOutWallet();
    setState({
      address: null,
      chainIdHex: null,
      walletId: null,
      status: "idle",
      error: null,
    });
  }, [state.walletId]);

  // Quietly reconnect non-MetaMask wallets on page load
  useEffect(() => {
    const last = window.localStorage.getItem(STORAGE_KEY) as WalletId | null;
    if (!last || !VALID_IDS.includes(last) || last === "metamask") return;

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
  }, []);

  const isProviderAvailable = useCallback((id: WalletId) => {
    if (id === "metamask") {
      // MetaMask SDK handles both extension and mobile deeplink
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
    [state, isCorrectNetwork, isProviderAvailable, isMobile, connect, disconnect, switchToArc]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}