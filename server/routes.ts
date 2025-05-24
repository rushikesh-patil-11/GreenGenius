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
import { clerkClient, ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';

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
  app.get('/api/plants', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for GET /api/plants' });
      }
      const clerkId = req.auth.userId;

      // Fetch user details from Clerk (consistent with POST /api/plants)
      // This step is crucial if getOrCreateUserByClerkId needs to create a user.
      // For a pure GET, if the user must exist, a getUserByClerkId might be better,
      // but we'll follow the existing pattern for now.
      const clerkUser = await clerkClient.users.getUser(clerkId);
      if (!clerkUser) {
        // This case should ideally not be hit if ClerkExpressRequireAuth works correctly
        // and the user exists in Clerk.
        return res.status(404).json({ error: 'Authenticated user not found in Clerk' });
      }

      // Get or create user in local database to retrieve internal appUser.id
      const appUser = await storage.getOrCreateUserByClerkId(clerkId, {
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '',
        username: clerkUser.username,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      });

      if (!appUser || !appUser.id) {
        return res.status(500).json({ error: 'Failed to retrieve local user record for authenticated user' });
      }

      const plants = await storage.getPlantsByUserId(appUser.id);
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

  app.post('/api/plants', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated' });
      }
      const clerkId = req.auth.userId; // This is the Clerk User ID

      // Extract basic plant data from request body (userId is no longer needed from body)
      const { name, species, imageUrl, description, waterFrequencyDays, lightRequirement, status, lastWatered } = req.body;
      
      // Basic validation for required fields
      if (!name) {
        return res.status(400).json({ 
          error: 'Missing required fields', 
          details: 'name is a required field' 
        });
      }

      // Fetch user details from Clerk
      const clerkUser = await clerkClient.users.getUser(clerkId);
      if (!clerkUser) {
        return res.status(404).json({ error: 'User not found in Clerk' });
      }

      // Get or create user in local database
      const appUser = await storage.getOrCreateUserByClerkId(clerkId, {
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '', // Primary email
        username: clerkUser.username,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      });

      if (!appUser || !appUser.id) {
        return res.status(500).json({ error: 'Failed to get or create local user record' });
      }
      
      // Construct the plant data with properly parsed fields
      const plantData = {
        userId: appUser.id, // Use the internal database ID
        name,
        species: species || null,
        imageUrl: imageUrl || null,
        description: description || null,
        waterFrequencyDays: waterFrequencyDays ? Number(waterFrequencyDays) : null,
        lightRequirement: lightRequirement || null,
        status: status || 'healthy',
        lastWatered: lastWatered ? new Date(lastWatered) : new Date()
      };

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
  app.get('/api/environment', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for GET /api/environment' });
      }
      const clerkId = req.auth.userId;

      const clerkUser = await clerkClient.users.getUser(clerkId);
      if (!clerkUser) {
        return res.status(404).json({ error: 'Authenticated user not found in Clerk' });
      }

      const appUser = await storage.getOrCreateUserByClerkId(clerkId, {
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '',
        username: clerkUser.username,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      });

      if (!appUser || !appUser.id) {
        return res.status(500).json({ error: 'Failed to retrieve local user record for authenticated user' });
      }

      const readings = await storage.getLatestEnvironmentReadingByUserId(appUser.id);
      return res.json(readings || {});
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.post('/api/environment', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      // For POST, we need to ensure the userId in the body (if still present from older clients or schema)
      // is either ignored or validated against the authenticated user.
      // Best practice: derive userId solely from auth session for POST operations.
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for POST /api/environment' });
      }
      const clerkId = req.auth.userId;

      const clerkUser = await clerkClient.users.getUser(clerkId);
      if (!clerkUser) {
        return res.status(404).json({ error: 'Authenticated user not found in Clerk' });
      }
      const appUser = await storage.getOrCreateUserByClerkId(clerkId, {
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '',
        username: clerkUser.username,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      });
      if (!appUser || !appUser.id) {
        return res.status(500).json({ error: 'Failed to retrieve local user record for authenticated user' });
      }

      // Validate the rest of the body, ensuring userId from body is NOT used or matches appUser.id
      const { data, error } = validateBody(insertEnvironmentReadingSchema, { ...req.body, userId: appUser.id });
      if (error) {
        return res.status(400).json({ error: 'Invalid environment data', details: error });
      }

      const reading = await storage.createEnvironmentReading(data); // data now includes the correct appUser.id
      
      // Generate recommendations based on the new reading, using the correct appUser.id
      await storage.generateRecommendations(appUser.id);
      
      return res.status(201).json(reading);
    } catch (error) {
      return handleError(res, error);
    }
  });

  // Care tasks routes
  app.get('/api/care-tasks', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for GET /api/care-tasks' });
      }
      const clerkId = req.auth.userId;

      const clerkUser = await clerkClient.users.getUser(clerkId);
      if (!clerkUser) {
        return res.status(404).json({ error: 'Authenticated user not found in Clerk' });
      }

      const appUser = await storage.getOrCreateUserByClerkId(clerkId, {
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '',
        username: clerkUser.username,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      });

      if (!appUser || !appUser.id) {
        return res.status(500).json({ error: 'Failed to retrieve local user record for authenticated user' });
      }

      const tasks = await storage.getCareTasksByUserId(appUser.id);
      return res.json(tasks);
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.post('/api/care-tasks', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for POST /api/care-tasks' });
      }
      const clerkId = req.auth.userId;
      const clerkUser = await clerkClient.users.getUser(clerkId);
      if (!clerkUser) {
        return res.status(404).json({ error: 'Authenticated user not found in Clerk' });
      }
      const appUser = await storage.getOrCreateUserByClerkId(clerkId, {
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '',
        username: clerkUser.username,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      });
      if (!appUser || !appUser.id) {
        return res.status(500).json({ error: 'Failed to retrieve local user record for authenticated user' });
      }

      // Ensure userId in body is from authenticated user
      const { data, error } = validateBody(insertCareTaskSchema, { ...req.body, userId: appUser.id });
      if (error) {
        return res.status(400).json({ error: 'Invalid care task data', details: error });
      }

      const task = await storage.createCareTask(data); // data now includes the correct appUser.id
      return res.status(201).json(task);
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.put('/api/care-tasks/:id/complete', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      // Ensure the authenticated user is authorized to complete this task (e.g., task belongs to them)
      // This might require fetching the task first and checking its userId against appUser.id
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // const clerkId = req.auth.userId; // Potentially use for authorization check

      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: 'Valid task ID is required' });
      }

      // TODO: Add authorization check: ensure task belongs to authenticated user

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

  app.put('/api/care-tasks/:id/skip', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      // Ensure the authenticated user is authorized to skip this task
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // const clerkId = req.auth.userId; // Potentially use for authorization check

      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: 'Valid task ID is required' });
      }

      // TODO: Add authorization check: ensure task belongs to authenticated user

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
  app.get('/api/recommendations', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for GET /api/recommendations' });
      }
      const clerkId = req.auth.userId;

      const clerkUser = await clerkClient.users.getUser(clerkId);
      if (!clerkUser) {
        return res.status(404).json({ error: 'Authenticated user not found in Clerk' });
      }

      const appUser = await storage.getOrCreateUserByClerkId(clerkId, {
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '',
        username: clerkUser.username,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      });

      if (!appUser || !appUser.id) {
        return res.status(500).json({ error: 'Failed to retrieve local user record for authenticated user' });
      }

      const recommendations = await storage.getRecommendationsByUserId(appUser.id);
      return res.json(recommendations);
    } catch (error) {
      return handleError(res, error);
    }
  });
  
  // Generate AI recommendations on demand
  app.post('/api/recommendations/generate', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for POST /api/recommendations/generate' });
      }
      const clerkId = req.auth.userId;

      const clerkUser = await clerkClient.users.getUser(clerkId);
      if (!clerkUser) {
        return res.status(404).json({ error: 'Authenticated user not found in Clerk' });
      }
      const appUser = await storage.getOrCreateUserByClerkId(clerkId, {
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '',
        username: clerkUser.username,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      });
      if (!appUser || !appUser.id) {
        return res.status(500).json({ error: 'Failed to retrieve local user record for authenticated user' });
      }
      
      // The original code used req.body.userId. We'll use the authenticated appUser.id instead.
      // const userIdFromBody = parseInt(req.body.userId as string);
      // if (isNaN(userIdFromBody) || userIdFromBody !== appUser.id) {
      //   return res.status(400).json({ error: 'Valid userId matching authenticated user is required in body, or omit it.' });
      // }

      // Assuming generateRecommendations now takes the internal appUser.id
      await storage.generateRecommendations(appUser.id);
      const recommendations = await storage.getRecommendationsByUserId(appUser.id);
      
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
  app.get('/api/dashboard-stats', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for GET /api/dashboard-stats' });
      }
      const clerkId = req.auth.userId;

      const clerkUser = await clerkClient.users.getUser(clerkId);
      if (!clerkUser) {
        return res.status(404).json({ error: 'Authenticated user not found in Clerk' });
      }

      const appUser = await storage.getOrCreateUserByClerkId(clerkId, {
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '',
        username: clerkUser.username,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      });

      if (!appUser || !appUser.id) {
        return res.status(500).json({ error: 'Failed to retrieve local user record for authenticated user' });
      }

      const stats = await storage.getDashboardStats(appUser.id);
      // Ensure the user's name is included, preferring Clerk's first name if available
      const userName = appUser.name || clerkUser.firstName || appUser.username || 'User';
      
      return res.json({ ...stats, name: userName });
    } catch (error) {
      return handleError(res, error);
    }
  });

  // Care history routes
  app.get('/api/plants/:plantId/care-history', async (req, res) => {
    try {
      const plantId = parseInt(req.params.plantId);
      if (isNaN(plantId)) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      const careHistory = await storage.getCareHistoryByPlantId(plantId);
      if (!careHistory) {
        return res.status(404).json({ error: 'Care history not found' });
      }

      return res.json(careHistory);
    } catch (error) {
      return handleError(res, error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
