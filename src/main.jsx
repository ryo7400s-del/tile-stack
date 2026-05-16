import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";
import "./index.css";
import App from "./App.jsx";

const config = createConfig({
  chains: [base],
  connectors: [coinbaseWallet({ appName: "Tile Stack", preference: "all" })],
  transports: { [base.id]: http() },
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
