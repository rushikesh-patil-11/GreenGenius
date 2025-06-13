import { 
  User, InsertUser, 
  Plant, InsertPlant,
  EnvironmentReading, InsertEnvironmentReading,
  PlantCareTask, InsertPlantCareTask,
  Recommendation, InsertRecommendation,
  CareHistory, InsertCareHistory,
  PlantHealthMetric, InsertPlantHealthMetric,
  AiCareTip, InsertAiCareTip
  // Table objects (users, plants, etc.) will be accessed via schema.users, schema.plants
} from "../shared/schema";
import { eq, desc, sql, and, gte, lte, isNull, inArray, lt, gt, asc } from "drizzle-orm"; // Restored missing operators, added lt
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js'; 
import postgres from 'postgres';
import * as schema from "../shared/schema"; // Import all schema for DB typing
import { generatePlantRecommendations } from "./services/aiService";

// For upcoming tasks displayed on the dashboard
export interface UpcomingTaskDisplay extends PlantCareTask {
  plantName?: string; // Name of the plant associated with the task
}

// For recent activities displayed on the dashboard
export interface CareHistoryDisplay extends CareHistory {
  plantName?: string; // Name of the plant associated with the activity
}

// For the overall dashboard statistics
export interface DashboardStats {
  totalPlants: number;
  plantsNeedingCare: number; 
  upcomingTasks: UpcomingTaskDisplay[];
  recentActivities: CareHistoryDisplay[];
}

// Helper to map string health status to a numeric value for storage
const healthStatusToNumeric = (statusString: string): number => {
  switch (statusString) {
    case 'healthy': return 100;
    case 'needs_care': return 70;
    case 'needs_attention': return 40;
    default: return 75; // Default for unknown or other statuses
  }
};

// Define global variables for the database client and instance
// These will be initialized by the initializeDatabase function
let dbClient: postgres.Sql<{}>;
let globalDbInstance: PostgresJsDatabase<typeof schema>;
export { globalDbInstance as dbInstance }; // Export for direct use if needed

// Function to initialize the database connection
export function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL;
  console.log('[storage.ts] Attempting to initialize database...');
  // Log the length and a non-sensitive portion of the connection string for verification
  if (connectionString) {
    console.log(`[storage.ts] Retrieved DATABASE_URL. Length: ${connectionString.length}. Starts with: ${connectionString.substring(0, connectionString.indexOf('@') > 0 ? connectionString.indexOf('@') : 30)}`);
  } else {
    console.log('[storage.ts] Retrieved DATABASE_URL is undefined or empty.');
  }

  if (!connectionString) {
    console.error('[storage.ts] ERROR: DATABASE_URL is not set in environment variables. Database cannot be initialized.');
    throw new Error('DATABASE_URL is not set. Please check your .env file and server start_up sequence.');
  }

  try {
    // Add a simple onnotice handler to potentially catch more info or prevent default logging issues
    // You can also add a debug hook for more detailed query logging if needed later
    dbClient = postgres(connectionString, {
      onnotice: (notice) => { /* console.log('[Postgres Notice]', notice) */ },
      // debug: (connection, query, params, types) => {
      //   console.log('[Postgres Debug]', query, params);
      // }
    });
    globalDbInstance = drizzle(dbClient, { schema });
    console.log('[storage.ts] Database client and Drizzle instance initialized successfully.');
  } catch (error) {
    console.error('[storage.ts] ERROR: Failed to initialize postgres client or Drizzle instance:', error);
    console.error('[storage.ts] Connection String used:', connectionString); // Log the connection string on error
    throw error; // Re-throw the error to halt server startup if DB connection fails
  }
}

