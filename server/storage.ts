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
  updatePlant(id: number, plant: InsertPlant): Promise<Plant | undefined>;
  deletePlant(id: number): Promise<boolean>;

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

// Memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private plants: Map<number, Plant>;
  private environmentReadings: Map<number, EnvironmentReading>;
  private careTasks: Map<number, CareTask>;
  private recommendations: Map<number, Recommendation>;
  private careHistory: Map<number, CareHistory>;
  private plantHealthMetrics: Map<number, PlantHealthMetric>;
  
  private userId: number;
  private plantId: number;
  private readingId: number;
  private taskId: number;
  private recommendationId: number;
  private historyId: number;
  private metricId: number;

  constructor() {
    this.users = new Map();
    this.plants = new Map();
    this.environmentReadings = new Map();
    this.careTasks = new Map();
    this.recommendations = new Map();
    this.careHistory = new Map();
    this.plantHealthMetrics = new Map();
    
    this.userId = 1;
    this.plantId = 1;
    this.readingId = 1;
    this.taskId = 1;
    this.recommendationId = 1;
    this.historyId = 1;
    this.metricId = 1;

    // Initialize with a demo user
    this.createUser({
      username: "demo",
      password: null, // Explicitly null for Clerk-based auth
      email: "demo@example.com",
      name: "Alex",
      clerkId: "user_demo_clerk_id"
    });

    // Add some sample plants
    const demoPlants = [
      {
        userId: 1,
        name: "Monstera Deliciosa",
        species: "Swiss Cheese Plant",
        imageUrl: "https://images.unsplash.com/photo-1614594975525-e45190c55d0b",
        description: "A popular indoor plant with characteristic leaf holes",
        acquiredDate: new Date("2023-01-15"),
        status: "healthy",
        waterFrequencyDays: 7,
        lightRequirement: "medium",
        lastWatered: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      },
      {
        userId: 1,
        name: "Peace Lily",
        species: "Spathiphyllum",
        imageUrl: "https://pixabay.com/get/gd3872ec51135e9ccfb5527e2226721bf55cfccd5e22446a4fa4f1e36091598b56256f96483eb255940270d1fdfda9069908a47422f0e5982c1745b7e390253d3_1280.jpg",
        description: "Elegant indoor plant with white flowers",
        acquiredDate: new Date("2023-02-20"),
        status: "needs_care",
        waterFrequencyDays: 5,
        lightRequirement: "low",
        lastWatered: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
      },
      {
        userId: 1,
        name: "Snake Plant",
        species: "Sansevieria Trifasciata",
        imageUrl: "https://pixabay.com/get/g17c7914976a7ff5f973ff8daeaf49101b4cf86c436cc0177f62f24378d76ed72ef5cb88bf4dab37b20ce8d42542f10750651d0f79a0d10f6b017c6441c19a6b0_1280.jpg",
        description: "Low-maintenance plant with stiff, upright leaves",
        acquiredDate: new Date("2023-03-10"),
        status: "healthy",
        waterFrequencyDays: 14,
        lightRequirement: "low",
        lastWatered: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
      }
    ];

    demoPlants.forEach(plant => this.createPlant(plant));

    // Add an environment reading
    this.createEnvironmentReading({
      userId: 1,
      temperature: 22,
      humidity: 45,
      lightLevel: "medium"
    });

    // Generate initial recommendations
    this.generateRecommendations(1);

    // Create initial care tasks
    this.createCareTask({
      plantId: 2, // Peace Lily
      taskType: "water",
      dueDate: new Date()
    });

    this.createCareTask({
      plantId: 1, // Monstera
      taskType: "prune",
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
    });

    this.createCareTask({
      plantId: 3, // Snake Plant
      taskType: "water",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
    });

    // Initialize health metrics for each plant
    this.plants.forEach((plant) => {
      this.updatePlantHealthMetrics(plant.id);
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of Array.from(this.users.values())) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async getUserByClerkId(clerkId: string): Promise<User | undefined> {
    for (const user of Array.from(this.users.values())) {
      if (user.clerkId === clerkId) {
        return user;
      }
    }
    return undefined;
  }

  async getOrCreateUserByClerkId(clerkId: string, clerkUserData: { email: string; username?: string | null; firstName?: string | null; lastName?: string | null }): Promise<User> {
    let user = await this.getUserByClerkId(clerkId);
    if (user) {
      return user;
    }

    let name = (clerkUserData.firstName && clerkUserData.lastName) 
      ? `${clerkUserData.firstName} ${clerkUserData.lastName}` 
      : clerkUserData.firstName || clerkUserData.lastName || clerkUserData.username || clerkUserData.email.split('@')[0];
    if (!name) name = 'New User';

    let username = clerkUserData.username || clerkUserData.email.split('@')[0];
    // Ensure username is unique in MemStorage
    let uniqueUsername = username;
    let counter = 1;
    while (Array.from(this.users.values()).some(u => u.username === uniqueUsername)) {
      uniqueUsername = `${username}${counter++}`;
    }

    const newUser: User = {
      id: this.userId++,
      clerkId,
      email: clerkUserData.email,
      name,
      username: uniqueUsername,
      password: null, // Clerk handles auth
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const newUser: User = {
      id: this.userId++,
      clerkId: insertUser.clerkId, // clerkId is now mandatory in InsertUser via schema
      username: insertUser.username,
      password: insertUser.password ?? null, // Ensure password is null if undefined
      email: insertUser.email,
      name: insertUser.name,
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  // Plant operations
  async getPlantById(id: number): Promise<Plant | undefined> {
    return this.plants.get(id);
  }

  async getPlantsByUserId(userId: number): Promise<Plant[]> {
    return Array.from(this.plants.values()).filter(
      (plant) => plant.userId === userId
    );
  }

  async createPlant(insertPlant: InsertPlant): Promise<Plant> {
    const id = this.plantId++;
    const plant: Plant = {
      id,
      userId: insertPlant.userId,
      name: insertPlant.name,
      species: insertPlant.species ?? null,
      imageUrl: insertPlant.imageUrl ?? null,
      description: insertPlant.description ?? null,
      acquiredDate: insertPlant.acquiredDate ?? null,
      status: insertPlant.status ?? null,
      waterFrequencyDays: insertPlant.waterFrequencyDays ?? null,
      lightRequirement: insertPlant.lightRequirement ?? null,
      lastWatered: insertPlant.lastWatered ?? null,
    };
    this.plants.set(id, plant);

    // Initialize health metrics for the new plant
    await this.updatePlantHealthMetrics(id);

    // Create initial watering task
    if (insertPlant.waterFrequencyDays) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + insertPlant.waterFrequencyDays);
      
      await this.createCareTask({
        plantId: id,
        taskType: "water",
        dueDate
      });
    }

    return plant;
  }

  async updatePlant(id: number, updatePlant: InsertPlant): Promise<Plant | undefined> {
    const plant = this.plants.get(id);
    if (!plant) return undefined;

    const updatedPlant: Plant = { ...plant, ...updatePlant, id };
    this.plants.set(id, updatedPlant);
    return updatedPlant;
  }

  async deletePlant(id: number): Promise<boolean> {
    return this.plants.delete(id);
  }

  // Environment readings operations
  async getLatestEnvironmentReadingByUserId(userId: number): Promise<EnvironmentReading | undefined> {
    const userReadings = Array.from(this.environmentReadings.values())
      .filter(reading => reading.userId === userId)
      .sort((a, b) => {
        // Handle potentially null or non-Date timestamps
        const timeA = a.readingTimestamp instanceof Date ? a.readingTimestamp.getTime() : -Infinity; // Treat null/invalid as oldest
        const timeB = b.readingTimestamp instanceof Date ? b.readingTimestamp.getTime() : -Infinity; // Treat null/invalid as oldest
        return timeB - timeA; // Sorts descending (latest first)
      });
    
    return userReadings[0];
  }

  async createEnvironmentReading(insertReading: InsertEnvironmentReading): Promise<EnvironmentReading> {
    const id = this.readingId++;
    const reading: EnvironmentReading = { 
      id,
      userId: insertReading.userId,
      temperature: insertReading.temperature ?? null,
      humidity: insertReading.humidity ?? null,
      lightLevel: insertReading.lightLevel ?? null,
      readingTimestamp: new Date() 
    };
    this.environmentReadings.set(id, reading);
    return reading;
  }

  // Care tasks operations
  async getCareTasksByUserId(userId: number): Promise<CareTask[]> {
    const userPlants = await this.getPlantsByUserId(userId);
    const plantIds = userPlants.map(plant => plant.id);
    
    return Array.from(this.careTasks.values())
      .filter(task => plantIds.includes(task.plantId) && !task.completed && !task.skipped)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  async createCareTask(insertTask: InsertCareTask): Promise<CareTask> {
    const id = this.taskId++;
    const task: CareTask = { 
      ...insertTask, 
      id, 
      completed: false, 
      completedDate: null,
      skipped: false
    };
    this.careTasks.set(id, task);
    return task;
  }

  async completeCareTask(id: number): Promise<CareTask | undefined> {
    const task = this.careTasks.get(id);
    if (!task) return undefined;

    const updatedTask: CareTask = { 
      ...task, 
      completed: true, 
      completedDate: new Date() 
    };
    this.careTasks.set(id, updatedTask);

    // If it's a recurring task like watering, create the next task
    if (task.taskType === 'water') {
      const plant = await this.getPlantById(task.plantId);
      if (plant && plant.waterFrequencyDays) {
        const nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + plant.waterFrequencyDays);
        
        await this.createCareTask({
          plantId: plant.id,
          taskType: "water",
          dueDate: nextDueDate
        });
      }
    }

    return updatedTask;
  }

  async skipCareTask(id: number): Promise<CareTask | undefined> {
    const task = this.careTasks.get(id);
    if (!task) return undefined;

    const updatedTask: CareTask = { 
      ...task, 
      skipped: true 
    };
    this.careTasks.set(id, updatedTask);
    return updatedTask;
  }

  // Recommendations operations
  async getRecommendationsByUserId(userId: number): Promise<Recommendation[]> {
    return Array.from(this.recommendations.values())
      .filter(rec => rec.userId === userId && !rec.applied)
      .sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : Number.MIN_SAFE_INTEGER;
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : Number.MIN_SAFE_INTEGER;
        return timeB - timeA; // Sorts newest first; nulls will be oldest
      });
  }

  async createRecommendation(insertRecommendation: InsertRecommendation): Promise<Recommendation> {
    const id = this.recommendationId++;
    const recommendation: Recommendation = { 
      id,
      userId: insertRecommendation.userId,
      plantId: insertRecommendation.plantId ?? null,
      recommendationType: insertRecommendation.recommendationType,
      message: insertRecommendation.message,
      applied: false, 
      createdAt: new Date() 
    };
    this.recommendations.set(id, recommendation);
    return recommendation;
  }

  async applyRecommendation(id: number): Promise<Recommendation | undefined> {
    const recommendation = this.recommendations.get(id);
    if (!recommendation) return undefined;

    const updatedRecommendation: Recommendation = { 
      ...recommendation, 
      applied: true 
    };
    this.recommendations.set(id, updatedRecommendation);
    return updatedRecommendation;
  }

  async generateRecommendations(userId: number): Promise<void> {
    const plants = await this.getPlantsByUserId(userId);
    const latestReading = await this.getLatestEnvironmentReadingByUserId(userId);
    
    if (!latestReading) return;

    // Generate watering recommendations based on humidity
    if (latestReading.humidity && latestReading.humidity < 50) {
      for (const plant of plants) {
        if (plant.waterFrequencyDays && plant.waterFrequencyDays < 10) {
          await this.createRecommendation({
            userId,
            plantId: plant.id,
            recommendationType: "water",
            message: `Your ${plant.name} plant may need less frequent watering. Based on the current humidity levels, consider watering once every 9 days instead of weekly.`
          });
        }
      }
    }

    // Generate light recommendations
    if (latestReading.lightLevel === "low") {
      for (const plant of plants) {
        if (plant.lightRequirement === "medium" || plant.lightRequirement === "high") {
          await this.createRecommendation({
            userId,
            plantId: plant.id,
            recommendationType: "light",
            message: `Your ${plant.name} shows signs of insufficient light. Consider moving it closer to an east-facing window for more indirect sunlight.`
          });
        }
      }
    }
  }

  // Care history operations
  async getCareHistoryByPlantId(plantId: number): Promise<CareHistory[]> {
    return Array.from(this.careHistory.values())
      .filter(history => history.plantId === plantId)
      .sort((a, b) => {
        if (a.performedAt === null && b.performedAt === null) {
          return 0; // both null, treat as equal
        }
        if (a.performedAt === null) {
          return 1; // a is null, b is not; a comes after b (nulls last)
        }
        if (b.performedAt === null) {
          return -1; // b is null, a is not; b comes after a (nulls last)
        }
        // Both are non-null Date objects
        return b.performedAt.getTime() - a.performedAt.getTime();
      });
  }

  async createCareHistory(history: InsertCareHistory): Promise<CareHistory> {
    const id = this.historyId++;
    const newHistory: CareHistory = { 
      ...history, 
      id, 
      performedAt: new Date(),
      notes: history.notes ?? null, // Ensure notes is string or null
    };
    this.careHistory.set(id, newHistory);
    return newHistory;
  }

  // Plant health metrics
  async getPlantHealthMetrics(plantId: number): Promise<PlantHealthMetric | undefined> {
    return this.plantHealthMetrics.get(plantId);
  }

  async updatePlantHealthMetrics(plantId: number, metricsInput?: Partial<schema.InsertPlantHealthMetric>): Promise<schema.PlantHealthMetric | undefined> {
    const plant = this.plants.get(plantId);
    if (!plant) return undefined;

    const plantOverallHealthStatusString = plant.lastWatered && (new Date().getTime() - plant.lastWatered.getTime()) / (1000 * 60 * 60 * 24) > (plant.waterFrequencyDays ?? 7) + 2
      ? 'needs_attention'
      : 'healthy';
    
    const existingMetric = this.plantHealthMetrics.get(plantId);

    // 'issues' and 'recommendations' are not part of plantHealthMetrics schema.
    // They should be handled via the 'recommendations' table or derived dynamically.

    const newMetricData = {
      plantId,
      overallHealth: metricsInput?.overallHealth ?? existingMetric?.overallHealth ?? healthStatusToNumeric(plantOverallHealthStatusString),
      // lastChecked was incorrect, schema uses updatedAt
      updatedAt: new Date(), 
      waterLevel: metricsInput?.waterLevel ?? existingMetric?.waterLevel ?? null,
      lightLevel: metricsInput?.lightLevel ?? existingMetric?.lightLevel ?? null,
      // issues: undefined, // Not in schema
      // recommendations: undefined, // Not in schema
    } as Omit<schema.PlantHealthMetric, 'id'>; // Ensure this matches schema.PlantHealthMetric excluding 'id'

    if (existingMetric) {
      // Ensure we only spread properties that exist on existingMetric and newMetricData aligns with PlantHealthMetric
      const updatedMetric: schema.PlantHealthMetric = { 
        ...existingMetric, 
        plantId: newMetricData.plantId,
        overallHealth: newMetricData.overallHealth,
        updatedAt: newMetricData.updatedAt,
        waterLevel: newMetricData.waterLevel,
        lightLevel: newMetricData.lightLevel,
      };
      this.plantHealthMetrics.set(plantId, updatedMetric);
      return updatedMetric;
    } else {
      const newDbMetric: schema.PlantHealthMetric = {
        id: this.metricId++, // Assign new ID only for new metrics
        plantId: newMetricData.plantId,
        overallHealth: newMetricData.overallHealth,
        updatedAt: newMetricData.updatedAt,
        waterLevel: newMetricData.waterLevel,
        lightLevel: newMetricData.lightLevel,
      };
      this.plantHealthMetrics.set(plantId, newDbMetric);
      return newDbMetric;
    }
  }

  // Dashboard stats
  async getDashboardStats(userId: number): Promise<any> {
    const userPlants = Array.from(this.plants.values()).filter(p => p.userId === userId);
    const userCareTasks = Array.from(this.careTasks.values()).filter(ct => userPlants.some(p => p.id === ct.plantId));
    const userCareHistory = Array.from(this.careHistory.values()).filter(ch => userPlants.some(p => p.id === ch.plantId));

    const upcomingTasks = userCareTasks
      // Assuming CareTask has 'completed' and 'skipped' booleans, and no 'status' field
      .filter(t => t.dueDate && t.dueDate > new Date() && !t.completed && !t.skipped)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    const recentActivities = userCareHistory
      .sort((a,b) => (b.performedAt ? b.performedAt.getTime() : 0) - (a.performedAt ? a.performedAt.getTime() : 0))
      .slice(0,5);

    return {
      totalPlants: userPlants.length,
      plantsHealthy: userPlants.filter(p => p.status === 'healthy').length,
      plantsNeedCare: userPlants.filter(p => p.status === 'needs_care' || p.status === 'needs_attention').length,
      upcomingTasks: upcomingTasks.map(t => ({
        ...t,
        plantName: this.plants.get(t.plantId)?.name,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
      })),
      recentActivities: recentActivities.map(a => ({
        ...a,
        plantName: this.plants.get(a.plantId)?.name,
        performedAt: a.performedAt ? new Date(a.performedAt) : null,
      })),
    };
  }
}

