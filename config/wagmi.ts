import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { abstractWallet } from "@abstract-foundation/agw-react/connectors";
import { createConfig, http } from "wagmi";
import { abstract, base } from "viem/chains";

const projectId =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ||
  "47fd52dcb52b44787b0a8a9a6e1750e5";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        abstractWallet,
        metaMaskWallet,
        injectedWallet,
        coinbaseWallet,
        rainbowWallet,
      ],
    },
    {
      groupName: "Other",
      wallets: [walletConnectWallet],
    },
  ],
  {
    appName: "Puff Puff Pass",
    projectId,
  }
);

const chains = [base, abstract] as const;

export const wagmiConfig = createConfig({
  connectors,
  chains,
  transports: {
    [base.id]: http(),
    [abstract.id]: http(),
  },
  ssr: true,
});
