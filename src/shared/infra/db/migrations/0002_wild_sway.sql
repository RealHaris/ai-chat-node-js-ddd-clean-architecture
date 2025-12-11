DROP TABLE "admins";--> statement-breakpoint
DROP TABLE "customers";--> statement-breakpoint
DROP TABLE "refresh_tokens";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "total_spent" numeric(10, 2) DEFAULT '0.00' NOT NULL;