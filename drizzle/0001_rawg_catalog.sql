ALTER TABLE "games" ADD COLUMN "release_date" date;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "genres" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "platforms" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "rating" real;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "metacritic" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "playtime" integer;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_rawg_id_unique" UNIQUE("rawg_id");