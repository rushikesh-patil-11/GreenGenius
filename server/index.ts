import * as dotenv from 'dotenv';
import './env'; // Load environment variables first
import path from 'path'; 
import { fileURLToPath } from 'url'; 
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { ClerkExpressRequireAuth, ClerkExpressWithAuth, clerkClient, type RequireAuthProp } from '@clerk/clerk-sdk-node';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "./storage";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(ClerkExpressWithAuth());

// Route for fetching plant details from Perenual API
import { dbInstance } from './storage';
import { z } from 'zod';
import * as schema from '../shared/schema';
import { plants as plantsTable, users as usersTable } from '../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

const CACHE_DURATION_DAYS = 7;

app.get('/api/plant-details/:plantName', ClerkExpressRequireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  const { plantName } = req.params;
  const clerkId = (req as RequireAuthProp<Request>).auth.userId;

  if (!clerkId) {
    log('User not authenticated');
    return res.status(401).json({ message: 'User not authenticated' });
  }

  let internalUserId: number;
  try {
    const user = await dbInstance.query.users.findFirst({
      where: eq(usersTable.clerkId, clerkId),
      columns: { id: true }
    });
    if (!user) {
      log(`User not found in DB for clerkId: ${clerkId}`);
      return res.status(404).json({ message: 'User not found.' });
    }
    internalUserId = user.id;
  } catch (dbError) {
    console.error('Error fetching user from DB:', dbError);
    log(`Error fetching user from DB for clerkId ${clerkId}: ${dbError}`);
    return next(dbError);
  }
  if (!plantName) {
    log('Attempted to fetch plant details without plantName');
    return res.status(400).json({ message: 'Plant name is required' });
  }

  const apiKey = process.env.PERENUAL_API_KEY;
  if (!apiKey) {
    console.error('PERENUAL_API_KEY is not set in environment variables.');
    log('PERENUAL_API_KEY is not set in environment variables.');
    return res.status(500).json({ message: 'API key configuration error.' });
  }

  try {
    log(`Fetching species list for: ${plantName} from Perenual API`);
    const speciesListOptions = {
      method: 'GET',
      url: 'https://perenual.com/api/v2/species-list',
      params: {
        key: apiKey,
        q: plantName
      }
    };

    const speciesListResponse = await axios.request(speciesListOptions);
    log(`Successfully fetched species list for: ${plantName}. Status: ${speciesListResponse.status}`);

    if (!speciesListResponse.data || !speciesListResponse.data.data || speciesListResponse.data.data.length === 0) {
      log(`No plant found for: ${plantName} in Perenual species list.`);
      return res.status(404).json({ message: `No plant found matching the name '${plantName}'.` });
    }

    const plantId = speciesListResponse.data.data[0].id;
    if (!plantId) {
      log(`Could not extract plant ID for: ${plantName} from species list response.`);
      return res.status(500).json({ message: 'Failed to retrieve plant ID from Perenual API response.' });
    }

    log(`Fetching detailed information for plant ID: ${plantId} (name: ${plantName}) from Perenual API`);
    const plantDetailsOptions = {
      method: 'GET',
      url: `https://perenual.com/api/v2/species/details/${plantId}`,
      params: {
        key: apiKey
      }
    };

    // Check cache first using Perenual plant ID
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - CACHE_DURATION_DAYS);

    const cachedPlant = await dbInstance.query.plants.findFirst({
      where: and(
        eq(plantsTable.perenual_id, plantId),
        eq(plantsTable.userId, internalUserId),
        // Optional: only return if last_api_sync is not null and recent
        // sql`${plantsTable.last_api_sync} IS NOT NULL AND ${plantsTable.last_api_sync} > ${sevenDaysAgo.toISOString()}` 
      )
    });

    if (cachedPlant && cachedPlant.last_api_sync && new Date(cachedPlant.last_api_sync) > sevenDaysAgo) {
      log(`Returning cached data for Perenual ID: ${plantId}, user ID: ${internalUserId}`);
      // TODO: Ensure the cachedPlant structure matches what the frontend expects
      // For now, we assume it's compatible or we'd transform it here.
      // The Perenual API response is nested under 'data', our cache is flat.
      // We might need to re-fetch from Perenual if frontend expects exact API structure.
      // For simplicity, let's return the cached data as is, assuming frontend can handle it or we adjust later.
      return res.json(cachedPlant); 
    }

    log(`Fetching detailed information for plant ID: ${plantId} (name: ${plantName}) from Perenual API. Cache miss or stale.`);
    const plantApiDetailsOptions = {
      method: 'GET',
      url: `https://perenual.com/api/v2/species/details/${plantId}`,
      params: {
        key: apiKey
      }
    };

    const plantDetailsResponse = await axios.request(plantApiDetailsOptions);
    log(`Successfully fetched detailed information for plant ID: ${plantId}. Status: ${plantDetailsResponse.status}`);
    
    const apiData = plantDetailsResponse.data;

    // Prepare data for DB upsert
    const plantDataToUpsert = {
      userId: internalUserId,
      name: apiData.common_name || plantName, // Use common_name from API if available
      perenual_id: apiData.id, 
      scientific_name: apiData.scientific_name || [],
      other_name: apiData.other_name || [],
      family: apiData.family || null,
      origin: apiData.origin || [],
      type: apiData.type || null,
      dimensions: apiData.dimensions || {},
      cycle: apiData.cycle || null,
      watering_general_benchmark: apiData.watering_general_benchmark || { value: null, unit: null },
      sunlight: apiData.sunlight || [],
      pruning_month: apiData.pruning_month || [],
      hardiness: apiData.hardiness || { min: null, max: null },
      flowers: apiData.flowers || false,
      flowering_season: apiData.flowering_season || null,
      soil: apiData.soil || [],
      pest_susceptibility: apiData.pest_susceptibility || [],
      cones: apiData.cones || false,
      fruits: apiData.fruits || false,
      edible_fruit: apiData.edible_fruit || false,
      fruiting_season: apiData.fruiting_season || null,
      leaf: apiData.leaf || false,
      edible_leaf: apiData.edible_leaf || false,
      growth_rate: apiData.growth_rate || null,
      maintenance: apiData.maintenance || null,
      medicinal: apiData.medicinal || false,
      poisonous_to_humans: apiData.poisonous_to_humans || false,
      poisonous_to_pets: apiData.poisonous_to_pets || false,
      drought_tolerant: apiData.drought_tolerant || false,
      salt_tolerant: apiData.salt_tolerant || false,
      thorny: apiData.thorny || false,
      invasive: apiData.invasive || false,
      rare: apiData.rare || false,
      tropical: apiData.tropical || false,
      cuisine: apiData.cuisine || false,
      indoor: apiData.indoor || false,
      care_level: apiData.care_level || null,
      description: apiData.description || null,
      api_image_url: apiData.default_image?.regular_url || apiData.default_image?.original_url || null,
      last_api_sync: new Date(),
      // Original fields that might not be directly from Perenual but need defaults or to be preserved
      species: apiData.scientific_name?.[0] || null, // Best guess for species
      // imageUrl: user might upload this, keep separate or use api_image_url as default
      // acquiredDate: should be set when user adds plant to their collection
      // status: default 'healthy'
      // lastWatered: user action
      // waterFrequencyDays: user setting or from care guide
      // notes: user input
    };

    try {
      const result = await dbInstance.insert(plantsTable)
        .values(plantDataToUpsert)
        .onConflictDoUpdate({
          target: [plantsTable.userId, plantsTable.perenual_id],
          set: { ...plantDataToUpsert, id: undefined }, // Exclude 'id' from set on update
        })
        .returning();
      log(`Upserted plant data to DB for perenual_id: ${apiData.id}, user: ${internalUserId}`);
      res.json(result[0]); // Return the upserted data from DB
    } catch (dbUpsertError) {
      console.error('Error upserting plant data to DB:', dbUpsertError);
      log(`Error upserting plant data for perenual_id ${apiData.id}: ${dbUpsertError}`);
      // If DB operation fails, still return fresh API data but log error
      res.json(apiData);
    }


  } catch (error: any) {
    console.error('Error fetching plant details from Perenual API:', error.response ? error.response.data : error.message);
    log(`Error fetching plant details for ${plantName} from Perenual API: ${error.message}`);
    
    if (error.response && error.response.status && error.response.data) {
      return res.status(error.response.status).json({ 
        message: `Error from Perenual API: ${error.response.data.message || error.message}`,
        details: error.response.data
      });
    } else if (error.response && error.response.status) {
      return res.status(error.response.status).json({ message: `Error from Perenual API: ${error.message}` });
    }
    next(error);
  }
});