// Database storage implementation
export class DbStorage implements IStorage {
  // private db: PostgresJsDatabase<typeof schema>;
  // constructor() {
  //   this.db = globalDbInstance; // Initialize instance db with the global one
  // }

  // Use a getter to ensure the db instance is accessed only after initialization
  private get db(): PostgresJsDatabase<typeof schema> {
    if (!globalDbInstance) {
      console.error('[storage.ts] DbStorage.db accessed before database was initialized. This should not happen if initializeDatabase() was called correctly at startup.');
      throw new Error('Database not initialized. Critical startup error.');
    }
    return globalDbInstance;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0] as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return result[0] as User | undefined;
  }

  async getUserByClerkId(clerkId: string): Promise<User | undefined> {
    const result = await this.db.select().from(schema.users).where(eq(schema.users.clerkId, clerkId)).limit(1);
    return result[0] as User | undefined;
  }

  async getOrCreateUserByClerkId(clerkId: string, clerkUserData: { email: string; username?: string | null; firstName?: string | null; lastName?: string | null }): Promise<User> {
    let user = await this.getUserByClerkId(clerkId);
    if (user) {
      return user;
    }

    // Determine name: try full name, then first name, then username, then email prefix
    let name = (clerkUserData.firstName && clerkUserData.lastName) ? `${clerkUserData.firstName} ${clerkUserData.lastName}` : clerkUserData.firstName || clerkUserData.lastName || clerkUserData.username || clerkUserData.email.split('@')[0];
    if (!name) name = 'New User'; // Fallback if all else fails

    // Determine username: use provided username or derive from email, ensuring uniqueness might be complex here without more info or utility
    // For now, we'll prefer Clerk's username, or fallback to email prefix. Database constraint will catch non-unique.
    let username = clerkUserData.username || clerkUserData.email.split('@')[0];
    // A more robust unique username generation might be needed in a production system if conflicts are common.
    // For example, appending a short random string or checking for existence and incrementing a suffix.

    const newUserInsert: InsertUser = {
      clerkId,
      email: clerkUserData.email,
      name,
      username, // This must be unique in the DB
      password: null, // Password is null as Clerk handles auth
    };

    try {
      user = await this.createUser(newUserInsert);
    } catch (error: any) {
      // Handle potential unique constraint errors for username or email
      if (error.message && (error.message.includes('unique constraint "users_username_unique"') || error.message.includes('unique constraint "users_email_unique"'))) {
        // This could happen if a user tries to sign up with an email/username that exists but is tied to a different Clerk ID (should be rare)
        // Or if our derived username isn't unique.
        console.error(`Error creating user due to unique constraint: ${error.message}. ClerkID: ${clerkId}`);
        // Attempt to fetch again, in case of a race condition where another request created it.
        const existingUser = await this.db.select().from(schema.users).where(eq(schema.users.email, clerkUserData.email)).limit(1);
        if (existingUser[0]) return existingUser[0] as User;
        throw new Error(`Failed to create or retrieve user for Clerk ID ${clerkId} due to conflicting unique fields.`);
      }
      console.error(`Error creating user for Clerk ID ${clerkId}:`, error);
      throw error;
    }
    return user;
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
    const [newPlant] = await this.db.insert(schema.plants).values(plant).returning();
    return {
      ...newPlant,
      acquiredDate: newPlant.acquiredDate ? new Date(newPlant.acquiredDate) : null,
      lastWatered: newPlant.lastWatered ? new Date(newPlant.lastWatered) : null,
    } as Plant;
  }

  async updatePlant(id: number, plantData: InsertPlant): Promise<Plant | undefined> {
    const [updatedPlant] = await this.db.update(schema.plants).set(plantData).where(eq(schema.plants.id, id)).returning();
    if (!updatedPlant) return undefined;
    return {
      ...updatedPlant,
      acquiredDate: updatedPlant.acquiredDate ? new Date(updatedPlant.acquiredDate) : null,
      lastWatered: updatedPlant.lastWatered ? new Date(updatedPlant.lastWatered) : null,
    } as Plant;
  }

  async deletePlant(id: number): Promise<boolean> {
    const result = await this.db.delete(schema.plants).where(eq(schema.plants.id, id)).returning({ id: schema.plants.id });
    return result.length > 0;
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
          dueDate: nextDueDate,
          // Other fields like 'notes' can be omitted or set to default
        });
        // Update lastWatered for the plant
        await this.updatePlant(plant.id, { ...plant, lastWatered: new Date(updatedTask.completedDate || Date.now()) });
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
      .where(and(eq(schema.recommendations.userId, userId), eq(schema.recommendations.applied, false)))
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

  async applyRecommendation(id: number): Promise<Recommendation | undefined> {
    const [recommendation] = await this.db
      .update(schema.recommendations)
      .set({ applied: true })
      .where(eq(schema.recommendations.id, id))
      .returning();
    
    if (!recommendation) return undefined;
    
    // Example: If it's a watering recommendation, update plant's lastWatered and create history
    if (recommendation.recommendationType === 'water' && recommendation.plantId) {
      const plant = await this.getPlantById(recommendation.plantId);
      if (plant) {
        await this.updatePlant(plant.id, { ...plant, lastWatered: new Date() });
        // 'performedAt' is set by default in the DB schema, so we don't pass it here.
        await this.createCareHistory({
          plantId: plant.id,
          actionType: 'water_recommended',
          // performedAt: new Date(), // Removed: defaultNow() in schema
        });
      }
    }
    return {
      ...recommendation,
      plantId: recommendation.plantId ?? null,
      applied: recommendation.applied ?? false,
      createdAt: recommendation.createdAt ? new Date(recommendation.createdAt) : new Date(),
    } as Recommendation;
  }

  async generateRecommendations(userId: number): Promise<void> {
    // 1. Fetch all plants for the user
    const userPlants = await this.db
      .select()
      .from(schema.plants)
      .where(eq(schema.plants.userId, userId));

    const now = new Date();

    for (const plant of userPlants) {
      // 2. Check for watering recommendations
      if (plant.lastWatered && plant.waterFrequencyDays) {
        const lastWateredTime = new Date(plant.lastWatered).getTime();
        const overdueTime = lastWateredTime + plant.waterFrequencyDays * 24 * 60 * 60 * 1000;
        
        // If current time is past the overdue time + a 2-day grace period (example)
        if (now.getTime() > overdueTime) {
          // Check if a similar recommendation already exists and is not applied
          const existingRec = await this.db.query.recommendations.findFirst({
            where: and(
              eq(schema.recommendations.userId, userId),
              eq(schema.recommendations.plantId, plant.id),
              eq(schema.recommendations.recommendationType, 'water'),
              eq(schema.recommendations.applied, false)
            )
          });

          if (!existingRec) {
            await this.createRecommendation({
              userId: userId,
              plantId: plant.id,
              recommendationType: 'water',
              message: `Your ${plant.name} is overdue for watering. Last watered on ${new Date(plant.lastWatered).toLocaleDateString()}.`,
              // 'applied' and 'createdAt' will be set by default by createRecommendation or schema
            });
          }
        }
      }
      // TODO: Add other recommendation types (e.g., light, fertilization) based on plant properties or health metrics
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
