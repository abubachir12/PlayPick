CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"igdb_id" integer,
	"rawg_id" integer,
	"steam_id" integer,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_url" text,
	"developer" text,
	"publisher" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_igdb_id_unique" UNIQUE("igdb_id"),
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
