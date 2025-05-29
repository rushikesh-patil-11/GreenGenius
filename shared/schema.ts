import { pgTable, text, serial, integer, timestamp, boolean, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password"),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

// Plant schema
export const plants = pgTable("plants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  species: text("species"),
  imageUrl: text("image_url"),
  acquiredDate: timestamp("acquired_date"),
  status: text("status").default("healthy"),
  lastWatered: timestamp("last_watered"),
  waterFrequencyDays: integer("water_frequency_days"),
  notes: text("notes"), // Text fields are nullable by default
});

// Create the base schema
const basePlantSchema = createInsertSchema(plants).omit({
  id: true,
  userId: true // Drizzle maps snake_case 'user_id' column to camelCase 'userId' key
});

// Create a modified schema with basic validation
export const insertPlantSchema = basePlantSchema.extend({
  name: z.string().min(1, "Plant name is required"), // Ensure name is not empty
  species: z.string().optional().nullable(),
  imageUrl: z.string().url({ message: "Invalid URL format" }).optional().nullable(), // Validate as URL, optional and nullable
  acquiredDate: z.coerce.date().optional().nullable(), // Allow null in addition to undefined
  status: z.string().optional().nullable(),
  lastWatered: z.coerce.date().optional().nullable(), // Allow null in addition to undefined
  waterFrequencyDays: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Environment readings schema
export const environmentReadings = pgTable("environment_readings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  temperature: real("temperature"),
  humidity: real("humidity"),
  lightLevel: text("light_level"),
  soil_moisture_0_to_10cm: real("soil_moisture_0_to_10cm"), // Volumetric water content (m³/m³)
  readingTimestamp: timestamp("reading_timestamp").defaultNow(),
});

export const insertEnvironmentReadingSchema = createInsertSchema(environmentReadings).omit({
  id: true,
  readingTimestamp: true,
});

// Care tasks schema
export const careTasks = pgTable("care_tasks", {
  id: serial("id").primaryKey(),
  plantId: integer("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  taskType: text("task_type").notNull(), // water, fertilize, prune, etc.
  dueDate: timestamp("due_date").notNull(),
  completed: boolean("completed").default(false),
  completedDate: timestamp("completed_date"),
  skipped: boolean("skipped").default(false),
});

export const insertCareTaskSchema = createInsertSchema(careTasks).omit({
  id: true,
  completedDate: true,
});

// AI Recommendations schema
export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  plantId: integer("plant_id").references(() => plants.id, { onDelete: "cascade" }),
  recommendationType: text("recommendation_type").notNull(), // water, light, etc.
  message: text("message").notNull(),
  applied: boolean("applied").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({
  id: true,
});

// Care history schema
export const careHistory = pgTable("care_history", {
  id: serial("id").primaryKey(),
  plantId: integer("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(), // watered, fertilized, etc.
  notes: text("notes"),
  performedAt: timestamp("performed_at").defaultNow(),
});

export const insertCareHistorySchema = createInsertSchema(careHistory).omit({
  id: true,
  performedAt: true,
});

// Plant Health metrics schema
export const plantHealthMetrics = pgTable("plant_health_metrics", {
  id: serial("id").primaryKey(),
  plantId: integer("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  waterLevel: integer("water_level").default(100), // 0-100
  lightLevel: integer("light_level").default(100), // 0-100
  overallHealth: integer("overall_health").default(100), // 0-100
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlantHealthMetricsSchema = createInsertSchema(plantHealthMetrics).omit({
  id: true,
  updatedAt: true,
});

// AI Care Tips schema
export const aiCareTips = pgTable("ai_care_tips", {
  id: serial("id").primaryKey(),
  plantId: integer("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // Assuming tips are user-specific
  category: text("category").notNull(), // e.g., "Watering", "Sunlight"
  tip: text("tip").notNull(),
  source: text("source").default("AI_Groq"), // To track where the tip came from
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()), // Automatically update on modification
});

export const insertAiCareTipSchema = createInsertSchema(aiCareTips).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Plant = typeof plants.$inferSelect;
export type InsertPlant = z.infer<typeof insertPlantSchema>;

export type EnvironmentReading = typeof environmentReadings.$inferSelect;
export type InsertEnvironmentReading = z.infer<typeof insertEnvironmentReadingSchema>;

export type CareTask = typeof careTasks.$inferSelect;
export type InsertCareTask = z.infer<typeof insertCareTaskSchema>;

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;

export type CareHistory = typeof careHistory.$inferSelect;
export type InsertCareHistory = z.infer<typeof insertCareHistorySchema>;

export type PlantHealthMetric = typeof plantHealthMetrics.$inferSelect;
export type InsertPlantHealthMetric = z.infer<typeof insertPlantHealthMetricsSchema>;

export type AiCareTip = typeof aiCareTips.$inferSelect;
export type InsertAiCareTip = z.infer<typeof insertAiCareTipSchema>;

export type EnrichedCareTask = CareTask & { plantName: string | null };

// Interface for plant data used by Gemini service
export interface PlantData {
  name: string;
  species: string | null;
  waterFrequencyDays: number | null;
  lastWatered: Date | null;
}

// Interface for environment data used by Gemini service
export interface EnvironmentData {
  temperature: number | null;
  humidity: number | null;
  lightLevel: string | null;
  soil_moisture_0_to_10cm?: number | null; // Added for Gemini, optional for now
}
