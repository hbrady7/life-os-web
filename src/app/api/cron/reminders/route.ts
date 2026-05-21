import { NextRequest, NextResponse } from "next/server";
import {
  listAllSubscriptions,
  type PushSubscriptionRow,
} from "@/lib/data/push-subscriptions";
import { sendPush, isWebPushConfigured } from "@/lib/web-push";
import { todayStr } from "@/lib/date";
import { getPhotoDayWindow } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Keep an upper bound so a stuck push-service request can't burn the
 *  entire Vercel function budget. Hobby tier caps a single invocation
 *  at 10s anyway — this is belt-and-suspenders. */
export const maxDuration = 60;

/**
 * Daily reminder cron. Wired to "0 8 * * *" in vercel.json (08:00 UTC
 * once per day — Hobby tier max). For each subscription:
 *  - If dailyWeightEnabled  → "Log your weight" notification.
 *  - If photoDayEnabled AND today is a photo-day window  → photo nudge.
 *
 * Bearer auth: Vercel automatically attaches the CRON_SECRET to
 * scheduled requests. Manual hits (curl from a dev machine) must
 * include the same header. Without CRON_SECRET set we 403 everything
 * to avoid unauthenticated push-spamming.
 */
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "cron_secret_unset" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "vapid_not_configured", sent: 0, skipped: 0 },
      { status: 503 }
    );
  }

  const today = todayStr();
  const photoWindow = getPhotoDayWindow(today);
  const subs = await listAllSubscriptions();

  let sent = 0;
  let skipped = 0;

  await Promise.all(
    subs.map(async (sub: PushSubscriptionRow) => {
      const tasks: Promise<boolean>[] = [];
      if (sub.dailyWeightEnabled) {
        tasks.push(
          sendPush(sub, {
            title: "Daily check-in",
            body: "Log your weight to keep the trend honest.",
            url: "/body",
            tag: "daily-weight",
          })
        );
      } else {
        skipped++;
      }
      if (sub.photoDayEnabled && photoWindow) {
        const headline = photoWindow.onTarget
          ? "Photo day"
          : "Photo day — catch up";
        tasks.push(
          sendPush(sub, {
            title: headline,
            body: photoWindow.onTarget
              ? "Quick body comp snapshot for today's session."
              : `You're ${photoWindow.daysLate} day${
                  photoWindow.daysLate === 1 ? "" : "s"
                } past — capture now while it's fresh.`,
            url: "/body",
            tag: `photo-day-${photoWindow.target}`,
          })
        );
      }
      const results = await Promise.all(tasks);
      sent += results.filter(Boolean).length;
    })
  );

  return NextResponse.json({
    ok: true,
    date: today,
    photoDay: Boolean(photoWindow),
    subscriptions: subs.length,
    sent,
    skipped,
  });
}
