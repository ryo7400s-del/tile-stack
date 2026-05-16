import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { coinbaseWallet, walletConnect, injected } from "wagmi/connectors";
import "./index.css";
import App from "./App.jsx";

const projectId = "50b53d7f5ff3f9833c6d53f7a8d751d3";

const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Tile Stack", preference: "all" }),
    walletConnect({
      projectId,
      metadata: {
        name: "Tile Stack",
        description: "Stack tiles on-chain leaderboard game",
        url: "https://tile-stack.vercel.app",
        icons: ["https://tile-stack.vercel.app/vite.svg"],
      },
      showQrModal: true,
    }),
  ],
  transports: { [base.id]: http("https://mainnet.base.org") },
});

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={import.meta.env.VITE_ONCHAINKIT_API_KEY}
          chain={base}
        >
          <App />
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
