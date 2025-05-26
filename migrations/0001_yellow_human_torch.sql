CREATE TABLE "ai_care_tips" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"category" text NOT NULL,
	"tip" text NOT NULL,
	"source" text DEFAULT 'AI_Groq',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_care_tips" ADD CONSTRAINT "ai_care_tips_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_care_tips" ADD CONSTRAINT "ai_care_tips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;