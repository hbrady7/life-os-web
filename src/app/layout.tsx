import type { Metadata, Viewport } from "next";
import { AccentProvider } from "@/components/accent-provider";
import { AppShell } from "@/components/app-shell";
import { PwaMode } from "@/components/pwa-mode";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { SwrProvider } from "@/components/swr-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life OS",
  description: "Your day at a glance.",
  applicationName: "Life OS",
  appleWebApp: {
    capable: true,
    title: "Life OS",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#050507",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AccentProvider />
        <ServiceWorkerRegister />
        <PwaMode />
        <SwrProvider>
          <AppShell>{children}</AppShell>
        </SwrProvider>
      </body>
    </html>
  );
}
