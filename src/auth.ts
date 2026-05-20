/**
 * Auth.js v5 configuration — single source of truth for `auth()`, `signIn`,
 * `signOut`, and the `handlers` exported to `/api/auth/[...nextauth]/route.ts`.
 *
 * Session strategy: JWT. The Drizzle adapter still owns users / accounts /
 * verification_tokens in Postgres so we get cross-device account linking,
 * but the session itself lives in a signed httpOnly cookie. JWT works on
 * the Edge runtime — the `neon-http` driver does not — which lets the
 * middleware gate run on every request without bouncing to Node.
 *
 * iOS PWA caveat: when the user is in a standalone PWA, the GitHub OAuth
 * redirect lands in mobile Safari (not the PWA window). The session cookie
 * still gets set on the right origin, so when the user reopens the PWA
 * they're already signed in. See `signin/page.tsx` for the user-facing
 * note.
 */

import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/schema";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
    };
  }
}

/**
 * Auth.js v5 renamed the canonical env vars (AUTH_SECRET, AUTH_GITHUB_ID,
 * AUTH_GITHUB_SECRET, AUTH_URL) but doesn't auto-fall-back to the v4
 * names in every code path. Pass them explicitly with both-name
 * fallbacks so existing GITHUB_ID / GITHUB_SECRET / NEXTAUTH_SECRET
 * vars in Vercel continue to work — no rename required.
 */
const githubClientId =
  process.env.AUTH_GITHUB_ID ?? process.env.GITHUB_ID;
const githubClientSecret =
  process.env.AUTH_GITHUB_SECRET ?? process.env.GITHUB_SECRET;
const authSecret =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHub({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    }),
  ],
  secret: authSecret,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      // First sign-in: user is the row returned by the adapter (has DB id).
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
  // Trust the Vercel host header so the OAuth callback URL resolves
  // correctly on preview deployments + the production rust-named domain.
  trustHost: true,
});