// Define interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByClerkId(clerkId: string): Promise<User | undefined>;
  getOrCreateUserByClerkId(clerkId: string, clerkUserData: { email: string; username?: string | null; firstName?: string | null; lastName?: string | null }): Promise<User>;
  createUser(user: InsertUser): Promise<User>;

  // Plant operations
  getPlantById(id: string): Promise<Plant | undefined>;
  getPlantsByUserId(userId: string): Promise<Plant[]>;
  createPlant(plant: InsertPlant): Promise<Plant>;
  updatePlant(id: string, plant: Partial<InsertPlant>): Promise<Plant | undefined>;
  deletePlant(id: string): Promise<void>;

  // Environment readings operations
  getLatestEnvironmentReadingByUserId(userId: string): Promise<EnvironmentReading | undefined>;
  createEnvironmentReading(reading: InsertEnvironmentReading): Promise<EnvironmentReading>;

  // Plant care tasks operations
  getPlantCareTasksByUserId(userId: string): Promise<PlantCareTask[]>;
  createPlantCareTask(task: InsertPlantCareTask): Promise<PlantCareTask>;
  completePlantCareTask(id: string): Promise<PlantCareTask | undefined>;
  skipPlantCareTask(id: string): Promise<PlantCareTask | undefined>;

  // Recommendations operations
  getRecommendationsByUserId(userId: string): Promise<Recommendation[]>;
  getRecommendationsByPlantId(plantId: string): Promise<Recommendation[]>; 
  createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation>;
  applyRecommendation(id: string): Promise<Recommendation | undefined>;
  generateRecommendations(userId: string): Promise<void>;

  // Care history operations
  getCareHistoryByPlantId(plantId: string): Promise<CareHistory[]>;
  getAllUserCareHistory(userId: number): Promise<CareHistory[]>;
  createCareHistory(history: InsertCareHistory): Promise<CareHistory>;

  // Plant health metrics
  getPlantHealthMetrics(plantId: string): Promise<PlantHealthMetric | undefined>;
  updatePlantHealthMetrics(plantId: string, metrics?: Partial<InsertPlantHealthMetric>): Promise<PlantHealthMetric | undefined>;

  // AI Care Tips
  saveAiCareTips(plantId: string, userId: string, tips: Array<{ category: string; tip: string }>): Promise<void>;
  getAiCareTips(plantId: string, userId: string): Promise<schema.AiCareTip[]>; 

  // Dashboard stats
  getDashboardStats(userId: string): Promise<DashboardStats>;
}

// Database storage implementation
export class DbStorage implements IStorage {
  // Helper to get all care history for a user's plants (e.g., for a full activity feed)
 
