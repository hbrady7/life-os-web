-- Mind feature tables. Idempotent — safe to run against the existing DB.
-- `npm run db:push` also creates exactly these missing tables from
-- schema.ts; this is the standalone fallback (Neon SQL console). Text
-- "enum" columns are plain text (drizzle enforces the union in TS).

CREATE TABLE IF NOT EXISTS "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"body" text,
	"status" text DEFAULT 'spark' NOT NULL,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ideas_user_idx" ON "ideas" ("user_id","created_at");

CREATE TABLE IF NOT EXISTS "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"text" text NOT NULL,
	"said_by" text,
	"context" text,
	"heard_at" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "quotes_user_idx" ON "quotes" ("user_id","created_at");

-- "How it's made" — shared app-wide daily learning (no user scope).
CREATE TABLE IF NOT EXISTS "daily_learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL UNIQUE,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Phase 1 → Phase 6 data migration: move mentor "idea" memories onto the
-- board, then stop storing ideas in memories. The app also does this
-- lazily on first ideas load, so running this is optional.
INSERT INTO "ideas" ("user_id", "title", "tags", "created_at", "updated_at")
SELECT "user_id", "content",
       CASE WHEN array_length("tags", 1) > 0 THEN "tags" ELSE NULL END,
       "created_at", "created_at"
FROM "memories" WHERE "kind" = 'idea';
DELETE FROM "memories" WHERE "kind" = 'idea';
