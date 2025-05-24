import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertPlantSchema, 
  insertEnvironmentReadingSchema, 
  insertCareTaskSchema,
  insertCareHistorySchema,
  insertRecommendationSchema,
  insertPlantHealthMetricsSchema
} from "@shared/schema";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper function to validate request body
  function validateBody(schema: any, body: any) {
    try {
      return { data: schema.parse(body), error: null };
    } catch (error) {
      if (error instanceof ZodError) {
        return { data: null, error: error.format() };
      }
      return { data: null, error };
    }
  }

  // Error handler
  const handleError = (res: any, error: any) => {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Something went wrong', 
      details: error.message || String(error) 
    });
  };

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { data, error } = validateBody(insertUserSchema, req.body);
      if (error) {
        return res.status(400).json({ error: 'Invalid user data', details: error });
      }

      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      const user = await storage.createUser(data);
      return res.status(201).json({ 
        id: user.id, 
        username: user.username,
        name: user.name,
        email: user.email
      });
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      return res.json({ 
        id: user.id, 
        username: user.username,
        name: user.name,
        email: user.email
      });
    } catch (error) {
      return handleError(res, error);
    }
  });

  // Plants routes
  app.get('/api/plants', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Valid userId is required' });
      }

      const plants = await storage.getPlantsByUserId(userId);
      return res.json(plants);
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.get('/api/plants/:id', async (req, res) => {
    try {
      const plantId = parseInt(req.params.id);
      if (isNaN(plantId)) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      const plant = await storage.getPlantById(plantId);
      if (!plant) {
        return res.status(404).json({ error: 'Plant not found' });
      }

      return res.json(plant);
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.post('/api/plants', async (req, res) => {
    try {
      // Extract basic plant data from request
      const { userId, name, species, imageUrl, description, waterFrequencyDays, lightRequirement, status, lastWatered } = req.body;
      
      // Basic validation for required fields
      if (!userId || !name) {
        return res.status(400).json({ 
          error: 'Missing required fields', 
          details: 'userId and name are required fields' 
        });
      }
      
      // Construct the plant data with properly parsed fields
      const plantData = {
        userId: Number(userId),
        name,
        species: species || null,
        imageUrl: imageUrl || null,
        description: description || null,
        waterFrequencyDays: waterFrequencyDays ? Number(waterFrequencyDays) : null,
        lightRequirement: lightRequirement || null,
        status: status || 'healthy',
        // Parse date string to Date object
        lastWatered: lastWatered ? new Date(lastWatered) : new Date()
      };

      // Create the plant directly without schema validation
      const plant = await storage.createPlant(plantData);
      return res.status(201).json(plant);
    } catch (error) {
      console.error('Error creating plant:', error);
      return handleError(res, error);
    }
  });

  app.put('/api/plants/:id', async (req, res) => {
    try {
      const plantId = parseInt(req.params.id);
      if (isNaN(plantId)) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      const { data, error } = validateBody(insertPlantSchema, req.body);
      if (error) {
        return res.status(400).json({ error: 'Invalid plant data', details: error });
      }

      const updatedPlant = await storage.updatePlant(plantId, data);
      if (!updatedPlant) {
        return res.status(404).json({ error: 'Plant not found' });
      }

      return res.json(updatedPlant);
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.delete('/api/plants/:id', async (req, res) => {
    try {
      const plantId = parseInt(req.params.id);
      if (isNaN(plantId)) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      const success = await storage.deletePlant(plantId);
      if (!success) {
        return res.status(404).json({ error: 'Plant not found' });
      }

      return res.json({ success: true });
    } catch (error) {
      return handleError(res, error);
    }
  });

  // Environment readings routes
  app.get('/api/environment', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Valid userId is required' });
      }

      const readings = await storage.getLatestEnvironmentReadingByUserId(userId);
      return res.json(readings || {});
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.post('/api/environment', async (req, res) => {
    try {
      const { data, error } = validateBody(insertEnvironmentReadingSchema, req.body);
      if (error) {
        return res.status(400).json({ error: 'Invalid environment data', details: error });
      }

      const reading = await storage.createEnvironmentReading(data);
      
      // Generate recommendations based on the new reading
      await storage.generateRecommendations(data.userId);
      
      return res.status(201).json(reading);
    } catch (error) {
      return handleError(res, error);
    }
  });

  // Care tasks routes
  app.get('/api/care-tasks', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Valid userId is required' });
      }

      const tasks = await storage.getCareTasksByUserId(userId);
      return res.json(tasks);
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.post('/api/care-tasks', async (req, res) => {
    try {
      const { data, error } = validateBody(insertCareTaskSchema, req.body);
      if (error) {
        return res.status(400).json({ error: 'Invalid care task data', details: error });
      }

      const task = await storage.createCareTask(data);
      return res.status(201).json(task);
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.put('/api/care-tasks/:id/complete', async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: 'Valid task ID is required' });
      }

      const task = await storage.completeCareTask(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Care task not found' });
      }

      // If it's a watering task, update the plant's last watered date
      if (task.taskType === 'water') {
        const plant = await storage.getPlantById(task.plantId);
        if (plant) {
          await storage.updatePlant(plant.id, {
            ...plant,
            lastWatered: new Date()
          });
          
          // Add to care history
          await storage.createCareHistory({
            plantId: plant.id,
            actionType: 'watered',
            notes: 'Completed watering task'
          });
          
          // Update plant health metrics
          await storage.updatePlantHealthMetrics(plant.id);
        }
      }

      return res.json(task);
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.put('/api/care-tasks/:id/skip', async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: 'Valid task ID is required' });
      }

      const task = await storage.skipCareTask(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Care task not found' });
      }

      return res.json(task);
    } catch (error) {
      return handleError(res, error);
    }
  });

  // Recommendations routes
  app.get('/api/recommendations', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Valid userId is required' });
      }

      const recommendations = await storage.getRecommendationsByUserId(userId);
      return res.json(recommendations);
    } catch (error) {
      return handleError(res, error);
    }
  });
  
  // Generate AI recommendations on demand
  app.post('/api/recommendations/generate', async (req, res) => {
    try {
      const userId = parseInt(req.body.userId as string);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Valid userId is required' });
      }
      
      await storage.generateRecommendations(userId);
      const recommendations = await storage.getRecommendationsByUserId(userId);
      
      return res.json({ 
        success: true,
        message: 'AI-powered recommendations generated successfully',
        count: recommendations.length,
        recommendations
      });
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.put('/api/recommendations/:id/apply', async (req, res) => {
    try {
      const recId = parseInt(req.params.id);
      if (isNaN(recId)) {
        return res.status(400).json({ error: 'Valid recommendation ID is required' });
      }

      const recommendation = await storage.applyRecommendation(recId);
      if (!recommendation) {
        return res.status(404).json({ error: 'Recommendation not found' });
      }

      // If it's a watering recommendation, adjust the plant's watering frequency
      if (recommendation.recommendationType === 'water' && recommendation.plantId) {
        const plant = await storage.getPlantById(recommendation.plantId);
        if (plant && plant.waterFrequencyDays) {
          // Extract the suggested days from the recommendation message
          const daysMatch = recommendation.message.match(/(\d+)\s*days/);
          if (daysMatch && daysMatch[1]) {
            const suggestedDays = parseInt(daysMatch[1]);
            await storage.updatePlant(plant.id, {
              ...plant,
              waterFrequencyDays: suggestedDays
            });
          }
        }
      }

      return res.json(recommendation);
    } catch (error) {
      return handleError(res, error);
    }
  });

  // Plant health metrics routes
  app.get('/api/plants/:id/health', async (req, res) => {
    try {
      const plantId = parseInt(req.params.id);
      if (isNaN(plantId)) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      const healthMetrics = await storage.getPlantHealthMetrics(plantId);
      if (!healthMetrics) {
        return res.status(404).json({ error: 'Plant health metrics not found' });
      }

      return res.json(healthMetrics);
    } catch (error) {
      return handleError(res, error);
    }
  });

  // Dashboard stats
  app.get('/api/dashboard-stats', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Valid userId is required' });
      }

      const stats = await storage.getDashboardStats(userId);
      return res.json(stats);
    } catch (error) {
      return handleError(res, error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
