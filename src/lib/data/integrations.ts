/**
 * Third-party integrations (currently just google_health). OAuth tokens
 * are encrypted on write via lib/db/encryption.ts and decrypted on read.
 * Per-date per-field provenance lives in integrationProvenance so the
 * sync engine can decide manual-vs-sync precedence.
 */

import { and, between, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  integrations,
  integrationProvenance,
} from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/db/encryption";

export type IntegrationRow = typeof integrations.$inferSelect;
export type ProvenanceRow = typeof integrationProvenance.$inferSelect;

export type IntegrationSnapshot = {
  provider: string;
  email?: string | null;
  needsReconnect: boolean;
  lastSyncedAt?: Date | null;
  expiresAt?: Date | null;
  meta: Record<string, unknown>;
  accessToken?: string;
  refreshToken?: string;
};

export async function getIntegration(
  userId: string,
  provider: string
): Promise<IntegrationSnapshot | null> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(eq(integrations.userId, userId), eq(integrations.provider, provider))
    );
  if (!row) return null;
  return {
    provider: row.provider,
    email: row.email,
    needsReconnect: row.needsReconnect,
    lastSyncedAt: row.lastSyncedAt,
    expiresAt: row.expiresAt,
    meta: (row.meta as Record<string, unknown>) ?? {},
    accessToken: row.accessTokenEncrypted
      ? decrypt(row.accessTokenEncrypted)
      : undefined,
    refreshToken: row.refreshTokenEncrypted
      ? decrypt(row.refreshTokenEncrypted)
      : undefined,
  };
}

export async function upsertIntegration(
  userId: string,
  provider: string,
  patch: Partial<{
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
    email: string | null;
    needsReconnect: boolean;
    lastSyncedAt: Date | null;
    meta: Record<string, unknown>;
  }>
): Promise<void> {
  const values: Record<string, unknown> = {
    userId,
    provider,
    updatedAt: new Date(),
  };
  if ("accessToken" in patch) {
    values.accessTokenEncrypted = patch.accessToken
      ? encrypt(patch.accessToken)
      : null;
  }
  if ("refreshToken" in patch) {
    values.refreshTokenEncrypted = patch.refreshToken
      ? encrypt(patch.refreshToken)
      : null;
  }
  if ("expiresAt" in patch) values.expiresAt = patch.expiresAt;
  if ("email" in patch) values.email = patch.email;
  if ("needsReconnect" in patch) values.needsReconnect = patch.needsReconnect;
  if ("lastSyncedAt" in patch) values.lastSyncedAt = patch.lastSyncedAt;
  if ("meta" in patch) values.meta = patch.meta;

  const setClause = { ...values };
  delete (setClause as Record<string, unknown>).userId;
  delete (setClause as Record<string, unknown>).provider;

  await db
    .insert(integrations)
    .values(values as typeof integrations.$inferInsert)
    .onConflictDoUpdate({
      target: [integrations.userId, integrations.provider],
      set: setClause,
    });
}

export async function deleteIntegration(
  userId: string,
  provider: string
): Promise<void> {
  await db
    .delete(integrations)
    .where(
      and(eq(integrations.userId, userId), eq(integrations.provider, provider))
    );
}

// ── Provenance (per-date per-field syncedAt / manualOverrideAt) ────────────

export async function getProvenanceRange(
  userId: string,
  provider: string,
  start: string,
  end: string
): Promise<ProvenanceRow[]> {
  return db
    .select()
    .from(integrationProvenance)
    .where(
      and(
        eq(integrationProvenance.userId, userId),
        eq(integrationProvenance.provider, provider),
        between(integrationProvenance.date, start, end)
      )
    );
}

export async function setSynced(
  userId: string,
  provider: string,
  date: string,
  field: string,
  at: Date
): Promise<void> {
  await db
    .insert(integrationProvenance)
    .values({ userId, provider, date, field, syncedAt: at })
    .onConflictDoUpdate({
      target: [
        integrationProvenance.userId,
        integrationProvenance.provider,
        integrationProvenance.date,
        integrationProvenance.field,
      ],
      set: { syncedAt: at },
    });
}

export async function setManualOverride(
  userId: string,
  provider: string,
  date: string,
  field: string,
  at: Date
): Promise<void> {
  await db
    .insert(integrationProvenance)
    .values({ userId, provider, date, field, manualOverrideAt: at })
    .onConflictDoUpdate({
      target: [
        integrationProvenance.userId,
        integrationProvenance.provider,
        integrationProvenance.date,
        integrationProvenance.field,
      ],
      set: { manualOverrideAt: at },
    });
}
