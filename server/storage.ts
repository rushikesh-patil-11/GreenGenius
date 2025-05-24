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
import { eq, desc, sql, and, gte, lte, isNull, inArray, lt } from "drizzle-orm"; // Restored missing operators, added lt
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js'; 
import postgres from 'postgres';
import * as schema from "../shared/schema"; // Import all schema for DB typing

// Define interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
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
  updatePlantHealthMetrics(plantId: number): Promise<PlantHealthMetric | undefined>;

  // Dashboard stats
  getDashboardStats(userId: number): Promise<any>;
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
      password: "password",
      email: "demo@example.com",
      name: "Alex"
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
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : Number.MIN_SAFE_INTEGER;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : Number.MIN_SAFE_INTEGER;
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
    return Array.from(this.plantHealthMetrics.values())
      .find(metric => metric.plantId === plantId);
  }

  async updatePlantHealthMetrics(plantId: number): Promise<PlantHealthMetric | undefined> {
    const plant = await this.getPlantById(plantId);
    if (!plant) return undefined;

    // Calculate water level based on last watered date and watering frequency
    let waterLevel = 100;
    if (plant.lastWatered && plant.waterFrequencyDays) {
      const daysSinceWatered = Math.floor((Date.now() - new Date(plant.lastWatered).getTime()) / (24 * 60 * 60 * 1000));
      waterLevel = Math.max(0, 100 - (daysSinceWatered / plant.waterFrequencyDays * 100));
    }

    // Determine light level based on plant requirements
    let lightLevel = 75;
    if (plant.lightRequirement === "low") {
      lightLevel = 90;
    } else if (plant.lightRequirement === "high") {
      lightLevel = 60;
    }

    // Calculate overall health as an average of water and light levels
    const overallHealth = Math.round((waterLevel + lightLevel) / 2);

    // Find existing metrics or create new ones
    const existingMetrics = await this.getPlantHealthMetrics(plantId);
    const id = existingMetrics ? existingMetrics.id : this.metricId++;

    const metrics: PlantHealthMetric = {
      id,
      plantId,
      waterLevel: Math.round(waterLevel),
      lightLevel: Math.round(lightLevel),
      overallHealth,
      updatedAt: new Date()
    };

    this.plantHealthMetrics.set(id, metrics);
    return metrics;
  }

  // Dashboard stats
  async getDashboardStats(userId: number): Promise<any> {
    const plants = await this.getPlantsByUserId(userId);
    const tasks = await this.getCareTasksByUserId(userId);
    const latestReading = await this.getLatestEnvironmentReadingByUserId(userId);
    const recommendations = await this.getRecommendationsByUserId(userId);

    // Plants needing water in the next 24 hours
    const plantsNeedingWater = tasks
      .filter(task => 
        task.taskType === 'water' && 
        new Date(task.dueDate).getTime() <= Date.now() + 24 * 60 * 60 * 1000
      )
      .length;

    // Calculate average plant health
    let totalHealth = 0;
    let healthyPlants = 0;

    for (const plant of plants) {
      const health = await this.getPlantHealthMetrics(plant.id);
      if (health && typeof health.overallHealth === 'number') {
        totalHealth += health.overallHealth;
        if (health.overallHealth >= 75) {
          healthyPlants++;
        }
      }
    }

    const averageHealth = plants.length > 0 ? 
      Math.round(totalHealth / plants.length) : 0;
    let healthStatus = "Good";
    if (averageHealth < 50) healthStatus = "Poor";
    else if (averageHealth < 75) healthStatus = "Fair";

    // Get new plants added this month
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const newPlantsThisMonth = plants.filter(plant => 
      plant.acquiredDate && new Date(plant.acquiredDate) >= firstDayOfMonth
    ).length;

    return {
      totalPlants: plants.length,
      plantsNeedingWater,
      healthStatus,
      healthPercentage: averageHealth,
      upcomingTasks: tasks.length,
      newPlantsThisMonth,
      environmentReadings: latestReading || {},
      recommendations: recommendations.slice(0, 2) // Return only 2 most recent recommendations
    };
  }
}

// Initialize database connection
const connectionString = process.env.DATABASE_URL as string;
console.log('Attempting to connect with DATABASE_URL:', connectionString); // Added for debugging
const client = postgres(connectionString);
const globalDbInstance: PostgresJsDatabase<typeof schema> = drizzle(client, { schema }); // Explicitly typed global instance