  // Use a getter to ensure the db instance is accessed only after initialization
  private get db(): PostgresJsDatabase<typeof schema> {
    if (!globalDbInstance) {
      console.error("[DbStorage] CRITICAL: Database instance accessed before initialization!");
      throw new Error("Database not initialized. Call initializeDatabase() first.");
    }
    return globalDbInstance;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, parseInt(id)),
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });
  }

  async getUserByClerkId(clerkId: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(schema.users.clerkId, clerkId),
    });
  }

  async getOrCreateUserByClerkId(clerkId: string, clerkUserData: { email: string; username?: string | null; firstName?: string | null; lastName?: string | null }): Promise<User> {
    let user = await this.db.query.users.findFirst({
      where: eq(schema.users.clerkId, clerkId),
    });

    if (user) {
      return user;
    }

    // User not found, create a new one
    const baseUserName = clerkUserData.username || clerkUserData.email.split('@')[0];
    const newName = `${clerkUserData.firstName || ''} ${clerkUserData.lastName || ''}`.trim() || baseUserName;
    let attempt = 0;
    const maxAttempts = 5; // Max attempts to generate a unique username

    while (attempt < maxAttempts) {
      const effectiveUserName = attempt === 0 ? baseUserName : `${baseUserName}_${Math.random().toString(36).substring(2, 7)}`;
      
      try {
        const userData: InsertUser = {
          clerkId: clerkId,
          username: effectiveUserName,
          email: clerkUserData.email,
          name: newName,
          // password will be undefined here, matching its optional nature in InsertUser
        };
        const newUserRecord = await this.db.insert(schema.users).values(userData).returning();
        
        if (newUserRecord.length === 0) {
          console.error(`[DbStorage] Failed to create or retrieve user after insert for Clerk ID: ${clerkId} (attempt ${attempt + 1})`);
          // This case should ideally not happen if insert was successful and there's no error, but as a safeguard:
          throw new Error(`Failed to create or retrieve user for Clerk ID: ${clerkId} after insert returned empty.`);
        }
        console.log(`[DbStorage] New user created for Clerk ID ${clerkId} with username "${effectiveUserName}":`, newUserRecord[0]);
        return newUserRecord[0];

      } catch (error: any) {
        // Check for PostgreSQL unique violation error (code 23505)
        if (error.code === '23505' && error.constraint_name && error.constraint_name.includes('username')) { 
          console.warn(`[DbStorage] Username "${effectiveUserName}" already exists. Retrying with a new username (attempt ${attempt + 1}/${maxAttempts}). ClerkID: ${clerkId}`);
          attempt++;
          if (attempt >= maxAttempts) {
            console.error(`[DbStorage] Failed to create user for Clerk ID ${clerkId} after ${maxAttempts} attempts due to persistent username collision.`);
            throw new Error(`Failed to create user for Clerk ID ${clerkId} due to persistent username collision. Base username: ${baseUserName}`);
          }
          // Continue to the next iteration of the while loop to retry with a new username
        } else {
          // Different error, re-throw
          console.error(`[DbStorage] Error creating user for Clerk ID ${clerkId} (username: "${effectiveUserName}", attempt ${attempt + 1}):`, error.message, error.code ? `(Code: ${error.code})` : '');
          throw error;
        }
      }
    }
    // Fallback, should ideally be caught by maxAttempts throw inside the loop.
    throw new Error(`[DbStorage] Exhausted attempts to create user for Clerk ID ${clerkId} due to username collision. Base username: ${baseUserName}`);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await this.db.insert(schema.users).values(user).returning();
    return newUser as User;
  }

  // Plant operations
  async getPlantById(id: string): Promise<Plant | undefined> {
    const result = await this.db.select().from(schema.plants).where(eq(schema.plants.id, parseInt(id))).limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      acquiredDate: result[0].acquiredDate ? new Date(result[0].acquiredDate) : null,
      lastWatered: result[0].lastWatered ? new Date(result[0].lastWatered) : null,
    } as Plant;
  }

  async getPlantsByUserId(userId: string): Promise<Plant[]> {
    const result = await this.db.select().from(schema.plants).where(eq(schema.plants.userId, parseInt(userId)));
    return result.map(p => ({
      ...p,
      acquiredDate: p.acquiredDate ? new Date(p.acquiredDate) : null,
      lastWatered: p.lastWatered ? new Date(p.lastWatered) : null,
    })) as Plant[];
  }

  async createPlant(plantInput: schema.InsertPlant): Promise<Plant> {
    console.log('[storage.ts] DbStorage.createPlant: Attempting to insert plant:', JSON.stringify(plantInput, null, 2));
    try {
      // Runtime check for required fields directly on plantInput
      if (plantInput.userId === undefined || plantInput.userId === null || typeof plantInput.userId !== 'number' || 
          typeof plantInput.name !== 'string' || !plantInput.name) {
        console.error('[storage.ts] DbStorage.createPlant: CRITICAL - userId or name is missing/invalid in the input plant object.', plantInput);
        throw new Error('Internal Server Error: Cannot create plant without valid userId and name.');
      }

      // Manually construct the object for insertion.
      // Omit 'id' as it's auto-generated.
      // Use fields directly from plantInput, assuming plantInput conforms to schema.InsertPlant.
      const dataToInsert: schema.InsertPlant = {
        // id: undefined, // REMOVED - Drizzle handles serial PKs; this line caused a lint error.
        // Required fields from schema
        userId: plantInput.userId, // Use directly from plantInput
        name: plantInput.name,     // Use directly from plantInput

        // Perenual API fields (optional or nullable in schema)
        perenual_id: plantInput.perenual_id,
        scientific_name: plantInput.scientific_name,
        other_name: plantInput.other_name,
        family: plantInput.family,
        origin: plantInput.origin,
        type: plantInput.type,
        dimensions: plantInput.dimensions,
        cycle: plantInput.cycle,
        watering_general_benchmark: plantInput.watering_general_benchmark,
        sunlight: plantInput.sunlight,
        pruning_month: plantInput.pruning_month,
        hardiness: plantInput.hardiness,
        flowers: plantInput.flowers,
        flowering_season: plantInput.flowering_season,
        soil: plantInput.soil,
        pest_susceptibility: plantInput.pest_susceptibility,
        cones: plantInput.cones,
        fruits: plantInput.fruits,
        edible_fruit: plantInput.edible_fruit,
        fruiting_season: plantInput.fruiting_season,
        leaf: plantInput.leaf,
        edible_leaf: plantInput.edible_leaf,
        growth_rate: plantInput.growth_rate,
        maintenance: plantInput.maintenance,
        medicinal: plantInput.medicinal,
        poisonous_to_humans: plantInput.poisonous_to_humans,
        poisonous_to_pets: plantInput.poisonous_to_pets,
        drought_tolerant: plantInput.drought_tolerant,
        salt_tolerant: plantInput.salt_tolerant,
        thorny: plantInput.thorny,
        invasive: plantInput.invasive,
        rare: plantInput.rare,
        tropical: plantInput.tropical,
        cuisine: plantInput.cuisine,
        indoor: plantInput.indoor,
        care_level: plantInput.care_level,
        description: plantInput.description,
        api_image_url: plantInput.api_image_url,
        // Ensure Date objects or null for timestamp fields
        last_api_sync: plantInput.last_api_sync ? new Date(plantInput.last_api_sync) : null,

        // Original plant fields (optional or nullable in schema)
        species: plantInput.species,
        acquiredDate: plantInput.acquiredDate ? new Date(plantInput.acquiredDate) : null,
        status: plantInput.status,
        lastWatered: plantInput.lastWatered ? new Date(plantInput.lastWatered) : null,
        waterFrequencyDays: plantInput.waterFrequencyDays,
        notes: plantInput.notes,
      };

      const [newPlantFromDb] = await this.db.insert(schema.plants).values(dataToInsert).returning();

      console.log('[storage.ts] DbStorage.createPlant: Result from DB insert:', JSON.stringify(newPlantFromDb, null, 2));

      // Check if newPlantFromDb is valid and has an ID (assuming ID is a number and should be > 0)
      if (!newPlantFromDb || typeof newPlantFromDb.id !== 'number' || newPlantFromDb.id <= 0) {
        const errorMsg = '[storage.ts] DbStorage.createPlant: ERROR - Plant insertion failed or did not return a valid ID.';
        console.error(errorMsg, 'Received:', JSON.stringify(newPlantFromDb, null, 2));
        throw new Error('Plant creation in DB failed to return a valid plant with ID.');
      }

      // Create initial health metrics for the new plant
      try {
        await this.updatePlantHealthMetrics(newPlantFromDb.id.toString());
        console.log(`[storage.ts] DbStorage.createPlant: Successfully created initial health metrics for plant ID: ${newPlantFromDb.id}`);
      } catch (metricsError) {
        // Log the error, but don't let it block returning the created plant if the plant itself was created.
        // Depending on requirements, you might want to make this a transactional operation or handle the error more strictly.
        console.error(`[storage.ts] DbStorage.createPlant: ERROR creating initial health metrics for plant ID: ${newPlantFromDb.id}`, metricsError);
        // Optionally, re-throw if metrics are critical for plant creation to be considered successful:
        // throw new Error(`Failed to create initial health metrics for plant ${newPlantFromDb.id}: ${metricsError.message}`);
      }

      // Convert date strings from DB to Date objects for the returned Plant object
      const resultPlant = {
        ...newPlantFromDb,
        acquiredDate: newPlantFromDb.acquiredDate ? new Date(newPlantFromDb.acquiredDate) : null,
        lastWatered: newPlantFromDb.lastWatered ? new Date(newPlantFromDb.lastWatered) : null,
      };

      // --- Auto-create watering task after plant creation ---
      try {
        let dueDate = new Date();
        if (typeof resultPlant.waterFrequencyDays === 'number' && resultPlant.waterFrequencyDays > 0) {
          dueDate.setDate(dueDate.getDate() + resultPlant.waterFrequencyDays);
        }
        await this.createPlantCareTask({
          plantId: resultPlant.id.toString(),
          type: 'watering',
          dueDate,
          status: 'pending',
        });
        console.log(`[storage.ts] Auto-created watering task for plant ID: ${resultPlant.id} with due date: ${dueDate}`);
      } catch (taskErr) {
        console.error(`[storage.ts] Error auto-creating watering task for plant ID: ${resultPlant.id}`, taskErr);
      }

      console.log('[storage.ts] DbStorage.createPlant: Returning plant:', JSON.stringify(resultPlant, null, 2));
      // The 'as Plant' cast assumes resultPlant now conforms to the Plant type.
      // This was present in the original code and is kept for consistency.
      return resultPlant as Plant;

    } catch (error) {
      console.error('[storage.ts] DbStorage.createPlant: ERROR during plant insertion:', error);
      // Re-throw the error so the route handler can catch it and send an appropriate HTTP error
      throw error;
    }
  }

  async updatePlant(id: string, plantData: Partial<InsertPlant>): Promise<Plant | undefined> {
    const [updatedPlant] = await this.db.update(schema.plants).set(plantData).where(eq(schema.plants.id, parseInt(id))).returning();
    if (!updatedPlant) return undefined;
    return {
      ...updatedPlant,
      acquiredDate: updatedPlant.acquiredDate ? new Date(updatedPlant.acquiredDate) : null,
      lastWatered: updatedPlant.lastWatered ? new Date(updatedPlant.lastWatered) : null,
    } as Plant;
  }

  async deletePlant(id: string): Promise<void> {
    try {
      // First, delete any recommendations associated with this plant
      await this.db.delete(schema.recommendations)
        .where(eq(schema.recommendations.plantId, parseInt(id)));

      // Then, delete the plant
      const result = await this.db.delete(schema.plants)
        .where(eq(schema.plants.id, parseInt(id)))
        .returning();

      if (result.length === 0) {
        throw new Error(`Plant with ID ${id} not found`);
      }
      console.log(`[DbStorage] Successfully deleted plant with ID ${id} and its recommendations`);
    } catch (error) {
      console.error(`[DbStorage] Error deleting plant with ID ${id}:`, error);
      throw error;
    }
  }

  // Environment readings operations
  async getLatestEnvironmentReadingByUserId(userId: string): Promise<EnvironmentReading | undefined> {
    const result = await this.db.select().from(schema.environmentReadings)
      .where(eq(schema.environmentReadings.userId, parseInt(userId)))
      .orderBy(desc(schema.environmentReadings.readingTimestamp))
      .limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      temperature: result[0].temperature ?? null,
      humidity: result[0].humidity ?? null,
      lightLevel: result[0].lightLevel ?? null,
      readingTimestamp: result[0].readingTimestamp ? new Date(result[0].readingTimestamp) : null,
    } as EnvironmentReading;
  }

  async createEnvironmentReading(reading: InsertEnvironmentReading): Promise<EnvironmentReading> {
    const [newReading] = await this.db.insert(schema.environmentReadings).values(reading).returning();
    return {
      ...newReading,
      temperature: newReading.temperature ?? null,
      humidity: newReading.humidity ?? null,
      lightLevel: newReading.lightLevel ?? null,
      readingTimestamp: newReading.readingTimestamp ? new Date(newReading.readingTimestamp) : null,
    } as EnvironmentReading;
  }

  // Plant care tasks operations
  async getPlantCareTasksByUserId(userId: string): Promise<PlantCareTask[]> {
    try {
      const tasks = await this.db
        .select({
          id: schema.plantCareTasks.id,
          plantId: schema.plantCareTasks.plantId,
          type: schema.plantCareTasks.type,
          status: schema.plantCareTasks.status,
          dueDate: schema.plantCareTasks.dueDate,
          completedAt: schema.plantCareTasks.completedAt,
          lastCareDate: schema.plantCareTasks.lastCareDate,
          createdAt: schema.plantCareTasks.createdAt,
          updatedAt: schema.plantCareTasks.updatedAt,
        })
        .from(schema.plantCareTasks)
        .innerJoin(schema.plants, eq(schema.plantCareTasks.plantId, schema.plants.id))
        .where(eq(schema.plants.userId, parseInt(userId)))
        .orderBy(desc(schema.plantCareTasks.dueDate));
      return tasks.map(task => ({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate) : new Date(),
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        lastCareDate: task.lastCareDate ? new Date(task.lastCareDate) : undefined,
        createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
        updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date(),
      })) as PlantCareTask[];
    } catch (error) {
      console.error('[DbStorage] Error fetching plant care tasks by userId:', error);
      throw error;
    }
  }

  async createPlantCareTask(task: InsertPlantCareTask): Promise<PlantCareTask> {
    try {
      const [newTask] = await this.db
        .insert(schema.plantCareTasks)
        .values({
          id: crypto.randomUUID(),
          plantId: task.plantId.toString(),
          type: task.type,
          status: task.status || 'pending',
          dueDate: task.dueDate,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return {
        ...newTask,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : new Date(),
        completedAt: newTask.completedAt ? new Date(newTask.completedAt) : null,
        createdAt: newTask.createdAt ? new Date(newTask.createdAt) : new Date(),
        updatedAt: newTask.updatedAt ? new Date(newTask.updatedAt) : new Date(),
      } as PlantCareTask;
    } catch (error) {
      console.error('[DbStorage] Error creating plant care task:', error);
      throw error;
    }
  }

  async completePlantCareTask(id: string): Promise<PlantCareTask | undefined> {
    try {
      const [updatedTask] = await this.db
        .update(schema.plantCareTasks)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.plantCareTasks.id, id))
      .returning();
    
      if (!updatedTask) return undefined;

    return {
        ...updatedTask,
        dueDate: updatedTask.dueDate ? new Date(updatedTask.dueDate) : new Date(),
        completedAt: updatedTask.completedAt ? new Date(updatedTask.completedAt) : undefined,
        lastCareDate: updatedTask.lastCareDate ? new Date(updatedTask.lastCareDate) : undefined,
        createdAt: updatedTask.createdAt ? new Date(updatedTask.createdAt) : new Date(),
        updatedAt: updatedTask.updatedAt ? new Date(updatedTask.updatedAt) : new Date(),
      } as PlantCareTask;
    } catch (error) {
      console.error('[DbStorage] Error completing plant care task:', error);
      throw error;
    }
  }

  async skipPlantCareTask(id: string): Promise<PlantCareTask | undefined> {
    try {
      const [updatedTask] = await this.db
        .update(schema.plantCareTasks)
        .set({
          status: 'skipped',
          updatedAt: new Date(),
        })
        .where(eq(schema.plantCareTasks.id, id))
        .returning();

      if (!updatedTask) return undefined;

      return {
        ...updatedTask,
        dueDate: updatedTask.dueDate ? new Date(updatedTask.dueDate) : new Date(),
        completedAt: updatedTask.completedAt ? new Date(updatedTask.completedAt) : undefined,
        lastCareDate: updatedTask.lastCareDate ? new Date(updatedTask.lastCareDate) : undefined,
        createdAt: updatedTask.createdAt ? new Date(updatedTask.createdAt) : new Date(),
        updatedAt: updatedTask.updatedAt ? new Date(updatedTask.updatedAt) : new Date(),
      } as PlantCareTask;
    } catch (error) {
      console.error('[DbStorage] Error skipping plant care task:', error);
      throw error;
    }
  }

  // Recommendations operations
  async getRecommendationsByUserId(userId: string): Promise<Recommendation[]> {
    const result = await this.db.query.recommendations.findMany({
      where: eq(schema.recommendations.userId, parseInt(userId)),
      orderBy: [desc(schema.recommendations.createdAt)],
    });
    return result.map(rec => ({
      ...rec,
      plantId: rec.plantId ?? null,
      applied: rec.applied ?? false,
      createdAt: rec.createdAt ? new Date(rec.createdAt) : new Date(),
    })) as Recommendation[];
  }

  async getRecommendationsByPlantId(plantId: string): Promise<Recommendation[]> {
    console.log(`[DbStorage] Fetching recommendations for plantId: ${plantId}`);
    const result = await this.db.query.recommendations.findMany({
      where: eq(schema.recommendations.plantId, parseInt(plantId)),
      orderBy: [desc(schema.recommendations.createdAt)],
    });
    console.log(`[DbStorage] Found ${result.length} recommendations for plantId: ${plantId}`);
    return result.map(rec => ({
        ...rec,
      plantId: rec.plantId ?? null,
      applied: rec.applied ?? false,
      createdAt: rec.createdAt ? new Date(rec.createdAt) : new Date(),
    })) as Recommendation[];
  }

  async applyRecommendation(id: string): Promise<Recommendation | undefined> {
    const recommendation = await this.db.query.recommendations.findFirst({
      where: eq(schema.recommendations.id, parseInt(id)),
    });
    if (!recommendation) return undefined;

    const [recommendationUpdated] = await this.db
      .update(schema.recommendations)
      .set({ applied: true })
      .where(eq(schema.recommendations.id, parseInt(id)))
      .returning();
    
    if (!recommendationUpdated) return undefined;
    
    if (recommendationUpdated.recommendationType === 'water' && recommendationUpdated.plantId) {
      const plant = await this.getPlantById(recommendationUpdated.plantId.toString());
      if (plant) {
        await this.updatePlant(plant.id.toString(), { lastWatered: new Date() });
        await this.createCareHistory({
          plantId: plant.id,
          actionType: 'water_recommended',
        });
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        await this.createPlantCareTask({
          plantId: plant.id.toString(),
          type: 'water',
          dueDate: dueDate,
          status: 'pending',
        });
      }
    }
    
    if (recommendationUpdated.recommendationType === 'pruning' && recommendationUpdated.plantId) {
      const plant = await this.getPlantById(recommendationUpdated.plantId.toString());
      if (plant) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        await this.createPlantCareTask({
          plantId: plant.id.toString(),
          type: 'pruning',
          dueDate: dueDate,
          status: 'pending',
        });
      }
    }
    
    if (recommendationUpdated.recommendationType === 'light' && recommendationUpdated.plantId) {
      const plant = await this.getPlantById(recommendationUpdated.plantId.toString());
      if (plant) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        await this.createPlantCareTask({
          plantId: plant.id.toString(),
          type: 'light',
          dueDate: dueDate,
          status: 'pending',
        });
      }
    }
    
    return {
      ...recommendationUpdated,
      plantId: recommendationUpdated.plantId ?? null,
      applied: recommendationUpdated.applied ?? false,
      createdAt: recommendationUpdated.createdAt ? new Date(recommendationUpdated.createdAt) : new Date(),
    } as Recommendation;
  }

  async generateRecommendations(userId: string): Promise<void> {
    // 1. Fetch all plants for the user
    const userPlants = await this.db
      .select()
      .from(schema.plants)
      .where(eq(schema.plants.userId, parseInt(userId)));

    // 2. Fetch the latest environment reading for the user
    const latestEnvironment = await this.getLatestEnvironmentReadingByUserId(userId);

    if (!latestEnvironment) {
      console.warn(`[DbStorage] No environment data found for user ${userId}. Cannot generate recommendations.`);
      return;
    }

    const now = new Date();

    for (const plant of userPlants) {
      try {
        const aiRecommendations = await generatePlantRecommendations(plant, latestEnvironment);

        // 4. Store the generated recommendations
        for (const rec of aiRecommendations) {
          await this.db.insert(schema.recommendations).values({
            userId: parseInt(userId),
            plantId: plant.id,
            recommendationType: rec.recommendationType,
            message: rec.message,
            applied: false,
            createdAt: now,
          });
        }
      } catch (error) {
        console.error(`[DbStorage] Error generating AI recommendations for plant ${plant.id}:`, error);
      }
    }
  }

  // Care history operations
  async getCareHistoryByPlantId(plantId: string): Promise<CareHistory[]> {
    const history = await this.db.select().from(schema.careHistory)
      .where(eq(schema.careHistory.plantId, parseInt(plantId)))
      .orderBy(desc(schema.careHistory.performedAt));
    return history.map(h => ({
      ...h,
      performedAt: h.performedAt ? new Date(h.performedAt) : null,
    })) as CareHistory[];
  }

  async createCareHistory(history: InsertCareHistory): Promise<CareHistory> {
    const [newHistory] = await this.db.insert(schema.careHistory).values(history).returning();
    return {
      ...newHistory,
      performedAt: newHistory.performedAt ? new Date(newHistory.performedAt) : new Date(),
    } as CareHistory;
  }

  // Helper to get all care history for a user's plants (e.g., for a full activity feed)
  async getAllUserCareHistory(userId: number): Promise<CareHistory[]> {
    const historyResult = await this.db
      .select({
        id: schema.careHistory.id,
        plantId: schema.careHistory.plantId,
        actionType: schema.careHistory.actionType,
        performedAt: schema.careHistory.performedAt,
        notes: schema.careHistory.notes,
      })
      .from(schema.careHistory)
      .innerJoin(schema.plants, eq(schema.careHistory.plantId, schema.plants.id))
      .where(eq(schema.plants.userId, userId))
      .orderBy(desc(schema.careHistory.performedAt));

    return historyResult.map(h => ({
      id: h.id,
      plantId: h.plantId,
      actionType: h.actionType,
      notes: h.notes,
      performedAt: h.performedAt ? new Date(h.performedAt) : null,
    })) as CareHistory[];
  }

  // Plant health metrics
  async getPlantHealthMetrics(plantId: string): Promise<PlantHealthMetric | undefined> {
    const result = await this.db.select().from(schema.plantHealthMetrics)
      .where(eq(schema.plantHealthMetrics.plantId, parseInt(plantId)))
      .orderBy(desc(schema.plantHealthMetrics.updatedAt))
      .limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      updatedAt: result[0].updatedAt ? new Date(result[0].updatedAt) : null,
    } as PlantHealthMetric;
  }

  async updatePlantHealthMetrics(plantId: string, metrics?: Partial<InsertPlantHealthMetric>): Promise<PlantHealthMetric | undefined> {
    const currentMetrics = await this.getPlantHealthMetrics(plantId);
    let newMetricsData: InsertPlantHealthMetric;

    if (currentMetrics) {
      newMetricsData = { 
        plantId: parseInt(plantId),
        waterLevel: metrics?.waterLevel ?? currentMetrics.waterLevel,
        lightLevel: metrics?.lightLevel ?? currentMetrics.lightLevel,
        overallHealth: metrics?.overallHealth ?? currentMetrics.overallHealth,
      };
      const [updated] = await this.db.update(schema.plantHealthMetrics)
        .set({ ...newMetricsData, updatedAt: new Date() })
        .where(eq(schema.plantHealthMetrics.plantId, parseInt(plantId)))
        .returning();
      return updated ? { ...updated, updatedAt: new Date(updated.updatedAt!) } as PlantHealthMetric : undefined;
    } else {
      newMetricsData = { 
        plantId: parseInt(plantId),
        waterLevel: metrics?.waterLevel ?? 100,
        lightLevel: metrics?.lightLevel ?? 100,
        overallHealth: metrics?.overallHealth ?? 100,
      };
      const [created] = await this.db.insert(schema.plantHealthMetrics).values(newMetricsData).returning();
      return created ? { ...created, updatedAt: new Date(created.updatedAt!) } as PlantHealthMetric : undefined;
    }
  }

  // AI Care Tips operations
  async saveAiCareTips(plantId: string, userId: string, tips: Array<{ category: string; tip: string }>): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        await tx.delete(schema.aiCareTips).where(
          and(
            eq(schema.aiCareTips.plantId, parseInt(plantId)),
            eq(schema.aiCareTips.userId, parseInt(userId))
          )
        );

        if (tips && tips.length > 0) {
          const tipsToInsert: schema.InsertAiCareTip[] = tips.map(tipItem => ({
            plantId: parseInt(plantId),
            userId: parseInt(userId),
            category: tipItem.category,
            tip: tipItem.tip,
            source: "AI_Groq",
          }));
          await tx.insert(schema.aiCareTips).values(tipsToInsert);
        }
      });
      console.log(`[DbStorage] AI care tips saved for plantId: ${plantId}, userId: ${userId}`);
    } catch (error) {
      console.error(`[DbStorage] Error saving AI care tips for plantId: ${plantId}, userId: ${userId}:`, error);
      throw error;
    }
  }

  async getAiCareTips(plantId: string, userId: string): Promise<schema.AiCareTip[]> {
    try {
      const tips = await this.db.query.aiCareTips.findMany({
        where: and(
          eq(schema.aiCareTips.plantId, parseInt(plantId)),
          eq(schema.aiCareTips.userId, parseInt(userId))
        ),
        orderBy: [desc(schema.aiCareTips.createdAt)],
      });
      console.log(`[DbStorage] Fetched ${tips.length} AI care tips for plantId: ${plantId}, userId: ${userId}`);
      return tips;
    } catch (error) {
      console.error(`[DbStorage] Error fetching AI care tips for plantId: ${plantId}, userId: ${userId}:`, error);
      throw error;
    }
  }

  // Dashboard stats
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    // 1. Total Plants
    const totalPlantsResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.plants)
      .where(eq(schema.plants.userId, parseInt(userId)));
    const totalPlants = totalPlantsResult[0]?.count || 0;

    // 2. Plants Needing Care (example: overdue for watering)
    const userPlantsForCareCheck = await this.db
      .select({ id: schema.plants.id, lastWatered: schema.plants.lastWatered, waterFrequencyDays: schema.plants.waterFrequencyDays })
      .from(schema.plants)
      .where(eq(schema.plants.userId, parseInt(userId)));
    
    let plantsNeedingCare = 0;
    const now = new Date();
    for (const plant of userPlantsForCareCheck) {
      if (plant.lastWatered && plant.waterFrequencyDays) {
        const lastWateredTime = new Date(plant.lastWatered).getTime();
        const overdueTime = lastWateredTime + plant.waterFrequencyDays * 24 * 60 * 60 * 1000;
        
        if (now.getTime() > overdueTime) {
          plantsNeedingCare++;
        }
      }
    }

    // 3. Upcoming Tasks (Top 5, not completed, not skipped, future due date)
    const upcomingTasksResult = await this.db
      .select({
        id: schema.plantCareTasks.id,
        plantId: schema.plantCareTasks.plantId,
        type: schema.plantCareTasks.type,
        status: schema.plantCareTasks.status,
        dueDate: schema.plantCareTasks.dueDate,
        completedAt: schema.plantCareTasks.completedAt,
        lastCareDate: schema.plantCareTasks.lastCareDate,
        createdAt: schema.plantCareTasks.createdAt,
        updatedAt: schema.plantCareTasks.updatedAt,
        plantName: schema.plants.name 
      })
      .from(schema.plantCareTasks)
      .innerJoin(schema.plants, eq(schema.plantCareTasks.plantId, schema.plants.id))
      .where(and(
        eq(schema.plants.userId, parseInt(userId)),
        eq(schema.plantCareTasks.status, 'pending'),
        gt(schema.plantCareTasks.dueDate, now)
      ))
      .orderBy(asc(schema.plantCareTasks.dueDate))
      .limit(5);

    const upcomingTasks: UpcomingTaskDisplay[] = upcomingTasksResult.map(task => ({
      id: task.id,
      plantId: task.plantId,
      type: task.type,
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate) : new Date(),
      completedAt: task.completedAt ? new Date(task.completedAt) : null,
      lastCareDate: task.lastCareDate ? new Date(task.lastCareDate) : null,
      createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
      updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date(),
      plantName: task.plantName ?? 'Unknown Plant',
    }));

    // 4. Recent Activities (Top 5)
    const recentActivitiesResult = await this.db
      .select({
        id: schema.careHistory.id,
        plantId: schema.careHistory.plantId,
        actionType: schema.careHistory.actionType,
        performedAt: schema.careHistory.performedAt,
        notes: schema.careHistory.notes,
        plantName: schema.plants.name
      })
      .from(schema.careHistory)
      .innerJoin(schema.plants, eq(schema.careHistory.plantId, schema.plants.id))
      .where(eq(schema.plants.userId, parseInt(userId)))
      .orderBy(desc(schema.careHistory.performedAt))
      .limit(5);
    
    const recentActivities: CareHistoryDisplay[] = recentActivitiesResult.map(activity => ({
      id: activity.id,
      plantId: activity.plantId,
      actionType: activity.actionType,
      notes: activity.notes,
      performedAt: activity.performedAt ? new Date(activity.performedAt) : null,
      plantName: activity.plantName ?? 'Unknown Plant',
    }));

    return {
      totalPlants,
      plantsNeedingCare,
      upcomingTasks,
      recentActivities,
    };
  }

  async createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation> {
    const [newRecommendation] = await this.db
      .insert(schema.recommendations)
      .values({
        ...recommendation,
        userId: parseInt(recommendation.userId.toString()),
        plantId: recommendation.plantId ? parseInt(recommendation.plantId.toString()) : null,
        applied: false,
        createdAt: new Date(),
      })
      .returning();
    return {
      ...newRecommendation,
      plantId: newRecommendation.plantId ?? null,
      applied: newRecommendation.applied ?? false,
      createdAt: newRecommendation.createdAt ? new Date(newRecommendation.createdAt) : new Date(),
    } as Recommendation;
  }
}

// Initialize database storage
// The actual DB connection is now deferred to initializeDatabase()
export const storage = new DbStorage();
console.log(`[storage.ts] EXPORTING storage instance of type: ${storage.constructor.name} at module load`);
