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
  insertPlantHealthMetricsSchema,
  InsertPlant
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
    console.log(`[routes.ts] POST /api/plants - Route handler started. Storage type from import: ${storage.constructor.name}`); // Log storage type
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated' });
      }
      const clerkId = req.auth.userId; // This is the Clerk User ID

      // Validate request body using Zod schema (omitting userId as it's derived from auth)
      const { data: validatedBody, error: validationError } = validateBody(
        insertPlantSchema.omit({ userId: true }),
        req.body
      );

      if (validationError) {
        return res.status(400).json({ error: 'Invalid plant data', details: validationError });
      }

      // Fetch user details from Clerk
      const clerkUser = await clerkClient.users.getUser(clerkId);
      if (!clerkUser) {
        return res.status(404).json({ error: 'User not found in Clerk' });
      }

      console.log(`[routes.ts] POST /api/plants - Calling storage.getOrCreateUserByClerkId for clerkId: ${clerkId}`);
      // Get or create user in local database
      const appUser = await storage.getOrCreateUserByClerkId(clerkId, {
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '', // Primary email
        username: clerkUser.username,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      });
      console.log(`[routes.ts] POST /api/plants - appUser from storage: ${JSON.stringify(appUser)}`);


      if (!appUser || typeof appUser.id !== 'number' || appUser.id <= 0) { // More robust check for valid ID
        console.error(`[routes.ts] POST /api/plants - Invalid appUser or appUser.id: ${appUser?.id}`);
        return res.status(500).json({ error: 'Failed to get or create a valid local user record' });
      }
      
      // Construct the plant data for database insertion
      const plantDataForDb: InsertPlant = {
        name: validatedBody.name!, // name is required by schema, so validatedBody.name is string
        userId: appUser.id,        // from appUser
        species: validatedBody.species,          // string | undefined from Zod schema
        imageUrl: validatedBody.imageUrl,        // string | undefined from Zod schema
        acquiredDate: validatedBody.acquiredDate,  // Date | undefined from Zod schema
        status: validatedBody.status,            // string | undefined from Zod schema
        // lastWatered is Date | undefined from Zod schema, default to new Date() if undefined
        lastWatered: validatedBody.lastWatered === undefined ? new Date() : validatedBody.lastWatered,
      };
      console.log(`[routes.ts] POST /api/plants - Plant data for DB (plantDataForDb): ${JSON.stringify(plantDataForDb)}`);

      console.log(`[routes.ts] POST /api/plants - About to call storage.createPlant. Storage type: ${storage.constructor.name}`);
      const plant = await storage.createPlant(plantDataForDb);
      console.log(`[routes.ts] POST /api/plants - Plant object received from storage.createPlant: ${JSON.stringify(plant)}`);
      
      return res.status(201).json(plant);
    } catch (error) {
      console.error('[routes.ts] POST /api/plants - Error creating plant:', error); // Ensure this logs the error object
      return handleError(res, error);
    }
  });

  app.put('/api/plants/:id', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      const plantId = parseInt(req.params.id);
      if (isNaN(plantId)) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for plant update' });
      }
      // We might need to verify that this plant belongs to the authenticated user
      // This requires fetching the plant first, then checking its userId against appUser.id

      // Validate request body using Zod schema for partial updates
      // userId should not be updatable through this route.
      const { data: validatedBody, error: validationError } = validateBody(
        insertPlantSchema.partial().omit({ userId: true }),
        req.body
      );

      if (validationError) {
        return res.status(400).json({ error: 'Invalid plant data for update', details: validationError });
      }

      if (Object.keys(validatedBody).length === 0) {
        return res.status(400).json({ error: 'No fields provided for update' });
      }

      // Construct the data for storage.updatePlant
      // validatedBody contains fields that are present and valid according to the partial schema.
      // Date fields (acquiredDate, lastWatered) will be Date | undefined.
      const updateData: Partial<InsertPlant> = {
        ...validatedBody,
        // acquiredDate and lastWatered from validatedBody are already Date | undefined
        // If they were in req.body and valid, Zod coerced them. If not, they are undefined.
      };

      const updatedPlant = await storage.updatePlant(plantId, updateData);
      if (!updatedPlant) {
        return res.status(404).json({ error: 'Plant not found or update failed' });
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

  app.get('/api/plants/:id/health', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      const plantId = parseInt(req.params.id);
      if (isNaN(plantId)) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      // Ensure the authenticated user has access to this plant's health metrics
      // This typically involves checking if the plant belongs to the user.
      // For now, we assume storage.getPlantHealthMetrics handles this or it's public.
      // If not, you'd fetch the plant, check its userId against req.auth.userId (after getting appUser.id)

      const healthMetrics = await storage.getPlantHealthMetrics(plantId);
      if (!healthMetrics) {
        return res.status(404).json({ error: 'Plant health metrics not found' });
      }

      return res.json(healthMetrics);
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
          const {
            acquiredDate,
            lastWatered,
            ...restOfPlantProperties
          } = plant;

          // Prepare the update payload with converted dates
          const updatePayload = {
            ...restOfPlantProperties,
            acquiredDate: acquiredDate === null ? undefined : acquiredDate,
            lastWatered: new Date(), // Update to current time when watering task is done
          };

          await storage.updatePlant(plant.id, updatePayload);
          
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