// Database storage implementation
export class DbStorage implements IStorage {
  private db: PostgresJsDatabase<typeof schema>; // Correctly typed db member

  constructor() {
    this.db = globalDbInstance; // Initialize instance db with the global one
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
    await this.createCareHistory({
      plantId: updatedTask.plantId,
      actionType: `completed_${updatedTask.taskType}`,
    });

    // If it's a watering task, update plant's lastWatered and create a new recurring task
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
        await this.updatePlant(plant.id, { ...plant, lastWatered: new Date(updatedTask.completedDate || Date.now()) });
      }
    }
    return {
      ...updatedTask,
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

    // Create a care history record
    await this.createCareHistory({
      plantId: updatedTask.plantId,
      actionType: `skipped_${updatedTask.taskType}`,
    });

    return {
      ...updatedTask,
      dueDate: updatedTask.dueDate ? new Date(updatedTask.dueDate) : new Date(),
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
        await this.createCareHistory({
          plantId: plant.id,
          actionType: 'water_recommended',
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
    const userPlants = await this.getPlantsByUserId(userId);
    const latestReading = await this.getLatestEnvironmentReadingByUserId(userId);

    for (const plant of userPlants) {
      if (!plant.id) continue;

      // Basic Watering Recommendation
      if (plant.lastWatered && plant.waterFrequencyDays) {
        const daysSinceLastWatered = (Date.now() - new Date(plant.lastWatered).getTime()) / (1000 * 3600 * 24);
        if (daysSinceLastWatered > plant.waterFrequencyDays) {
          await this.createRecommendation({
            userId,
            plantId: plant.id,
            recommendationType: 'water',
            message: `Time to water ${plant.name}. It was last watered ${Math.floor(daysSinceLastWatered)} days ago.`
          });
        }
      }

      // Basic Light Recommendation (Example - can be more sophisticated)
      if (latestReading && latestReading.lightLevel && plant.lightRequirement) {
        if (latestReading.lightLevel === 'low' && (plant.lightRequirement === 'medium' || plant.lightRequirement === 'high')) {
          await this.createRecommendation({
            userId,
            plantId: plant.id,
            recommendationType: 'light',
            message: `${plant.name} might need more light. Current room light level is low, but it prefers ${plant.lightRequirement} light.`
          });
        }
        if (latestReading.lightLevel === 'high' && (plant.lightRequirement === 'medium' || plant.lightRequirement === 'low')) {
          await this.createRecommendation({
            userId,
            plantId: plant.id,
            recommendationType: 'light',
            message: `${plant.name} might be getting too much light. Current room light level is high, but it prefers ${plant.lightRequirement} light.`
          });
        }
      }
      // Add more recommendation logic (temperature, humidity, etc.) here
    }
  }

  // Helper method for generating basic recommendations without AI
  async generateBasicRecommendations(
    userId: number, 
    plant: Plant, 
    latestReading: EnvironmentReading | undefined // Make latestReading optional
  ): Promise<void> {
    if (!plant.id) return;

    // Basic Watering Recommendation
    if (plant.lastWatered && plant.waterFrequencyDays) {
      const daysSinceLastWatered = (Date.now() - new Date(plant.lastWatered).getTime()) / (1000 * 3600 * 24);
      if (daysSinceLastWatered > plant.waterFrequencyDays) {
        await this.createRecommendation({
          userId,
          plantId: plant.id,
          recommendationType: 'water',
          message: `Time to water ${plant.name}. It was last watered ${Math.floor(daysSinceLastWatered)} days ago.`
        });
      }
    }

    // Basic Light Recommendation
    if (latestReading && latestReading.lightLevel && plant.lightRequirement) {
      if (latestReading.lightLevel === 'low' && (plant.lightRequirement === 'medium' || plant.lightRequirement === 'high')) {
        await this.createRecommendation({
          userId,
          plantId: plant.id,
          recommendationType: 'light',
          message: `${plant.name} might need more light. Current room light level is low, but it prefers ${plant.lightRequirement} light.`
        });
      }
      if (latestReading.lightLevel === 'high' && (plant.lightRequirement === 'medium' || plant.lightRequirement === 'low')) {
        await this.createRecommendation({
          userId,
          plantId: plant.id,
          recommendationType: 'light',
          message: `${plant.name} might be getting too much light. Current room light level is high, but it prefers ${plant.lightRequirement} light.`
        });
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
    const historyResult = await this.db.select({
        id: schema.careHistory.id,
        plantId: schema.careHistory.plantId,
        actionType: schema.careHistory.actionType,
        performedAt: schema.careHistory.performedAt,
        notes: schema.careHistory.notes, // Added notes to the select
        // plantName is selected because the join needs it for the where clause, 
        // but it won't be part of the final CareHistory object.
        plantName: schema.plants.name 
      })
      .from(schema.careHistory)
      .innerJoin(schema.plants, eq(schema.careHistory.plantId, schema.plants.id))
      .where(eq(schema.plants.userId, userId))
      .orderBy(desc(schema.careHistory.performedAt));

    return historyResult.map(h => ({
      id: h.id,
      plantId: h.plantId,
      actionType: h.actionType,
      notes: h.notes, // Map notes to the result object
      performedAt: h.performedAt ? new Date(h.performedAt) : null, // Preserve null if original was null
      // plantName is omitted to strictly match the CareHistory type
    })) as CareHistory[]; // Cast to CareHistory[]
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
  async getDashboardStats(userId: number): Promise<any> {
    const userPlants = await this.db.select().from(schema.plants).where(eq(schema.plants.userId, userId));
    const upcomingTasks = await this.db.select().from(schema.careTasks)
      .innerJoin(schema.plants, eq(schema.careTasks.plantId, schema.plants.id))
      .where(and(
        eq(schema.plants.userId, userId),
        eq(schema.careTasks.completed, false),
        eq(schema.careTasks.skipped, false),
        gte(schema.careTasks.dueDate, new Date()) // Tasks due today or in the future
      ))
      .orderBy(schema.careTasks.dueDate)
      .limit(5);

    const overdueTasks = await this.db.select().from(schema.careTasks)
      .innerJoin(schema.plants, eq(schema.careTasks.plantId, schema.plants.id))
      .where(and(
        eq(schema.plants.userId, userId),
        eq(schema.careTasks.completed, false),
        eq(schema.careTasks.skipped, false),
        isNull(schema.careTasks.completedDate), // Ensure not completed
        isNull(schema.careTasks.skipped), // Ensure not skipped
        lt(schema.careTasks.dueDate, new Date()) // Tasks due in the past
      ))
      .orderBy(desc(schema.careTasks.dueDate));

    const recentActivity = await this.db.select().from(schema.careHistory)
      .innerJoin(schema.plants, eq(schema.careHistory.plantId, schema.plants.id))
      .where(and(
        eq(schema.plants.userId, userId),
        isNull(schema.careHistory.actionType) // This condition might need adjustment based on desired activity
      ))
      .orderBy(desc(schema.careHistory.performedAt))
      .limit(5);

    const plantsNeedingAttention = userPlants.filter(p => p.status === 'needs_care' || p.status === 'unhealthy').length;

    // Plant health summary (average health)
    const healthMetrics = await this.db.select({
        overallHealth: schema.plantHealthMetrics.overallHealth
      })
      .from(schema.plantHealthMetrics)
      .innerJoin(schema.plants, eq(schema.plantHealthMetrics.plantId, schema.plants.id))
      .where(eq(schema.plants.userId, userId));
    
    const avgHealth = healthMetrics.length > 0 ? 
      healthMetrics.reduce((sum, m) => sum + (m.overallHealth || 0), 0) / healthMetrics.length : 0;

    return {
      totalPlants: userPlants.length,
      upcomingTasksCount: upcomingTasks.length,
      overdueTasksCount: overdueTasks.length,
      plantsNeedingAttention,
      averagePlantHealth: Math.round(avgHealth),
      upcomingTasksList: upcomingTasks.map(t => ({ ...t.care_tasks, plantName: t.plants.name, dueDate: t.care_tasks.dueDate ? new Date(t.care_tasks.dueDate) : null })),
      recentActivityList: recentActivity.map(a => ({ ...a.care_history, plantName: a.plants.name, performedAt: a.care_history.performedAt ? new Date(a.care_history.performedAt) : null }))
    };
  }
}

// Initialize database storage
export const storage = new DbStorage();
