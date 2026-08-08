"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ARC_TESTNET_CHAIN_ID_HEX,
  ARC_TESTNET_PARAMS,
} from "@/lib/arc-chain";

export type WalletId = "metamask" | "okx";

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
  mobileDeepLink: (id: WalletId) => string;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = "arc-nota:last-wallet";

// Some wallets (MetaMask, OKX, others) can all inject into `window.ethereum`
// at once. This picks out the right one for the wallet the user chose.
function resolveProvider(id: WalletId): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;

  if (id === "okx") {
    // Hanya kembalikan provider OKX yang asli. JANGAN fallback ke
    // window.ethereum — kalau MetaMask terpasang, fallback ini membuat
    // tombol "OKX Wallet" malah connect ke MetaMask.
    return (
      window.okxwallet?.ethereum ??
      window.okxwallet ??
      undefined
    );
  }

  const eth = window.ethereum;
  if (!eth) return undefined;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p) => p.isMetaMask) ?? eth.providers[0] ?? undefined;
  }
  return eth.isMetaMask ? eth : eth;
}


function isMobileUserAgent() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainIdHex: null,
    walletId: null,
    status: "idle",
    error: null,
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileUserAgent());
  }, []);

  const switchToArc = useCallback(async () => {
    if (!state.walletId) throw new Error("no_wallet");
    const provider = resolveProvider(state.walletId);
    if (!provider) {
      // Ini biasanya kejadian di HP: tidak ada ekstensi wallet yang
      // "nyuntik" window.ethereum di browser biasa. Lempar error yang
      // jelas supaya UI bisa kasih tahu user, bukan diam saja.
      throw new Error("no_provider");
    }

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET_CHAIN_ID_HEX }],
      });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      // 4902 = chain not added to the wallet yet
      if (code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [ARC_TESTNET_PARAMS],
        });
      } else {
        throw err;
      }
    }
  }, [state.walletId]);

  const connect = useCallback(async (id: WalletId) => {
    const provider = resolveProvider(id);

    if (!provider) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "not_found",
      }));
      return;
    }

    setState((s) => ({ ...s, status: "connecting", error: null, walletId: id }));

    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const chainIdHex = (await provider.request({
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

      provider.on?.("accountsChanged", (...args) => {
        const next = (args[0] as string[]) ?? [];
        setState((s) => ({ ...s, address: next[0] ?? null }));
      });
      provider.on?.("chainChanged", (...args) => {
        const next = args[0] as string;
        setState((s) => ({ ...s, chainIdHex: next }));
      });
    } catch {
      setState((s) => ({
        ...s,
        status: "error",
        error: "rejected",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    // Injected wallets don't have a universal "disconnect" RPC call —
    // this just clears local state. The wallet extension itself stays
    // connected until the user revokes it from the wallet's own UI.
    window.localStorage.removeItem(STORAGE_KEY);
    setState({
      address: null,
      chainIdHex: null,
      walletId: null,
      status: "idle",
      error: null,
    });
  }, []);

  // Quietly reconnect on page load if the user connected before, so a
  // refresh doesn't force them to click "Connect" again.
  useEffect(() => {
    const last = window.localStorage.getItem(STORAGE_KEY) as WalletId | null;
    if (last === "metamask" || last === "okx") {
      const provider = resolveProvider(last);
      if (!provider) return;
      provider
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          const list = accounts as string[];
          if (list.length > 0) {
            connect(last);
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isProviderAvailable = useCallback(
    (id: WalletId) => Boolean(resolveProvider(id)),
    []
  );

  const mobileDeepLink = useCallback((id: WalletId) => {
    if (typeof window === "undefined") return "#";
    const current = window.location.href;
    if (id === "metamask") {
      const bare = current.replace(/^https?:\/\//, "");
      return `https://metamask.app.link/dapp/${bare}`;
    }
    // OKX Wallet in-app browser deep link (official format:
    // okx://wallet/dapp/url?dappUrl=<encodeURIComponent(url)>)
    return `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(current)}`;
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
      mobileDeepLink,
    }),
    [
      state,
      isCorrectNetwork,
      isProviderAvailable,
      isMobile,
      connect,
      disconnect,
      switchToArc,
      mobileDeepLink,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
