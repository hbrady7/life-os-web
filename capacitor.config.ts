import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the Life OS iOS native shell.
 *
 * Strategy: hosted webview. The native iOS app loads the production
 * Vercel deployment (server.url) so SSR, API routes, NextAuth, and the
 * IndexedDB-backed SWR cache continue working unchanged. Native plugins
 * (haptics, push, status bar, splash) elevate the UX to feel iOS-native.
 *
 * If Apple App Review pushes back on the WebView wrapper pattern, the
 * fallback is to switch Next.js to `output: "export"` (static), bundle
 * the export into the iOS app via webDir, and deploy API routes
 * separately. That's a larger refactor — start with hosted.
 *
 * To change the bundle ID before App Store submission, edit appId here
 * AND in ios/App/App.xcodeproj (PRODUCT_BUNDLE_IDENTIFIER) via Xcode.
 */
const config: CapacitorConfig = {
  appId: "com.hbrady.lifeos",
  appName: "Life OS",
  // webDir is required by the CLI but unused when server.url is set.
  webDir: "public",
  server: {
    url: "https://life-os-carter.vercel.app",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    // Match the dark theme aggressively; no white flash on cold start.
    backgroundColor: "#050507",
    scheme: "Life OS",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#050507",
      iosSpinnerStyle: "small",
      spinnerColor: "#A78BFA",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#050507",
      overlaysWebView: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
