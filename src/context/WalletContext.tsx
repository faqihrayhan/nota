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
  mobileDeepLink: (id: WalletId) => string;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = "arc-nota:last-wallet";

// Wallet-specific detection flags on window.ethereum providers.
// Rabby injects window.ethereum with isRabby=true (or appears as a provider).
// Rainbow injects window.ethereum with isRainbow=true.
// Each wallet's official EIP-1193 provider is matched by its unique flag.
function findProvider(
  predicate: (p: { isMetaMask?: boolean; isRabby?: boolean; isRainbow?: boolean }) => boolean
): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  const eth = window.ethereum as
    | (Eip1193Provider & {
        providers?: { isMetaMask?: boolean; isRabby?: boolean; isRainbow?: boolean }[];
      })
    | undefined;
  if (!eth) return undefined;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find(predicate) as Eip1193Provider | undefined;
  }
  return predicate(eth as { isMetaMask?: boolean; isRabby?: boolean; isRainbow?: boolean })
    ? (eth as Eip1193Provider)
    : undefined;
}

function resolveProvider(id: WalletId): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  switch (id) {
    case "okx":
      return (
        (window as unknown as { okxwallet?: { ethereum?: Eip1193Provider } }).okxwallet?.ethereum ??
        (window as unknown as { okxwallet?: Eip1193Provider }).okxwallet ??
        undefined
      );
    case "rabby":
      return findProvider((p) => "isRabby" in p && p.isRabby === true);
    case "rainbow":
      return findProvider((p) => "isRainbow" in p && p.isRainbow === true);
    case "metamask":
    default:
      return findProvider((p) => "isMetaMask" in p && p.isMetaMask === true);
  }
}

function isMobileUserAgent() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const WALLET_DEEP_LINKS: Record<WalletId, (url: string) => string> = {
  metamask: (url) => {
    const bare = url.replace(/^https?:\/\//, "");
    return `https://metamask.app.link/dapp/${bare}`;
  },
  okx: (url) => `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(url)}`,
  rabby: (url) => {
    // Rabby's universal link opens the app and navigates to the dApp URL
    return `https://rabby.io/dapp/connect?url=${encodeURIComponent(url)}`;
  },
  rainbow: (url) => {
    // Rainbow's deep link: opens the Rainbow app with the dApp URL
    return `https://rnbwapp.com/dapp/${encodeURIComponent(url)}`;
  },
};

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
    window.localStorage.removeItem(STORAGE_KEY);
    setState({
      address: null,
      chainIdHex: null,
      walletId: null,
      status: "idle",
      error: null,
    });
  }, []);

  // Quietly reconnect on page load if the user connected before
  useEffect(() => {
    const last = window.localStorage.getItem(STORAGE_KEY) as WalletId | null;
    const validIds: WalletId[] = ["metamask", "okx", "rabby", "rainbow"];
    if (last && validIds.includes(last)) {
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

  const mobileDeepLink = useCallback(
    (id: WalletId) => {
      if (typeof window === "undefined") return "#";
      const current = window.location.href;
      const fn = WALLET_DEEP_LINKS[id] ?? WALLET_DEEP_LINKS.metamask;
      return fn(current);
    },
    []
  );

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