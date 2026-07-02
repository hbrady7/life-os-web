import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { energyCheckins } from "@/lib/db/schema";
import { ENERGY_STATE_SCORE, type EnergyState } from "@/lib/energy-curve";

export type EnergyCheckinRow = typeof energyCheckins.$inferSelect;

export async function listEnergyCheckinsForDate(
  userId: string,
  date: string
): Promise<EnergyCheckinRow[]> {
  return db
    .select()
    .from(energyCheckins)
    .where(
      and(eq(energyCheckins.userId, userId), eq(energyCheckins.date, date))
    )
    .orderBy(asc(energyCheckins.loggedAt));
}

/**
 * All check-ins on or after `since` (inclusive), oldest first. Powers both the
 * insight engine (felt-energy as an outcome) and the learned hourly energy
 * profile that lets the predictor's peak *hour* shift over time.
 */
export async function listEnergyCheckinsSince(
  userId: string,
  since: string
): Promise<EnergyCheckinRow[]> {
  return db
    .select()
    .from(energyCheckins)
    .where(
      and(eq(energyCheckins.userId, userId), gte(energyCheckins.date, since))
    )
    .orderBy(asc(energyCheckins.loggedAt));
}

export async function createEnergyCheckin(
  userId: string,
  input: { date: string; state: EnergyState }
): Promise<EnergyCheckinRow> {
  const [row] = await db
    .insert(energyCheckins)
    .values({
      userId,
      date: input.date,
      state: input.state,
      score: ENERGY_STATE_SCORE[input.state],
    })
    .returning();
  return row;
}

export async function deleteEnergyCheckin(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(energyCheckins)
    .where(and(eq(energyCheckins.id, id), eq(energyCheckins.userId, userId)));
}
