import { 
  User, InsertUser, 
  Plant, InsertPlant,
  EnvironmentReading, InsertEnvironmentReading,
  CareTask, InsertCareTask,
  Recommendation, InsertRecommendation,
  CareHistory, InsertCareHistory,
  PlantHealthMetric, InsertPlantHealthMetric
  // Table objects (users, plants, etc.) will be accessed via schema.users, schema.plants
} from "../shared/schema";
import { eq, desc, sql, and, gte, lte, isNull, inArray, lt, gt, asc } from "drizzle-orm"; // Restored missing operators, added lt
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js'; 
import postgres from 'postgres';
import * as schema from "../shared/schema"; // Import all schema for DB typing
import { generatePlantRecommendations } from "./services/gemini";

// For upcoming tasks displayed on the dashboard
export interface UpcomingTaskDisplay extends CareTask {
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
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByClerkId(clerkId: string): Promise<User | undefined>;
  getOrCreateUserByClerkId(clerkId: string, clerkUserData: { email: string; username?: string | null; firstName?: string | null; lastName?: string | null }): Promise<User>;
  createUser(user: InsertUser): Promise<User>;

  // Plant operations
  getPlantById(id: number): Promise<Plant | undefined>;
  getPlantsByUserId(userId: number): Promise<Plant[]>;
  createPlant(plant: InsertPlant): Promise<Plant>;
  updatePlant(id: number, plant: Partial<InsertPlant>): Promise<Plant | undefined>;
  deletePlant(id: number): Promise<void>;

  // Environment readings operations
  getLatestEnvironmentReadingByUserId(userId: number): Promise<EnvironmentReading | undefined>;
  createEnvironmentReading(reading: InsertEnvironmentReading): Promise<EnvironmentReading>;

  // Care tasks operations
  getCareTasksByUserId(userId: number): Promise<CareTask[]>;
  createCareTask(task: InsertCareTask): Promise<CareTask>;
  completeCareTask(id: number): Promise<CareTask | undefined>;
  skipCareTask(id: number): Promise<CareTask | undefined>;

  // Recommendations operations
  getRecommendationsByUserId(userId: number): Promise<Recommendation[]>;
  getRecommendationsByPlantId(plantId: number): Promise<Recommendation[]>; // Added this line
  createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation>;
  applyRecommendation(id: number): Promise<Recommendation | undefined>;
  generateRecommendations(userId: number): Promise<void>;

  // Care history operations
  getCareHistoryByPlantId(plantId: number): Promise<CareHistory[]>;
  createCareHistory(history: InsertCareHistory): Promise<CareHistory>;

  // Plant health metrics
  getPlantHealthMetrics(plantId: number): Promise<PlantHealthMetric | undefined>;
  updatePlantHealthMetrics(plantId: number, metrics?: Partial<InsertPlantHealthMetric>): Promise<PlantHealthMetric | undefined>;

  // Dashboard stats
  getDashboardStats(userId: number): Promise<DashboardStats>;
}

