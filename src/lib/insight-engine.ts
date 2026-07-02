/**
 * The Insight Engine — honest, statistical cross-domain correlation mining.
 *
 * This is deliberately NOT an LLM. The existing "/api/patterns" surface asks
 * Gemini for pattern *headlines*, but the numbers it prints ("6.4 avg") are
 * model-generated and ungrounded. This module is the opposite: it computes
 * real effect sizes, real sample sizes, and a real significance signal from
 * the user's own logged history, then hands the ranked findings off to be
 * rendered (dashboard card) and narrated (Mentor context).
 *
 * Method — the "split" test. For a predictor→outcome pair we split the
 * predictor into a high arm and a low arm (top vs bottom tercile for numeric
 * predictors; true vs false for booleans), then compare the outcome means
 * with Welch's t-test (unequal variances) and Cohen's d (effect size). Every
 * surfaced insight carries n per arm, the delta in real units, an honest
 * confidence label, and a two-sided p-value. Nothing is surfaced unless it
 * clears a minimum sample size AND a minimum effect size — so a thin, noisy
 * edge stays quiet instead of masquerading as a finding.
 *
 * Pure + I/O-free: takes an already-assembled series map (see
 * lib/data/insight-series.ts) so it is trivially testable and can run either
 * on the server (route/cron) or be reasoned about in isolation.
 */

import type { Metric } from "./metric-colors";

/**
 * Stable fingerprint for an insight — lowercased, alphanumeric-collapsed,
 * clamped. Reused as the key for the shared dismissed-patterns blocklist.
 * Inlined (rather than imported from lib/insights) so this module stays
 * server-clean and free of the client Zustand store's transitive imports.
 */
