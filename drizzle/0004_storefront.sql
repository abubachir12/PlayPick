ALTER TABLE "games" ADD COLUMN "is_free" boolean;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "price_final" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "price_initial" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "discount_percent" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "price_currency" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "players_now" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "screenshots" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "trailer" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "requirements" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "has_russian" boolean;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "market_updated_at" timestamp;