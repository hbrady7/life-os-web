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
  // maximumScale + userScalable disabled together prevents iOS double-tap
  // zoom on layout that already meets contrast/size A11y guidelines. We
  // still need viewportFit: cover for safe-area-inset-* to populate.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Tells iOS to *resize* the layout viewport when the on-screen keyboard
  // shows up instead of just overlaying it — fixes inputs near the bottom
  // getting hidden. Chrome/Android honors this hint via the
  // VirtualKeyboard API too.
  interactiveWidget: "resizes-content",
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
