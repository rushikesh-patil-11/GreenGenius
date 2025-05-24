import { 
  User, InsertUser, 
  Plant, InsertPlant,
  EnvironmentReading, InsertEnvironmentReading,
  CareTask, InsertCareTask,
  Recommendation, InsertRecommendation,
  CareHistory, InsertCareHistory,
  PlantHealthMetric, InsertPlantHealthMetric,
  users, plants, environmentReadings, careTasks, recommendations, careHistory, plantHealthMetrics
} from "@shared/schema";
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, desc, and, gte, lte, isNull } from 'drizzle-orm';
import postgres from 'postgres';
import { type InferInsertModel } from 'drizzle-orm';

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
    const plant: Plant = { ...insertPlant, id };
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
        return new Date(b.readingTimestamp).getTime() - new Date(a.readingTimestamp).getTime();
      });
    
    return userReadings[0];
  }

  async createEnvironmentReading(insertReading: InsertEnvironmentReading): Promise<EnvironmentReading> {
    const id = this.readingId++;
    const reading: EnvironmentReading = { 
      ...insertReading, 
      id, 
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
      completedDate: undefined,
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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createRecommendation(insertRecommendation: InsertRecommendation): Promise<Recommendation> {
    const id = this.recommendationId++;
    const recommendation: Recommendation = { 
      ...insertRecommendation, 
      id, 
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
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  }

  async createCareHistory(insertHistory: InsertCareHistory): Promise<CareHistory> {
    const id = this.historyId++;
    const history: CareHistory = { 
      ...insertHistory, 
      id, 
      performedAt: new Date() 
    };
    this.careHistory.set(id, history);
    return history;
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
      if (health) {
        totalHealth += health.overallHealth;
        if (health.overallHealth >= 75) {
          healthyPlants++;
        }
      }
    }

    const averageHealth = plants.length > 0 ? Math.round(totalHealth / plants.length) : 0;
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
const client = postgres(connectionString);
const db = drizzle(client);

// Database storage implementation
export class DbStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Plant operations
  async getPlantById(id: number): Promise<Plant | undefined> {
    const result = await db.select().from(plants).where(eq(plants.id, id));
    return result[0];
  }

  async getPlantsByUserId(userId: number): Promise<Plant[]> {
    return await db.select().from(plants).where(eq(plants.userId, userId));
  }

  async createPlant(plant: InsertPlant): Promise<Plant> {
    const result = await db.insert(plants).values(plant).returning();
    const newPlant = result[0];
    
    // Initialize health metrics for the new plant
    await this.updatePlantHealthMetrics(newPlant.id);
    
    // Create initial watering task if frequency is set
    if (plant.waterFrequencyDays) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + plant.waterFrequencyDays);
      
      await this.createCareTask({
        plantId: newPlant.id,
        taskType: "water",
        dueDate
      });
    }
    
    return newPlant;
  }

  async updatePlant(id: number, plantData: InsertPlant): Promise<Plant | undefined> {
    const result = await db
      .update(plants)
      .set(plantData)
      .where(eq(plants.id, id))
      .returning();
    
    return result[0];
  }

  async deletePlant(id: number): Promise<boolean> {
    const result = await db
      .delete(plants)
      .where(eq(plants.id, id))
      .returning({ id: plants.id });
    
    return result.length > 0;
  }

  // Environment readings operations
  async getLatestEnvironmentReadingByUserId(userId: number): Promise<EnvironmentReading | undefined> {
    const result = await db
      .select()
      .from(environmentReadings)
      .where(eq(environmentReadings.userId, userId))
      .orderBy(desc(environmentReadings.readingTimestamp))
      .limit(1);
    
    return result[0];
  }

  async createEnvironmentReading(reading: InsertEnvironmentReading): Promise<EnvironmentReading> {
    const result = await db
      .insert(environmentReadings)
      .values({
        ...reading,
        readingTimestamp: new Date()
      })
      .returning();
    
    return result[0];
  }

  // Care tasks operations
  async getCareTasksByUserId(userId: number): Promise<CareTask[]> {
    // Find all plants for this user
    const userPlants = await this.getPlantsByUserId(userId);
    const plantIds = userPlants.map(plant => plant.id);
    
    if (plantIds.length === 0) {
      return [];
    }
    
    // Get all tasks for these plants where not completed and not skipped
    return await db
      .select()
      .from(careTasks)
      .where(
        and(
          careTasks.plantId.in(plantIds),
          eq(careTasks.completed, false),
          eq(careTasks.skipped, false)
        )
      )
      .orderBy(careTasks.dueDate);
  }

  async createCareTask(task: InsertCareTask): Promise<CareTask> {
    const result = await db
      .insert(careTasks)
      .values({
        ...task,
        completed: false,
        skipped: false
      })
      .returning();
    
    return result[0];
  }

  async completeCareTask(id: number): Promise<CareTask | undefined> {
    const result = await db
      .update(careTasks)
      .set({ 
        completed: true, 
        completedDate: new Date() 
      })
      .where(eq(careTasks.id, id))
      .returning();
    
    const task = result[0];
    if (!task) return undefined;
    
    // If it's a recurring task like watering, create the next task
    if (task.taskType === 'water') {
      const plant = await this.getPlantById(task.plantId);
      if (plant && plant.waterFrequencyDays) {
        // Update the plant's last watered date
        await this.updatePlant(plant.id, {
          ...plant,
          lastWatered: new Date()
        });
        
        // Add to care history
        await this.createCareHistory({
          plantId: plant.id,
          actionType: 'watered',
          notes: 'Completed watering task'
        });
        
        // Create next watering task
        const nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + plant.waterFrequencyDays);
        
        await this.createCareTask({
          plantId: plant.id,
          taskType: "water",
          dueDate: nextDueDate
        });
        
        // Update plant health metrics
        await this.updatePlantHealthMetrics(plant.id);
      }
    }
    
    return task;
  }

  async skipCareTask(id: number): Promise<CareTask | undefined> {
    const result = await db
      .update(careTasks)
      .set({ skipped: true })
      .where(eq(careTasks.id, id))
      .returning();
    
    return result[0];
  }

  // Recommendations operations
  async getRecommendationsByUserId(userId: number): Promise<Recommendation[]> {
    return await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.userId, userId),
          eq(recommendations.applied, false)
        )
      )
      .orderBy(desc(recommendations.createdAt));
  }

  async createRecommendation(rec: InsertRecommendation): Promise<Recommendation> {
    const result = await db
      .insert(recommendations)
      .values({
        ...rec,
        applied: false,
        createdAt: new Date()
      })
      .returning();
    
    return result[0];
  }

  async applyRecommendation(id: number): Promise<Recommendation | undefined> {
    const result = await db
      .update(recommendations)
      .set({ applied: true })
      .where(eq(recommendations.id, id))
      .returning();
    
    const recommendation = result[0];
    if (!recommendation) return undefined;
    
    // If it's a watering recommendation, adjust the plant's watering frequency
    if (recommendation.recommendationType === 'water' && recommendation.plantId) {
      const plant = await this.getPlantById(recommendation.plantId);
      if (plant && plant.waterFrequencyDays) {
        // Extract the suggested days from the recommendation message
        const daysMatch = recommendation.message.match(/(\d+)\s*days/);
        if (daysMatch && daysMatch[1]) {
          const suggestedDays = parseInt(daysMatch[1]);
          await this.updatePlant(plant.id, {
            ...plant,
            waterFrequencyDays: suggestedDays
          });
        }
      }
    }
    
    return recommendation;
  }

  async generateRecommendations(userId: number): Promise<void> {
    const plants = await this.getPlantsByUserId(userId);
    const latestReading = await this.getLatestEnvironmentReadingByUserId(userId);
    
    if (!latestReading || plants.length === 0) return;

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
    return await db
      .select()
      .from(careHistory)
      .where(eq(careHistory.plantId, plantId))
      .orderBy(desc(careHistory.performedAt));
  }

  async createCareHistory(history: InsertCareHistory): Promise<CareHistory> {
    const result = await db
      .insert(careHistory)
      .values({
        ...history,
        performedAt: new Date()
      })
      .returning();
    
    return result[0];
  }

  // Plant health metrics
  async getPlantHealthMetrics(plantId: number): Promise<PlantHealthMetric | undefined> {
    const result = await db
      .select()
      .from(plantHealthMetrics)
      .where(eq(plantHealthMetrics.plantId, plantId));
    
    return result[0];
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
    
    if (existingMetrics) {
      // Update existing metrics
      const result = await db
        .update(plantHealthMetrics)
        .set({
          waterLevel: Math.round(waterLevel),
          lightLevel: Math.round(lightLevel),
          overallHealth,
          updatedAt: new Date()
        })
        .where(eq(plantHealthMetrics.id, existingMetrics.id))
        .returning();
      
      return result[0];
    } else {
      // Create new metrics
      const result = await db
        .insert(plantHealthMetrics)
        .values({
          plantId,
          waterLevel: Math.round(waterLevel),
          lightLevel: Math.round(lightLevel),
          overallHealth,
          updatedAt: new Date()
        })
        .returning();
      
      return result[0];
    }
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
      if (health && health.overallHealth) {
        totalHealth += health.overallHealth;
        if (health.overallHealth >= 75) {
          healthyPlants++;
        }
      }
    }

    const averageHealth = plants.length > 0 ? Math.round(totalHealth / plants.length) : 0;
    
    // Get health status text based on average health
    let healthStatus = 'Good';
    if (averageHealth >= 85) {
      healthStatus = 'Excellent';
    } else if (averageHealth >= 70) {
      healthStatus = 'Good';
    } else if (averageHealth >= 50) {
      healthStatus = 'Fair';
    } else {
      healthStatus = 'Needs Attention';
    }

    // Calculate plants added in the current month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const newPlantsThisMonth = plants.filter(plant => {
      if (!plant.acquiredDate) return false;
      const acquiredDate = new Date(plant.acquiredDate);
      return acquiredDate.getMonth() === currentMonth && acquiredDate.getFullYear() === currentYear;
    }).length;

    return {
      totalPlants: plants.length,
      plantsNeedingWater,
      healthStatus,
      healthPercentage: averageHealth,
      upcomingTasks: tasks.length,
      newPlantsThisMonth,
      name: 'Alex' // Default name for demo
    };
  }
}

// Initialize database storage
export const storage = new DbStorage();