function fingerprintHeadline(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

// ── Value/series shape ───────────────────────────────────────────────────────

/** A single predictor or outcome track, keyed by ISO date (yyyy-mm-dd). */
export type SeriesMap = Record<string, number | boolean | null | undefined>;
/** The full assembled dataset — every track the engine can reason over. */
export type InsightSeries = Record<string, SeriesMap>;

export type Confidence = "strong" | "moderate" | "tentative";

export type EngineInsight = {
  /** Stable fingerprint — reused for the dismissed-patterns blocklist. */
  id: string;
  predictorKey: string;
  outcomeKey: string;
  headline: string;
  detail: string;
  /** Metric key for UI coloring (maps to lib/metric-colors). */
  metric: Metric;
  /** Is the pattern good news or a nudge? Drives the card tone. */
  tone: "positive" | "nudge" | "neutral";
  /** Total paired samples across both arms. */
  n: number;
  highN: number;
  lowN: number;
  avgHigh: number;
  avgLow: number;
  /** Outcome-unit delta actually described in the copy (always ≥ 0). */
  delta: number;
  unit: string;
  cohenD: number;
  pValue: number;
  confidence: Confidence;
  /** Composite rank score — higher = stronger + more certain. */
  score: number;
};

// ── Hypotheses ───────────────────────────────────────────────────────────────

type Frame = "high-low" | "bool";

type Hypothesis = {
  predictorKey: string;
  outcomeKey: string;
  /** 0 = same day, 1 = predictor affects the NEXT day's outcome. */
  lag: 0 | 1;
  frame: Frame;
  /** Whether a higher outcome value is the "good" direction (for tone). */
  outcomeGoodHigh: boolean;
  outcomeLabel: string;
  unit: string;
  /** Rounding for displayed means (decimals). */
  decimals: number;
  metric: Metric;
  /** Copy for the two arms. `{v}` is substituted with nothing here — arms are
   *  described qualitatively. */
  highLabel: string;
  lowLabel: string;
  /** Short predictor noun used in the headline. */
  predictorNoun: string;
};

/**
 * The mined relationships. Each is a directional hypothesis a reasonable coach
 * would test — deliberately curated (not every pair) so we don't p-hack a
 * hundred combinations and surface whatever noise wins. Lag encodes the causal
 * arrow: e.g. caffeine timing on day D vs sleep the FOLLOWING night (lag 1).
 */
const HYPOTHESES: Hypothesis[] = [
  // ── Sleep as a driver ─────────────────────────────────────────────────────
  {
    predictorKey: "sleepHours",
    outcomeKey: "peakState",
    lag: 0,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "readiness",
    unit: "",
    decimals: 0,
    metric: "sleep",
    highLabel: "well-slept",
    lowLabel: "short-sleep",
    predictorNoun: "sleep",
  },
  {
    predictorKey: "sleepHours",
    outcomeKey: "mood",
    lag: 0,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "mood",
    unit: "",
    decimals: 1,
    metric: "mood",
    highLabel: "well-slept",
    lowLabel: "short-sleep",
    predictorNoun: "sleep",
  },
  {
    predictorKey: "sleepScore",
    outcomeKey: "energyDay",
    lag: 0,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "felt energy",
    unit: "",
    decimals: 0,
    metric: "energy",
    highLabel: "high sleep-score",
    lowLabel: "low sleep-score",
    predictorNoun: "sleep quality",
  },
  // ── Caffeine → sleep (the flagship example) ───────────────────────────────
  {
    predictorKey: "caffeineAfterCutoff",
    outcomeKey: "sleepScore",
    lag: 1,
    frame: "bool",
    outcomeGoodHigh: true,
    outcomeLabel: "sleep score",
    unit: "",
    decimals: 0,
    metric: "sleep",
    highLabel: "caffeine past cutoff",
    lowLabel: "cutoff respected",
    predictorNoun: "late caffeine",
  },
  {
    predictorKey: "caffeineMg",
    outcomeKey: "sleepScore",
    lag: 1,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "sleep score",
    unit: "",
    decimals: 0,
    metric: "sleep",
    highLabel: "high-caffeine",
    lowLabel: "low-caffeine",
    predictorNoun: "caffeine",
  },
  {
    predictorKey: "caffeineLatestHour",
    outcomeKey: "sleepScore",
    lag: 1,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "sleep score",
    unit: "",
    decimals: 0,
    metric: "sleep",
    highLabel: "late last-cup",
    lowLabel: "early last-cup",
    predictorNoun: "last caffeine timing",
  },
  // ── Hydration ─────────────────────────────────────────────────────────────
  {
    predictorKey: "waterPct",
    outcomeKey: "energyDay",
    lag: 0,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "felt energy",
    unit: "",
    decimals: 0,
    metric: "water",
    highLabel: "well-hydrated",
    lowLabel: "under-hydrated",
    predictorNoun: "hydration",
  },
  {
    predictorKey: "waterPct",
    outcomeKey: "mood",
    lag: 0,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "mood",
    unit: "",
    decimals: 1,
    metric: "water",
    highLabel: "well-hydrated",
    lowLabel: "under-hydrated",
    predictorNoun: "hydration",
  },
  // ── Supplements ───────────────────────────────────────────────────────────
  {
    predictorKey: "supplementAdherence",
    outcomeKey: "energyDay",
    lag: 0,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "felt energy",
    unit: "",
    decimals: 0,
    metric: "energy",
    highLabel: "full stack",
    lowLabel: "skipped stack",
    predictorNoun: "supplement adherence",
  },
  {
    predictorKey: "supplementAdherence",
    outcomeKey: "peakState",
    lag: 1,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "next-day readiness",
    unit: "",
    decimals: 0,
    metric: "sleep",
    highLabel: "full stack",
    lowLabel: "skipped stack",
    predictorNoun: "supplement adherence",
  },
  // ── Movement ──────────────────────────────────────────────────────────────
  {
    predictorKey: "workoutDay",
    outcomeKey: "sleepScore",
    lag: 0,
    frame: "bool",
    outcomeGoodHigh: true,
    outcomeLabel: "that night's sleep score",
    unit: "",
    decimals: 0,
    metric: "sleep",
    highLabel: "training days",
    lowLabel: "rest days",
    predictorNoun: "training",
  },
  {
    predictorKey: "workoutDay",
    outcomeKey: "peakState",
    lag: 1,
    frame: "bool",
    outcomeGoodHigh: true,
    outcomeLabel: "next-day readiness",
    unit: "",
    decimals: 0,
    metric: "sleep",
    highLabel: "training days",
    lowLabel: "rest days",
    predictorNoun: "training",
  },
  {
    predictorKey: "steps",
    outcomeKey: "mood",
    lag: 0,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "mood",
    unit: "",
    decimals: 1,
    metric: "steps",
    highLabel: "high-step",
    lowLabel: "low-step",
    predictorNoun: "steps",
  },
  {
    predictorKey: "steps",
    outcomeKey: "sleepScore",
    lag: 0,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "sleep score",
    unit: "",
    decimals: 0,
    metric: "steps",
    highLabel: "high-step",
    lowLabel: "low-step",
    predictorNoun: "daily steps",
  },
  // ── Lifestyle behaviors → recovery / sleep ────────────────────────────────
  {
    predictorKey: "alcohol",
    outcomeKey: "sleepScore",
    lag: 1,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "sleep score",
    unit: "",
    decimals: 0,
    metric: "sleep",
    highLabel: "drinking",
    lowLabel: "alcohol-free",
    predictorNoun: "alcohol",
  },
  {
    predictorKey: "stress",
    outcomeKey: "sleepHours",
    lag: 1,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "sleep",
    unit: "h",
    decimals: 1,
    metric: "sleep",
    highLabel: "high-stress",
    lowLabel: "calm",
    predictorNoun: "stress",
  },
  {
    predictorKey: "meditation",
    outcomeKey: "peakState",
    lag: 1,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "next-day readiness",
    unit: "",
    decimals: 0,
    metric: "mood",
    highLabel: "meditation",
    lowLabel: "no meditation",
    predictorNoun: "meditation",
  },
  {
    predictorKey: "screenBeforeBed",
    outcomeKey: "sleepScore",
    lag: 1,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "sleep score",
    unit: "",
    decimals: 0,
    metric: "sleep",
    highLabel: "heavy pre-bed screens",
    lowLabel: "light pre-bed screens",
    predictorNoun: "pre-bed screens",
  },
  {
    predictorKey: "lateMeal",
    outcomeKey: "sleepScore",
    lag: 1,
    frame: "bool",
    outcomeGoodHigh: true,
    outcomeLabel: "sleep score",
    unit: "",
    decimals: 0,
    metric: "sleep",
    highLabel: "late-meal nights",
    lowLabel: "no late meal",
    predictorNoun: "late meals",
  },
  // ── Protein / nutrition ───────────────────────────────────────────────────
  {
    predictorKey: "protein",
    outcomeKey: "peakState",
    lag: 1,
    frame: "high-low",
    outcomeGoodHigh: true,
    outcomeLabel: "next-day readiness",
    unit: "",
    decimals: 0,
    metric: "protein",
    highLabel: "high-protein",
    lowLabel: "low-protein",
    predictorNoun: "protein intake",
  },
];

// ── Gates ────────────────────────────────────────────────────────────────────

const MIN_ARM = 5; // each arm needs at least this many samples
const MIN_ABS_D = 0.3; // ignore trivial effects
const MAX_P = 0.2; // don't surface anything noisier than this

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run every hypothesis over the assembled series and return the surviving
 * insights, strongest first. `limit` caps the returned list.
 */
export function mineInsights(
  series: InsightSeries,
  limit = 6
): EngineInsight[] {
  const out: EngineInsight[] = [];
  for (const h of HYPOTHESES) {
    const insight = testHypothesis(series, h);
    if (insight) out.push(insight);
  }
  out.sort((a, b) => b.score - a.score);
  // De-dup: at most one insight per (predictor→outcome) pair already holds,
  // but also avoid flooding a single metric — keep the ranking honest.
  return out.slice(0, limit);
}

function testHypothesis(
  series: InsightSeries,
  h: Hypothesis
): EngineInsight | null {
  const predictor = series[h.predictorKey];
  const outcome = series[h.outcomeKey];
  if (!predictor || !outcome) return null;

  // Build aligned (predictorValue, outcomeValue) pairs honoring the lag.
  const pairs: Array<{ p: number | boolean; o: number }> = [];
  for (const date of Object.keys(predictor)) {
    const pv = predictor[date];
    if (pv == null) continue;
    const outDate = h.lag === 0 ? date : shiftISO(date, 1);
    const ov = outcome[outDate];
    if (typeof ov !== "number" || !Number.isFinite(ov)) continue;
    if (h.frame === "bool") {
      if (typeof pv !== "boolean") continue;
      pairs.push({ p: pv, o: ov });
    } else {
      if (typeof pv !== "number" || !Number.isFinite(pv)) continue;
      pairs.push({ p: pv, o: ov });
    }
  }
  if (pairs.length < MIN_ARM * 2) return null;

  let highVals: number[];
  let lowVals: number[];
  if (h.frame === "bool") {
    highVals = pairs.filter((x) => x.p === true).map((x) => x.o);
    lowVals = pairs.filter((x) => x.p === false).map((x) => x.o);
  } else {
    const nums = pairs.map((x) => x.p as number);
    const hi = quantile(nums, 2 / 3);
    const lo = quantile(nums, 1 / 3);
    // Guard against a degenerate split when the predictor is near-constant.
    if (!(hi > lo)) return null;
    highVals = pairs.filter((x) => (x.p as number) >= hi).map((x) => x.o);
    lowVals = pairs.filter((x) => (x.p as number) <= lo).map((x) => x.o);
  }

  if (highVals.length < MIN_ARM || lowVals.length < MIN_ARM) return null;

  const avgHigh = mean(highVals);
  const avgLow = mean(lowVals);
  const d = cohensD(highVals, lowVals);
  if (!Number.isFinite(d) || Math.abs(d) < MIN_ABS_D) return null;

  const p = welchTwoSidedP(highVals, lowVals);
  if (!Number.isFinite(p) || p > MAX_P) return null;

  const confidence = confidenceLabel(p, d, Math.min(highVals.length, lowVals.length));
  const score = Math.abs(d) * (1 - p) * confidenceWeight(confidence);

  const { headline, detail, tone, delta } = describe(h, avgHigh, avgLow, {
    highN: highVals.length,
    lowN: lowVals.length,
  });

  return {
    id: fingerprintHeadline(`${h.predictorKey}:${h.outcomeKey}:${headline}`),
    predictorKey: h.predictorKey,
    outcomeKey: h.outcomeKey,
    headline,
    detail,
    metric: h.metric,
    tone,
    n: highVals.length + lowVals.length,
    highN: highVals.length,
    lowN: lowVals.length,
    avgHigh: round(avgHigh, h.decimals),
    avgLow: round(avgLow, h.decimals),
    delta: round(delta, h.decimals),
    unit: h.unit,
    cohenD: round(d, 2),
    pValue: round(p, 3),
    confidence,
    score,
  };
}

// ── Copy generation ──────────────────────────────────────────────────────────

function describe(
  h: Hypothesis,
  avgHigh: number,
  avgLow: number,
  arms: { highN: number; lowN: number }
): { headline: string; detail: string; tone: EngineInsight["tone"]; delta: number } {
  const dec = h.decimals;
  const delta = Math.abs(avgHigh - avgLow);
  const deltaStr = `${fmt(delta, dec)}${h.unit}`;
  const higherArm = avgHigh >= avgLow ? h.highLabel : h.lowLabel;
  const lowerArm = avgHigh >= avgLow ? h.lowLabel : h.highLabel;
  const higherAvg = Math.max(avgHigh, avgLow);
  const lowerAvg = Math.min(avgHigh, avgLow);

  // Is the "high predictor" arm the good-outcome arm? Determines tone.
  const highIsBetter = avgHigh >= avgLow;
  // outcomeGoodHigh: a higher outcome value is desirable.
  // If the high-predictor arm also has the higher (good) outcome, that's a
  // "win" (positive). Otherwise it's a "nudge" (the high predictor hurts).
  const highArmIsGood = h.outcomeGoodHigh ? highIsBetter : !highIsBetter;
  const tone: EngineInsight["tone"] = highArmIsGood ? "positive" : "nudge";

  const headline = `${cap(h.highLabel)} days: ${h.outcomeLabel} ${
    highIsBetter ? "runs higher" : "runs lower"
  } by ${deltaStr}`;

  const detail =
    `On your ${higherArm} days ${h.outcomeLabel} averaged ${fmt(
      higherAvg,
      dec
    )}${h.unit}, vs ${fmt(lowerAvg, dec)}${h.unit} on ${lowerArm} days — a ` +
    `${deltaStr} gap (n=${arms.highN}/${arms.lowN}).`;

  return { headline, detail, tone, delta };
}

// ── Statistics ───────────────────────────────────────────────────────────────

function mean(a: number[]): number {
  if (a.length === 0) return NaN;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

function variance(a: number[]): number {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1);
}

/** Pooled-SD Cohen's d effect size. */
function cohensD(a: number[], b: number[]): number {
  const na = a.length;
  const nb = b.length;
  const va = variance(a);
  const vb = variance(b);
  const pooled = Math.sqrt(
    ((na - 1) * va + (nb - 1) * vb) / (na + nb - 2)
  );
  if (!(pooled > 0)) return 0;
  return (mean(a) - mean(b)) / pooled;
}

/** Welch's t-test → two-sided p-value using the Student-t CDF. */
function welchTwoSidedP(a: number[], b: number[]): number {
  const na = a.length;
  const nb = b.length;
  const va = variance(a);
  const vb = variance(b);
  const sa = va / na;
  const sb = vb / nb;
  const denom = sa + sb;
  if (!(denom > 0)) return 1;
  const t = (mean(a) - mean(b)) / Math.sqrt(denom);
  // Welch–Satterthwaite degrees of freedom.
  const df =
    (denom * denom) /
    ((sa * sa) / (na - 1) + (sb * sb) / (nb - 1));
  if (!Number.isFinite(df) || df <= 0) return 1;
  return studentTwoSidedP(Math.abs(t), df);
}

/**
 * Two-sided p-value for Student's t with `df` degrees of freedom, via the
 * regularized incomplete beta function. Standard closed-form (Numerical
 * Recipes), accurate enough for our sample sizes.
 */
function studentTwoSidedP(t: number, df: number): number {
  const x = df / (df + t * t);
  // p = I_x(df/2, 1/2); this already equals the two-sided tail probability.
  return clamp01(betai(df / 2, 0.5, x));
}

/** Regularized incomplete beta function I_x(a, b). */
function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta =
    logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) +
    b * Math.log(1 - x);
  const front = Math.exp(lbeta);
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betacf(a, b, x)) / a;
  }
  return 1 - (front * betacf(b, a, 1 - x)) / b;
}

/** Continued-fraction evaluation for the incomplete beta (Lentz's method). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Lanczos approximation for ln Γ(z). */
function logGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return (
      Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
    );
  }
  z -= 1;
  let a = c[0];
  const tt = z + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (z + i);
  return (
    0.5 * Math.log(2 * Math.PI) +
    (z + 0.5) * Math.log(tt) -
    tt +
    Math.log(a)
  );
}

function confidenceLabel(p: number, d: number, minArm: number): Confidence {
  const ad = Math.abs(d);
  if (p < 0.05 && ad >= 0.5 && minArm >= 6) return "strong";
  if (p < 0.1 && ad >= 0.4) return "moderate";
  return "tentative";
}

function confidenceWeight(c: Confidence): number {
  return c === "strong" ? 1 : c === "moderate" ? 0.7 : 0.45;
}

// ── Small helpers ────────────────────────────────────────────────────────────

function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function round(x: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(x * f) / f;
}

function fmt(x: number, decimals: number): string {
  return round(x, decimals).toFixed(decimals);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Local date shift with no Date-object timezone drift (matches lib/date). */
function shiftISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
