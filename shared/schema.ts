import { pgTable, text, serial, integer, timestamp, boolean, real, jsonb, unique } from "drizzle-orm/pg-core";
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
  // Perenual API data fields
  perenual_id: integer("perenual_id"), // Perenual API species ID - uniqueness will be handled by composite key
  scientific_name: text("scientific_name").array(),
  other_name: text("other_name").array(),
  family: text("family"),
  origin: text("origin").array(),
  type: text("type"),
  dimensions: jsonb("dimensions"), // { type, min_value, max_value, unit }
  cycle: text("cycle"), // e.g., Perennial, Annual, Biennial
  watering_general_benchmark: jsonb("watering_general_benchmark"), // { value, unit }
  sunlight: text("sunlight").array(),
  pruning_month: text("pruning_month").array(),
  hardiness: jsonb("hardiness"), // { min, max }
  flowers: boolean("flowers"),
  flowering_season: text("flowering_season"),
  soil: text("soil").array(),
  pest_susceptibility: text("pest_susceptibility").array(),
  cones: boolean("cones"),
  fruits: boolean("fruits"),
  edible_fruit: boolean("edible_fruit"),
  fruiting_season: text("fruiting_season"),
  leaf: boolean("leaf"),
  edible_leaf: boolean("edible_leaf"),
  growth_rate: text("growth_rate"),
  maintenance: text("maintenance"),
  medicinal: boolean("medicinal"),
  poisonous_to_humans: boolean("poisonous_to_humans"),
  poisonous_to_pets: boolean("poisonous_to_pets"),
  drought_tolerant: boolean("drought_tolerant"),
  salt_tolerant: boolean("salt_tolerant"),
  thorny: boolean("thorny"),
  invasive: boolean("invasive"),
  rare: boolean("rare"),
  tropical: boolean("tropical"),
  cuisine: boolean("cuisine"),
  indoor: boolean("indoor"),
  care_level: text("care_level"),
  description: text("description"),
  api_image_url: text("api_image_url"), // From Perenual default_image.regular_url
  last_api_sync: timestamp("last_api_sync"),

  // Original fields start here:
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  species: text("species"),
  acquiredDate: timestamp("acquired_date"),
  status: text("status").default("healthy"),
  lastWatered: timestamp("last_watered"),
  waterFrequencyDays: integer("water_frequency_days"),
  notes: text("notes") // Text fields are nullable by default
}, (table) => {
  return {
    userPerenualPlantUniqueConstraint: unique("user_perenual_plant_unique").on(table.userId, table.perenual_id),
  };
});

// Create the base schema
const basePlantSchema = createInsertSchema(plants).omit({
  id: true
  // userId: true // REMOVED: userId is required for insert and should be part of the schema
});

// Create a modified schema with basic validation
export const insertPlantSchema = basePlantSchema.extend({
  // Fields from Perenual API
  perenual_id: z.number().int().optional().nullable(),
  scientific_name: z.array(z.string()).optional().nullable(),
  other_name: z.array(z.string()).optional().nullable(),
  family: z.string().optional().nullable(),
  origin: z.array(z.string()).optional().nullable(),
  type: z.string().optional().nullable(),
  dimensions: z.any().optional().nullable(), // Consider defining a Zod schema for this if strict validation is needed
  cycle: z.string().optional().nullable(),
  watering_general_benchmark: z.any().optional().nullable(), // Consider defining a Zod schema for this
  sunlight: z.array(z.string()).optional().nullable(),
  pruning_month: z.array(z.string()).optional().nullable(),
  hardiness: z.any().optional().nullable(), // Consider defining a Zod schema for this
  flowers: z.boolean().optional().nullable(),
  flowering_season: z.string().optional().nullable(),
  soil: z.array(z.string()).optional().nullable(),
  pest_susceptibility: z.array(z.string()).optional().nullable(),
  cones: z.boolean().optional().nullable(),
  fruits: z.boolean().optional().nullable(),
  edible_fruit: z.boolean().optional().nullable(),
  fruiting_season: z.string().optional().nullable(),
  leaf: z.boolean().optional().nullable(),
  edible_leaf: z.boolean().optional().nullable(),
  growth_rate: z.string().optional().nullable(),
  maintenance: z.string().optional().nullable(),
  medicinal: z.boolean().optional().nullable(),
  poisonous_to_humans: z.boolean().optional().nullable(),
  poisonous_to_pets: z.boolean().optional().nullable(),
  drought_tolerant: z.boolean().optional().nullable(),
  salt_tolerant: z.boolean().optional().nullable(),
  thorny: z.boolean().optional().nullable(),
  invasive: z.boolean().optional().nullable(),
  rare: z.boolean().optional().nullable(),
  tropical: z.boolean().optional().nullable(),
  cuisine: z.boolean().optional().nullable(),
  indoor: z.boolean().optional().nullable(),
  care_level: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  api_image_url: z.string().url({ message: "Invalid URL format" }).optional().nullable(),
  last_api_sync: z.coerce.date().optional().nullable(),

  // Original extended fields:
  name: z.string().min(1, "Plant name is required"), // Ensure name is not empty
  species: z.string().optional().nullable(),
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
  plantId: integer("plant_id").notNull().unique().references(() => plants.id, { onDelete: "cascade" }),
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

export interface PlantCareTask {
  id: string;
  plantId: string;
  type: 'watering' | 'fertilizing' | 'pruning';
  dueDate: Date;
  status: 'pending' | 'completed' | 'skipped';
  completedAt?: Date;
  lastCareDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