// New route for fetching plant details from Perenual API using Perenual ID and upserting
app.get('/api/perenual-details/:perenualId', ClerkExpressRequireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  const { perenualId: perenualIdParam } = req.params;
  const perenualId = parseInt(perenualIdParam, 10);
  const clerkId = (req as RequireAuthProp<Request>).auth.userId;

  if (!clerkId) {
    log('User not authenticated for /api/perenual-details');
    return res.status(401).json({ message: 'User not authenticated' });
  }

  if (isNaN(perenualId)) {
    log('Invalid Perenual ID format provided.');
    return res.status(400).json({ message: 'Perenual ID must be a number.' });
  }

  let internalUserId: number;
  try {
    const user = await dbInstance.query.users.findFirst({
      where: eq(usersTable.clerkId, clerkId),
      columns: { id: true }
    });
    if (!user) {
      log(`User not found in DB for clerkId: ${clerkId} (Perenual details fetch)`);
      return res.status(404).json({ message: 'User not found.' });
    }
    internalUserId = user.id;
  } catch (dbError) {
    console.error('Error fetching user from DB (Perenual details fetch):', dbError);
    log(`Error fetching user from DB for clerkId ${clerkId} (Perenual details fetch): ${dbError}`);
    return next(dbError);
  }

  const apiKey = process.env.PERENUAL_API_KEY;
  if (!apiKey) {
    console.error('PERENUAL_API_KEY is not set in environment variables.');
    log('PERENUAL_API_KEY is not set in environment variables.');
    return res.status(500).json({ message: 'API key configuration error.' });
  }

  try {
    log(`Fetching detailed information for Perenual ID: ${perenualId} from Perenual API`);
    const plantApiDetailsOptions = {
      method: 'GET',
      url: `https://perenual.com/api/v2/species/details/${perenualId}`,
      params: { key: apiKey }
    };

    const plantDetailsResponse = await axios.request(plantApiDetailsOptions);
    log(`Successfully fetched detailed information for Perenual ID: ${perenualId}. Status: ${plantDetailsResponse.status}`);
    
    const apiData = plantDetailsResponse.data;
    if (!apiData || !apiData.id) {
        log(`No data or ID returned from Perenual for ID: ${perenualId}`);
        return res.status(404).json({ message: `No plant details found for Perenual ID '${perenualId}'.` });
    }

    // Prepare data for DB upsert
    const plantDataToUpsert = {
      userId: internalUserId,
      name: apiData.common_name || `Plant ID ${apiData.id}`, // Use common_name or a placeholder
      perenual_id: apiData.id,
      scientific_name: apiData.scientific_name || [],
      other_name: apiData.other_name || [],
      family: apiData.family || null,
      origin: apiData.origin || [],
      type: apiData.type || null,
      dimensions: apiData.dimensions || {},
      cycle: apiData.cycle || null,
      watering_general_benchmark: apiData.watering_general_benchmark || { value: null, unit: null },
      sunlight: apiData.sunlight || [],
      pruning_month: apiData.pruning_month || [],
      hardiness: apiData.hardiness || { min: null, max: null },
      flowers: apiData.flowers || false,
      flowering_season: apiData.flowering_season || null,
      soil: apiData.soil || [],
      pest_susceptibility: apiData.pest_susceptibility || [],
      cones: apiData.cones || false,
      fruits: apiData.fruits || false,
      edible_fruit: apiData.edible_fruit || false,
      fruiting_season: apiData.fruiting_season || null,
      leaf: apiData.leaf || false,
      edible_leaf: apiData.edible_leaf || false,
      growth_rate: apiData.growth_rate || null,
      maintenance: apiData.maintenance || null,
      medicinal: apiData.medicinal || false,
      poisonous_to_humans: apiData.poisonous_to_humans || false,
      poisonous_to_pets: apiData.poisonous_to_pets || false,
      drought_tolerant: apiData.drought_tolerant || false,
      salt_tolerant: apiData.salt_tolerant || false,
      thorny: apiData.thorny || false,
      invasive: apiData.invasive || false,
      rare: apiData.rare || false,
      tropical: apiData.tropical || false,
      cuisine: apiData.cuisine || false,
      indoor: apiData.indoor || false,
      care_level: apiData.care_level || null,
      description: apiData.description || null,
      api_image_url: apiData.default_image?.regular_url || apiData.default_image?.original_url || null,
      last_api_sync: new Date(),
      species: apiData.scientific_name?.[0] || null,
    };

    const result = await dbInstance.insert(plantsTable)
      .values(plantDataToUpsert)
      .onConflictDoUpdate({
        target: [plantsTable.userId, plantsTable.perenual_id],
        set: { ...plantDataToUpsert, id: undefined }, // Exclude 'id' from set on update
      })
      .returning();
    log(`Upserted plant data to DB for perenual_id: ${apiData.id}, user: ${internalUserId} (via /api/perenual-details)`);
    res.json(result[0]); // Return the upserted data from DB

  } catch (error: any) {
    console.error(`Error in /api/perenual-details/${perenualIdParam}:`, error.response ? error.response.data : error.message);
    log(`Error in /api/perenual-details for Perenual ID ${perenualIdParam}: ${error.message}`);
    if (error.response && error.response.status && error.response.data) {
      return res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      return res.status(503).json({ message: 'Service unavailable. No response from Perenual API.' });
    } else {
      return res.status(500).json({ message: 'Internal server error processing Perenual details.' });
    }
    // return next(error); // Fallback, but specific responses above are better
  }
});

