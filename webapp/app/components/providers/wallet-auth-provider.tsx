import { useAuth } from "@/components/context/auth-context";
import {
  RainbowKitAuthenticationProvider,
  createAuthenticationAdapter,
} from "@rainbow-me/rainbowkit";
import { type ReactNode, useMemo } from "react";
import { SiweMessage } from "siwe";

export default function WalletAuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  const adapter = useMemo(
    () =>
      createAuthenticationAdapter({
        getNonce: async () => {
          const response = await fetch("/api/auth/nonce");
          return await response.text();
        },
        createMessage: ({ nonce, address, chainId }) => {
          return new SiweMessage({
            domain: window.location.host,
            address,
            statement: "Sign in with Ethereum to the app.",
            uri: window.location.origin,
            version: "1",
            chainId,
            nonce,
          });
        },
        getMessageBody: ({ message }) => {
          return message.prepareMessage();
        },
        verify: async ({ message, signature }) => {
          const res = await fetch("/api/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, signature }),
          });
          if (res.ok) {
            auth.login(message.address);
          } else {
            auth.logout();
          }
          return res.ok;
        },
        signOut: async () => {
          await fetch("/api/auth/logout");
          auth.logout();
        },
      }),
    [auth.login, auth.logout]
  );

  return (
    <RainbowKitAuthenticationProvider
      adapter={adapter}
      status={auth.isAuthenticated ? "authenticated" : "unauthenticated"}
    >
      {children}
    </RainbowKitAuthenticationProvider>
  );
}