// Database storage implementation
export class DbStorage implements IStorage {
  // Use a getter to ensure the db instance is accessed only after initialization
  private get db(): PostgresJsDatabase<typeof schema> {
    if (!globalDbInstance) {
      console.error("[DbStorage] CRITICAL: Database instance accessed before initialization!");
      throw new Error("Database not initialized. Call initializeDatabase() first.");
    }
    return globalDbInstance;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, id),
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
        const newUserRecord = await this.db.insert(schema.users).values({
          clerkId: clerkId,
          username: effectiveUserName,
          email: clerkUserData.email,
          name: newName,
          // password will be null by default due to schema definition (text("password"))
        }).returning();
        
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
  async getPlantById(id: number): Promise<Plant | undefined> {
    const result = await this.db.select().from(schema.plants).where(eq(schema.plants.id, id)).limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      acquiredDate: result[0].acquiredDate ? new Date(result[0].acquiredDate) : null,
      lastWatered: result[0].lastWatered ? new Date(result[0].lastWatered) : null,
    } as Plant;
  }

  async getPlantsByUserId(userId: number): Promise<Plant[]> {
    const result = await this.db.select().from(schema.plants).where(eq(schema.plants.userId, userId));
    return result.map(p => ({
      ...p,
      acquiredDate: p.acquiredDate ? new Date(p.acquiredDate) : null,
      lastWatered: p.lastWatered ? new Date(p.lastWatered) : null,
    })) as Plant[];
  }

  async createPlant(plant: InsertPlant): Promise<Plant> {
    console.log('[storage.ts] DbStorage.createPlant: Attempting to insert plant:', JSON.stringify(plant, null, 2));
    try {
      const [newPlantFromDb] = await this.db.insert(schema.plants).values(plant).returning();

      console.log('[storage.ts] DbStorage.createPlant: Result from DB insert:', JSON.stringify(newPlantFromDb, null, 2));

      // Check if newPlantFromDb is valid and has an ID (assuming ID is a number and should be > 0)
      if (!newPlantFromDb || typeof newPlantFromDb.id !== 'number' || newPlantFromDb.id <= 0) {
        const errorMsg = '[storage.ts] DbStorage.createPlant: ERROR - Plant insertion failed or did not return a valid ID.';
        console.error(errorMsg, 'Received:', JSON.stringify(newPlantFromDb, null, 2));
        throw new Error('Plant creation in DB failed to return a valid plant with ID.');
      }

      // Create initial health metrics for the new plant
      try {
        await this.updatePlantHealthMetrics(newPlantFromDb.id);
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

  async updatePlant(id: number, plantData: Partial<InsertPlant>): Promise<Plant | undefined> {
    const [updatedPlant] = await this.db.update(schema.plants).set(plantData).where(eq(schema.plants.id, id)).returning();
    if (!updatedPlant) return undefined;
    return {
      ...updatedPlant,
      acquiredDate: updatedPlant.acquiredDate ? new Date(updatedPlant.acquiredDate) : null,
      lastWatered: updatedPlant.lastWatered ? new Date(updatedPlant.lastWatered) : null,
    } as Plant;
  }

  async deletePlant(plantId: number): Promise<void> {
    try {
      // First, delete any recommendations associated with this plant
      await this.db.delete(schema.recommendations)
        .where(eq(schema.recommendations.plantId, plantId));

      // Then, delete the plant
      const result = await this.db.delete(schema.plants)
        .where(eq(schema.plants.id, plantId))
        .returning();

      if (result.length === 0) {
        throw new Error(`Plant with ID ${plantId} not found`);
      }
      console.log(`[DbStorage] Successfully deleted plant with ID ${plantId} and its recommendations`);
    } catch (error) {
      console.error(`[DbStorage] Error deleting plant with ID ${plantId}:`, error);
      throw error; // Re-throw the error to be handled by the route
    }
  }

  // Environment readings operations
  async getLatestEnvironmentReadingByUserId(userId: number): Promise<EnvironmentReading | undefined> {
    const result = await this.db.select().from(schema.environmentReadings)
      .where(eq(schema.environmentReadings.userId, userId))
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

  // Care tasks operations
  async getCareTasksByUserId(userId: number): Promise<CareTask[]> {
    const tasks = await this.db.select({
      id: schema.careTasks.id,
      plantId: schema.careTasks.plantId,
      taskType: schema.careTasks.taskType,
      dueDate: schema.careTasks.dueDate,
      completed: schema.careTasks.completed,
      completedDate: schema.careTasks.completedDate,
      skipped: schema.careTasks.skipped
    })
    .from(schema.careTasks)
    .innerJoin(schema.plants, eq(schema.careTasks.plantId, schema.plants.id))
    .where(eq(schema.plants.userId, userId))
    .orderBy(desc(schema.careTasks.dueDate));
    
    return tasks.map(task => ({
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate) : new Date(), // Ensure dueDate is a Date
      completedDate: task.completedDate ? new Date(task.completedDate) : null,
    })) as CareTask[];
  }

  async createCareTask(task: InsertCareTask): Promise<CareTask> {
    const [newTask] = await this.db
      .insert(schema.careTasks)
      .values({
        ...task,
        // completedDate is null by default in schema
      })
      .returning();
    
    return {
      ...newTask,
      dueDate: newTask.dueDate ? new Date(newTask.dueDate) : new Date(), // Ensure dueDate is a Date
      completedDate: newTask.completedDate ? new Date(newTask.completedDate) : null,
    } as CareTask;
  }

  async completeCareTask(id: number): Promise<CareTask | undefined> {
    const task = await this.db.query.careTasks.findFirst({
      where: eq(schema.careTasks.id, id),
    });
    if (!task) return undefined;

    const [updatedTask] = await this.db
      .update(schema.careTasks)
      .set({ completed: true, completedDate: new Date() })
      .where(eq(schema.careTasks.id, id))
      .returning();

    if (!updatedTask) return undefined;

    // Create a care history record
    // 'performedAt' is set by default in the DB schema, so we don't pass it here.
    await this.createCareHistory({
      plantId: updatedTask.plantId,
      actionType: `completed_${updatedTask.taskType}`,
      // performedAt: new Date(), // Removed: defaultNow() in schema
    });

    // If it's a recurring task like watering, update plant's lastWatered and create a new recurring task
    if (updatedTask.taskType === 'water') {
      const plant = await this.getPlantById(updatedTask.plantId);
      if (plant && plant.waterFrequencyDays) {
        const nextDueDate = new Date(updatedTask.completedDate || Date.now()); // base on completion time
        nextDueDate.setDate(nextDueDate.getDate() + plant.waterFrequencyDays);
        
        await this.createCareTask({
          plantId: plant.id,
          taskType: "water",
          dueDate: nextDueDate
        });
        // Update lastWatered for the plant
        await this.updatePlant(plant.id, { lastWatered: new Date(updatedTask.completedDate || Date.now()) });
      }
    }
    return {
      ...updatedTask,
      // Ensure Date fields are actual Date objects if they come from DB as strings/numbers
      dueDate: updatedTask.dueDate ? new Date(updatedTask.dueDate) : new Date(), 
      completedDate: updatedTask.completedDate ? new Date(updatedTask.completedDate) : null,
    } as CareTask;
  }

  async skipCareTask(id: number): Promise<CareTask | undefined> {
    const [updatedTask] = await this.db
      .update(schema.careTasks)
      .set({ skipped: true })
      .where(eq(schema.careTasks.id, id))
      .returning();
    if (!updatedTask) return undefined;
    return {
      ...updatedTask,
      dueDate: updatedTask.dueDate ? new Date(updatedTask.dueDate) : new Date(), // Ensure dueDate is a Date
      completedDate: updatedTask.completedDate ? new Date(updatedTask.completedDate) : null,
    } as CareTask;
  }

  // Recommendations operations
  async getRecommendationsByUserId(userId: number): Promise<Recommendation[]> {
    const result = await this.db.select().from(schema.recommendations)
      .where(and(
        eq(schema.recommendations.userId, userId),
        eq(schema.recommendations.applied, false)
      ))
      .orderBy(desc(schema.recommendations.createdAt));

    return result.map(rec => ({
        ...rec,
        plantId: rec.plantId ?? null,
        applied: rec.applied ?? false, // Ensure applied is boolean
        createdAt: rec.createdAt ? new Date(rec.createdAt) : new Date(), // Ensure createdAt is a Date
    })) as Recommendation[];
  }

  async createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation> {
    const [newRecommendation] = await this.db
      .insert(schema.recommendations)
      .values({
        ...recommendation,
        applied: false, // Default value
        // createdAt is defaultNow in schema, so no need to set it here unless overriding
      })
      .returning();
    
    return {
      ...newRecommendation,
      plantId: newRecommendation.plantId ?? null,
      applied: newRecommendation.applied ?? false, // applied will be false from insert
      createdAt: newRecommendation.createdAt ? new Date(newRecommendation.createdAt) : new Date(),
    } as Recommendation;
  }

  async getRecommendationsByPlantId(plantId: number): Promise<Recommendation[]> {
    console.log(`[DbStorage] Fetching recommendations for plantId: ${plantId}`);
    const result = await this.db.query.recommendations.findMany({
      where: eq(schema.recommendations.plantId, plantId),
      orderBy: [desc(schema.recommendations.createdAt)], // Optional: order by creation date
    });
    console.log(`[DbStorage] Found ${result.length} recommendations for plantId: ${plantId}`);
    return result.map(rec => ({
        ...rec,
        plantId: rec.plantId ?? null, // Ensure plantId is handled (though it should always exist here)
        applied: rec.applied ?? false, // Ensure applied is boolean
        createdAt: rec.createdAt ? new Date(rec.createdAt) : new Date(), // Ensure createdAt is a Date
    })) as Recommendation[];
  }

  async applyRecommendation(id: number): Promise<Recommendation | undefined> {
    const recommendation = await this.db.query.recommendations.findFirst({
      where: eq(schema.recommendations.id, id),
    });
    if (!recommendation) return undefined;

    const [recommendationUpdated] = await this.db
      .update(schema.recommendations)
      .set({ applied: true })
      .where(eq(schema.recommendations.id, id))
      .returning();
    
    if (!recommendationUpdated) return undefined;
    
    // Example: If it's a watering recommendation, update plant's lastWatered and create history
    if (recommendationUpdated.recommendationType === 'water' && recommendationUpdated.plantId) {
      const plant = await this.getPlantById(recommendationUpdated.plantId);
      if (plant) {
        await this.updatePlant(plant.id, { lastWatered: new Date() });
        // 'performedAt' is set by default in the DB schema, so we don't pass it here.
        await this.createCareHistory({
          plantId: plant.id,
          actionType: 'water_recommended',
          // performedAt: new Date(), // Removed: defaultNow() in schema
        });
        
        // Create a care task for watering
        const dueDate = new Date();
        // For watering, set due date based on typical watering frequency (e.g., 7 days from now)
        // This is a placeholder; ideally, this would be more dynamic based on AI recommendation details
        dueDate.setDate(dueDate.getDate() + 7);
        await this.createCareTask({
          plantId: plant.id,
          taskType: 'water',
          dueDate: dueDate,
          completed: false,
          skipped: false,
        });
      }
    }
    
    // Add logic for other recommendation types (e.g., light, pruning) here
    if (recommendationUpdated.recommendationType === 'pruning' && recommendationUpdated.plantId) {
      const plant = await this.getPlantById(recommendationUpdated.plantId);
      if (plant) {
        // Create a care task for pruning
        const dueDate = new Date();
        // For pruning, set due date based on a reasonable timeframe (e.g., 30 days from now)
        dueDate.setDate(dueDate.getDate() + 30);
        await this.createCareTask({
          plantId: plant.id,
          taskType: 'pruning',
          dueDate: dueDate,
          completed: false,
          skipped: false,
        });
      }
    }
    
    if (recommendationUpdated.recommendationType === 'light' && recommendationUpdated.plantId) {
      const plant = await this.getPlantById(recommendationUpdated.plantId);
      if (plant) {
        // Create a care task for light adjustment
        const dueDate = new Date();
        // For light, set due date based on a reasonable timeframe (e.g., 1 day from now for immediate action)
        dueDate.setDate(dueDate.getDate() + 1);
        await this.createCareTask({
          plantId: plant.id,
          taskType: 'light',
          dueDate: dueDate,
          completed: false,
          skipped: false,
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

  async generateRecommendations(userId: number): Promise<void> {
    // 1. Fetch all plants for the user
    const userPlants = await this.db
      .select()
      .from(schema.plants)
      .where(eq(schema.plants.userId, userId));

    // 2. Fetch the latest environment reading for the user
    const latestEnvironment = await this.getLatestEnvironmentReadingByUserId(userId);

    if (!latestEnvironment) {
      console.warn(`[DbStorage] No environment data found for user ${userId}. Cannot generate recommendations.`);
      return;
    }

    const now = new Date();

    for (const plant of userPlants) {
      // 3. Generate recommendations using AI based on plant and environment data
      try {
        const aiRecommendations = await generatePlantRecommendations(plant, latestEnvironment);

        // 4. Store the generated recommendations
        for (const rec of aiRecommendations) {
          await this.createRecommendation({
            userId: userId,
            plantId: plant.id,
            recommendationType: rec.recommendationType,
            message: rec.message,
            applied: false, // Recommendations are initially not applied
            createdAt: now,
          });
        }
      } catch (error) {
        console.error(`[DbStorage] Error generating AI recommendations for plant ${plant.id}:`, error);
        // Continue to the next plant even if one fails
      }
    }
  }

  // Care history operations
  async getCareHistoryByPlantId(plantId: number): Promise<CareHistory[]> {
    const history = await this.db.select().from(schema.careHistory)
      .where(eq(schema.careHistory.plantId, plantId))
      .orderBy(desc(schema.careHistory.performedAt));
    return history.map(h => ({
      ...h,
      performedAt: h.performedAt ? new Date(h.performedAt) : new Date(),
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
  async getPlantHealthMetrics(plantId: number): Promise<PlantHealthMetric | undefined> {
    const result = await this.db.select().from(schema.plantHealthMetrics)
      .where(eq(schema.plantHealthMetrics.plantId, plantId))
      .orderBy(desc(schema.plantHealthMetrics.updatedAt))
      .limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      updatedAt: result[0].updatedAt ? new Date(result[0].updatedAt) : new Date(),
    } as PlantHealthMetric;
  }

  async updatePlantHealthMetrics(plantId: number, metrics?: Partial<InsertPlantHealthMetric>): Promise<PlantHealthMetric | undefined> {
    const currentMetrics = await this.getPlantHealthMetrics(plantId);
    let newMetricsData: InsertPlantHealthMetric;

    if (currentMetrics) {
      newMetricsData = { 
        plantId,
        waterLevel: metrics?.waterLevel ?? currentMetrics.waterLevel,
        lightLevel: metrics?.lightLevel ?? currentMetrics.lightLevel,
        overallHealth: metrics?.overallHealth ?? currentMetrics.overallHealth,
        // updatedAt will be handled by defaultNow or explicit set
      };
      const [updated] = await this.db.update(schema.plantHealthMetrics)
        .set({ ...newMetricsData, updatedAt: new Date() })
        .where(eq(schema.plantHealthMetrics.plantId, plantId))
        .returning();
      return updated ? { ...updated, updatedAt: new Date(updated.updatedAt!) } as PlantHealthMetric : undefined;
    } else {
      // Create new if not exists
      newMetricsData = { 
        plantId,
        waterLevel: metrics?.waterLevel ?? 100, // Default if creating new
        lightLevel: metrics?.lightLevel ?? 100,
        overallHealth: metrics?.overallHealth ?? 100,
      };
      const [created] = await this.db.insert(schema.plantHealthMetrics).values(newMetricsData).returning();
      return created ? { ...created, updatedAt: new Date(created.updatedAt!) } as PlantHealthMetric : undefined;
    }
  }

  // Dashboard stats
  async getDashboardStats(userId: number): Promise<DashboardStats> {
    // 1. Total Plants
    const totalPlantsResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.plants)
      .where(eq(schema.plants.userId, userId));
    const totalPlants = totalPlantsResult[0]?.count || 0;

    // 2. Plants Needing Care (example: overdue for watering)
    // This requires a more complex query or iterating through plants if not directly stored.
    // For simplicity, let's count plants where lastWatered + waterFrequencyDays < now
    const userPlantsForCareCheck = await this.db
      .select({ id: schema.plants.id, lastWatered: schema.plants.lastWatered, waterFrequencyDays: schema.plants.waterFrequencyDays })
      .from(schema.plants)
      .where(eq(schema.plants.userId, userId));
    
    let plantsNeedingCare = 0;
    const now = new Date();
    for (const plant of userPlantsForCareCheck) {
      if (plant.lastWatered && plant.waterFrequencyDays) {
        const lastWateredTime = new Date(plant.lastWatered).getTime();
        const overdueTime = lastWateredTime + plant.waterFrequencyDays * 24 * 60 * 60 * 1000;
        
        // If current time is past the overdue time + a 2-day grace period (example)
        if (now.getTime() > overdueTime) {
          plantsNeedingCare++;
        }
      }
    }

    // 3. Upcoming Tasks (Top 5, not completed, not skipped, future due date)
    const upcomingTasksResult = await this.db
      .select({
        id: schema.careTasks.id,
        plantId: schema.careTasks.plantId,
        taskType: schema.careTasks.taskType,
        dueDate: schema.careTasks.dueDate,
        completed: schema.careTasks.completed,
        completedDate: schema.careTasks.completedDate, // Select completedDate
        skipped: schema.careTasks.skipped,
        // We need plantName for display, so join with plants table
        plantName: schema.plants.name 
      })
      .from(schema.careTasks)
      .innerJoin(schema.plants, eq(schema.careTasks.plantId, schema.plants.id))
      .where(and(
        eq(schema.plants.userId, userId),
        eq(schema.careTasks.completed, false),
        eq(schema.careTasks.skipped, false),
        gt(schema.careTasks.dueDate, now) // Due date is in the future
      ))
      .orderBy(asc(schema.careTasks.dueDate))
      .limit(5);

    const upcomingTasks: UpcomingTaskDisplay[] = upcomingTasksResult.map(task => ({
      id: task.id,
      plantId: task.plantId,
      taskType: task.taskType,
      dueDate: task.dueDate ? new Date(task.dueDate) : new Date(), // Ensure it's a Date
      completed: task.completed,
      completedDate: task.completedDate ? new Date(task.completedDate) : null, // Add completedDate
      skipped: task.skipped,
      plantName: task.plantName ?? 'Unknown Plant', // Add plantName
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
      .where(eq(schema.plants.userId, userId))
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
}

// Initialize database storage
// The actual DB connection is now deferred to initializeDatabase()
export const storage = new DbStorage();
console.log(`[storage.ts] EXPORTING storage instance of type: ${storage.constructor.name} at module load`);