// Endpoint to fetch plant health metrics
app.get('/api/plants/:plantId/health', ClerkExpressRequireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  const { plantId } = req.params;
  const clerkId = (req as RequireAuthProp<Request>).auth.userId;

  if (!clerkId) {
    log('User not authenticated for GET /api/plants/:plantId/health');
    return res.status(401).json({ message: 'User not authenticated' });
  }

  if (!plantId) {
    log('Attempted to fetch plant health without plantId');
    return res.status(400).json({ message: 'Plant ID is required' });
  }

  const numericPlantId = parseInt(plantId, 10);
  if (isNaN(numericPlantId)) {
    log(`Invalid plantId format: ${plantId}`);
    return res.status(400).json({ message: 'Invalid Plant ID format.' });
  }

  try {
    log(`Fetching health metrics for plant ID: ${numericPlantId}`);
    const healthMetrics = await dbInstance.query.plantHealthMetrics.findFirst({
      where: eq(schema.plantHealthMetrics.plantId, numericPlantId),
    });

    if (!healthMetrics) {
      log(`No health metrics found for plant ID: ${numericPlantId}`);
      return res.status(404).json({ message: 'Plant health metrics not found.' });
    }

    log(`Successfully fetched health metrics for plant ID: ${numericPlantId}`);
    res.json(healthMetrics);
  } catch (error: any) {
    console.error(`Error fetching health metrics for plant ID ${numericPlantId}:`, error.message);
    log(`Error fetching health metrics for plant ID ${numericPlantId}: ${error.message}`);
    return next(error);
  }
});


