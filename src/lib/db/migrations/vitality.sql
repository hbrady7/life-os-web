-- Vitality feature tables. Idempotent — safe to run against the existing
-- DB. The project's normal `npm run db:push` will also create exactly
-- these missing tables from schema.ts; this file is a standalone fallback
-- (e.g. apply via the Neon SQL console) when db:push credentials aren't
-- handy. Text "enum" columns are plain text (drizzle enforces the union
-- in TS), so no PG enum types are needed.

CREATE TABLE IF NOT EXISTS "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"content" text NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "memories_user_idx" ON "memories" ("user_id");

CREATE TABLE IF NOT EXISTS "mentor_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "mentor_messages_user_idx" ON "mentor_messages" ("user_id");

CREATE TABLE IF NOT EXISTS "caffeine_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"mg" real NOT NULL,
	"label" text,
	"logged_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "caffeine_logs_user_idx" ON "caffeine_logs" ("user_id","logged_at");

CREATE TABLE IF NOT EXISTS "supplements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"dose" text,
	"window" text DEFAULT 'anytime' NOT NULL,
	"note" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "supplements_user_idx" ON "supplements" ("user_id");

CREATE TABLE IF NOT EXISTS "supplement_logs" (
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"supplement_id" uuid NOT NULL REFERENCES "supplements"("id") ON DELETE cascade,
	"date" date NOT NULL,
	"taken_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplement_logs_user_id_supplement_id_date_pk" PRIMARY KEY("user_id","supplement_id","date")
);

CREATE TABLE IF NOT EXISTS "energy_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"date" date NOT NULL,
	"state" text NOT NULL,
	"score" integer NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "energy_checkins_user_date_idx" ON "energy_checkins" ("user_id","date");

CREATE TABLE IF NOT EXISTS "plan_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"date" date NOT NULL,
	"task" text NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "plan_blocks_user_date_idx" ON "plan_blocks" ("user_id","date");