// New endpoint to add a plant by common name
const addPlantRequestBodySchema = z.object({
  commonName: z.string().min(1, { message: 'Common name is required' }),
});

app.post('/api/plants', ClerkExpressRequireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  const validation = addPlantRequestBodySchema.safeParse(req.body);
  if (!validation.success) {
    log('Invalid request body for POST /api/plants: ' + validation.error.errors.map(e => e.message).join(', '));
    return res.status(400).json({ message: 'Invalid request body', errors: validation.error.errors });
  }

  const { commonName } = validation.data;
  const clerkId = (req as RequireAuthProp<Request>).auth.userId;

  if (!clerkId) {
    log('User not authenticated for POST /api/plants');
    return res.status(401).json({ message: 'User not authenticated' });
  }

  let internalUserId: number;
  try {
    const user = await dbInstance.query.users.findFirst({
      where: eq(usersTable.clerkId, clerkId),
      columns: { id: true }
    });
    if (!user) {
      log(`User not found in DB for clerkId: ${clerkId} during POST /api/plants`);
      return res.status(404).json({ message: 'User not found.' });
    }
    internalUserId = user.id;
  } catch (dbError) {
    console.error('Error fetching user from DB in POST /api/plants:', dbError);
    log(`Error fetching user from DB for clerkId ${clerkId} in POST /api/plants: ${dbError}`);
    return next(dbError);
  }

  const apiKey = process.env.PERENUAL_API_KEY;
  if (!apiKey) {
    console.error('PERENUAL_API_KEY is not set in environment variables for POST /api/plants.');
    log('PERENUAL_API_KEY is not set for POST /api/plants.');
    return res.status(500).json({ message: 'API key configuration error.' });
  }

  try {
    log(`POST /api/plants: Fetching species list for: ${commonName} from Perenual API`);
    const speciesListResponse = await axios.request({
      method: 'GET',
      url: 'https://perenual.com/api/v2/species-list',
      params: { key: apiKey, q: commonName }
    });
    log(`POST /api/plants: Successfully fetched species list for: ${commonName}. Status: ${speciesListResponse.status}`);

    if (!speciesListResponse.data || !speciesListResponse.data.data || speciesListResponse.data.data.length === 0) {
      log(`POST /api/plants: No plant found for: ${commonName} in Perenual species list.`);
      return res.status(404).json({ message: `No plant found matching the name '${commonName}'.` });
    }

    const perenualPlantId = speciesListResponse.data.data[0].id;
    if (!perenualPlantId) {
      log(`POST /api/plants: Could not extract plant ID for: ${commonName} from species list response.`);
      return res.status(500).json({ message: 'Failed to retrieve plant ID from Perenual API response.' });
    }

    log(`POST /api/plants: Fetching detailed information for Perenual plant ID: ${perenualPlantId} (name: ${commonName})`);
    const plantDetailsResponse = await axios.request({
      method: 'GET',
      url: `https://perenual.com/api/v2/species/details/${perenualPlantId}`,
      params: { key: apiKey }
    });
    log(`POST /api/plants: Successfully fetched detailed information for Perenual plant ID: ${perenualPlantId}. Status: ${plantDetailsResponse.status}`);
    
    const apiData = plantDetailsResponse.data;

    const plantDataForDb: schema.InsertPlant = {
      userId: internalUserId,
      name: apiData.common_name || commonName,
      perenual_id: apiData.id,
      scientific_name: apiData.scientific_name || [],
      other_name: apiData.other_name || [],
      family: apiData.family || null,
      origin: apiData.origin || [],
      type: apiData.type || null,
      dimensions: apiData.dimensions || {},
      cycle: apiData.cycle || null,
      watering_general_benchmark: apiData.watering_general_benchmark || { value: null, unit: null },
      sunlight: apiData.sunlight || [],
      pruning_month: apiData.pruning_month || [],
      hardiness: apiData.hardiness || { min: null, max: null },
      flowers: apiData.flowers || false,
      flowering_season: apiData.flowering_season || null,
      soil: apiData.soil || [],
      pest_susceptibility: apiData.pest_susceptibility || [],
      cones: apiData.cones || false,
      fruits: apiData.fruits || false,
      edible_fruit: apiData.edible_fruit || false,
      fruiting_season: apiData.fruiting_season || null,
      leaf: apiData.leaf || false,
      edible_leaf: apiData.edible_leaf || false,
      growth_rate: apiData.growth_rate || null,
      maintenance: apiData.maintenance || null,
      medicinal: apiData.medicinal || false,
      poisonous_to_humans: apiData.poisonous_to_humans || false,
      poisonous_to_pets: apiData.poisonous_to_pets || false,
      drought_tolerant: apiData.drought_tolerant || false,
      salt_tolerant: apiData.salt_tolerant || false,
      thorny: apiData.thorny || false,
      invasive: apiData.invasive || false,
      rare: apiData.rare || false,
      tropical: apiData.tropical || false,
      cuisine: apiData.cuisine || false,
      indoor: apiData.indoor || false,
      care_level: apiData.care_level || null,
      description: apiData.description || null,
      api_image_url: apiData.default_image?.regular_url || apiData.default_image?.original_url || null,
      last_api_sync: new Date(),
      acquiredDate: new Date(), // Set for new plant
      status: 'healthy', // Default status
      species: apiData.scientific_name?.[0] || null,
      // User-specific fields are null/default initially
      lastWatered: null,
      waterFrequencyDays: null,
      notes: null,
    };

    // Prepare data for update, excluding conflict targets and acquiredDate (which should not change on conflict)
    const { userId, perenual_id, acquiredDate, ...updateDataPayload } = plantDataForDb;
    // Ensure last_api_sync is always updated, and other fields are taken from plantDataForDb for update
    const finalUpdateData = {
        ...updateDataPayload,
        last_api_sync: new Date() // Always update sync time
    };

    const result = await dbInstance.insert(plantsTable)
      .values(plantDataForDb) // This includes acquiredDate for new inserts
      .onConflictDoUpdate({
        target: [plantsTable.userId, plantsTable.perenual_id],
        set: finalUpdateData, // This set should not include acquiredDate to preserve the original
      })
      .returning();

    log(`POST /api/plants: Upserted plant data to DB for perenual_id: ${apiData.id}, user: ${internalUserId}`);
    
    // After upserting, create or update health metrics
    if (result[0] && result[0].id) {
      try {
        await dbInstance.insert(schema.plantHealthMetrics)
          .values({ plantId: result[0].id, waterLevel: 100, lightLevel: 100, overallHealth: 100 }) // Default health values
          .onConflictDoUpdate({
            target: schema.plantHealthMetrics.plantId,
            set: { waterLevel: 100, lightLevel: 100, overallHealth: 100, updatedAt: new Date() } // Reset/update to default on conflict
          });
        log(`POST /api/plants: Ensured health metrics for plant ID: ${result[0].id}`);
      } catch (healthMetricsError) {
        console.error(`POST /api/plants: Error ensuring health metrics for plant ID ${result[0].id}:`, healthMetricsError);
        log(`POST /api/plants: Error ensuring health metrics for plant ID ${result[0].id}: ${healthMetricsError}`);
        // Do not fail the request for this, but log it.
      }
    }
    res.status(201).json(result[0]); // Return the upserted data from DB

  } catch (error: any) {
    console.error(`POST /api/plants: Error processing request for commonName '${commonName}':`, error.response ? error.response.data : error.message);
    log(`POST /api/plants: Error for ${commonName}: ${error.message}`);
    if (error.response && error.response.status && error.response.data) {
      return res.status(error.response.status).json(error.response.data);
    } else if (error.isAxiosError) { // Check if it's an Axios error for network issues
      return res.status(503).json({ message: 'Service unavailable: Error communicating with Perenual API.' });
    }
    return next(error); // General fallback
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await initializeDatabase();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Only start the server if we're not in a serverless environment
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    const port = process.env.PORT || 5000;
    server.listen({
      port,
      host: "127.0.0.1",
    }, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  }
})();

// Export the Express app for serverless environments
export default app;
