import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertPlantSchema, 
  insertEnvironmentReadingSchema, 
  insertCareHistorySchema,
  insertRecommendationSchema,
  insertPlantHealthMetricsSchema,
  InsertPlant,
  PlantData, // Now imported from shared schema
  EnvironmentData // Now imported from shared schema
} from "@shared/schema";
import { ZodError } from "zod";
import { clerkClient, ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { generatePlantRecommendations, generateAiCareTips, generateGeneralDashboardTip } from "./services/aiService"; // GeminiPlantData and EnvironmentData are now imported from shared/schema
import fetch from 'node-fetch'; // Or your preferred HTTP client
import { insertPlantCareTaskSchema } from '@shared/schema';

// Interface for the expected OpenMeteo API response structure
interface OpenMeteoCurrentData {
  temperature_2m: number | null;
  relative_humidity_2m: number | null;
  precipitation: number | null;
  weather_code: number | null;
  wind_speed_10m: number | null;
}

interface OpenMeteoApiResponse {
  current?: OpenMeteoCurrentData;
  // Add other top-level fields like 'daily' if needed elsewhere
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_units?: { // Make current_units optional as it might not always be present
    time: string;
    interval: string;
    temperature_2m: string;
    relative_humidity_2m: string;
    precipitation: string;
    weather_code: string;
  };
}

// Helper function to determine season
function getSeason(date: Date): string {
  const month = date.getMonth(); // 0 (Jan) to 11 (Dec)
  if (month >= 2 && month <= 4) return "Spring"; // Mar, Apr, May
  if (month >= 5 && month <= 7) return "Summer"; // Jun, Jul, Aug
  if (month >= 8 && month <= 10) return "Autumn"; // Sep, Oct, Nov
  return "Winter"; // Dec, Jan, Feb
}

import historyRouter from "./routes/history";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register plant activity history API endpoint
  app.use("/api/history", historyRouter);
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
  const handleError = (res: any, error: any, contextualErrorMessage?: string) => {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: contextualErrorMessage || 'Something went wrong', 
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

  // GET a specific plant by ID
  app.get('/api/plants/:id', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated' });
      }
      const clerkUserId = req.auth.userId;

      const plantId = req.params.id;
      if (!plantId) {
        return res.status(400).json({ error: 'Invalid plant ID format.' });
      }

      const plant = await storage.getPlantById(plantId);

      if (!plant) {
        return res.status(404).json({ error: 'Plant not found.' });
      }

      // Verify the plant belongs to the authenticated user
      // First, get the internal user ID from Clerk ID
      const user = await storage.getUserByClerkId(clerkUserId);
      if (!user) {
        // This should ideally not happen if ClerkExpressRequireAuth is working
        // and the user exists in our DB from a previous sync/login.
        return res.status(404).json({ error: 'Authenticated user not found in local database.' });
      }

      if (plant.userId !== user.id) {
        // Plant found, but does not belong to this user
        return res.status(403).json({ error: 'Forbidden', details: 'You do not have permission to access this plant.' });
      }

      return res.json(plant);
    } catch (error) {
      return handleError(res, error, `[GET /api/plants/:id - Plant ID: ${req.params.id}]`);
    }
  });

  // New route for AI-powered plant care tips
  app.post('/api/plants/:id/ai-care-tips', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated' });
      }

      const plantId = req.params.id;
      if (!plantId) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      const plant = await storage.getPlantById(plantId);
      if (!plant) {
        return res.status(404).json({ error: 'Plant not found' });
      }

      // Fetch current weather data (reusing the existing weather endpoint logic for simplicity)
      // In a real app, you might get location from user profile or plant's location settings
      const defaultLatitude = 21.37; // Nandurbar, India (example)
      const defaultLongitude = 74.25;
      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${defaultLatitude}&longitude=${defaultLongitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=auto`);
      if (!weatherResponse.ok) {
        console.error(`Error fetching weather data for AI tips: ${weatherResponse.statusText}`);
        // Proceed with default/empty weather data or return an error
        // For now, let's send a specific error if weather fails, as it's crucial for the tips
        return res.status(503).json({ error: 'Failed to fetch weather data for care tips.' });
      }
      const weatherData = await weatherResponse.json() as OpenMeteoApiResponse;
      const currentWeatherData: EnvironmentData = {
        temperature: weatherData.current?.temperature_2m ?? null,
        humidity: weatherData.current?.relative_humidity_2m ?? null,
        lightLevel: null, // TODO: Map weatherData.current?.weather_code to a textual description
        // precipitation: weatherData.current?.precipitation, // Removed as not in EnvironmentData
      };

      const currentDate = new Date();
      const season = getSeason(currentDate);
      const plantType = plant.species || plant.name; // Use species if available, otherwise name

      const plantForAi: PlantData = {
        name: plant.name,
        species: plant.species,
        waterFrequencyDays: plant.waterFrequencyDays,
        // TODO: Confirm if plant object from storage.getPlantById() consistently includes lightRequirement.
        lastWatered: plant.lastWatered,
      };
      const aiTipString = await generateAiCareTips(plantForAi, currentWeatherData, season, "General Plant Care");

      // Save the generated tips to the database
      const clerkUserId = req.auth.userId; // Clerk ID is a string
      const user = await storage.getUserByClerkId(clerkUserId);

      if (!user) {
        // This case should ideally be rare if ClerkExpressRequireAuth is working
        // and user exists in our DB, but good to handle.
        return res.status(404).json({ error: 'User not found in local database.' });
      }

      let tipsToSaveAndReturn = [];
      if (aiTipString && typeof aiTipString === 'string') {
        tipsToSaveAndReturn.push({ category: "AI Reminder", tip: aiTipString });
        // Assuming storage.saveAiCareTips expects an array of objects with category and tip
        await storage.saveAiCareTips(plantId, user.id.toString(), tipsToSaveAndReturn);
      } else {
        // Handle the case where aiTipString is null or not a string (e.g., AI generation failed)
        // We can return an empty array or a specific message.
        // For now, let's log and return an empty array to maintain structure if client expects array.
        console.warn(`[AI Care Tips Route - Plant ID: ${req.params.id}] AI tip string was not generated, skipping save.`);
      }

      return res.json(tipsToSaveAndReturn);

    } catch (error) {
      return handleError(res, error, `[AI Care Tips Route - Plant ID: ${req.params.id}]`);
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

  // Weather route
  app.get('/api/weather', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      // TODO: Get latitude and longitude from user's profile or request
      // Default location set to Nandurbar, India
      const latitude = 21.37;
      const longitude = 74.25;

      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,soil_moisture_0_to_10cm&hourly=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max&timezone=auto`);
      if (!weatherResponse.ok) {
        throw new Error(`Error fetching weather data: ${weatherResponse.statusText}`);
      }
      const weatherData = await weatherResponse.json();
      return res.json(weatherData);
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

      const plants = await storage.getPlantsByUserId(appUser.id.toString());
      return res.json(plants);
    } catch (error) {
      return handleError(res, error);
    }
  });

  app.get('/api/plants/:id', async (req, res) => {
    try {
      const plantId = req.params.id;
      if (!plantId) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      const plant = await storage.getPlantById(plantId);
      if (!plant) {
        return res.status(404).json({ error: 'Plant not found' });
      }

      // Fetch recommendations for the plant
      const recommendations = await storage.getRecommendationsByPlantId(plantId);
      
      // Combine plant details with recommendations
      const plantWithRecommendations = {
        ...plant,
        recommendations: recommendations || [] // Ensure recommendations is an array
      };

      return res.json(plantWithRecommendations);
    } catch (error) {
      return handleError(res, error);
    }
  });

  // New route for plant recommendations
  app.post('/api/plants/:id/recommendations', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated' });
      }
      const clerkId = req.auth.userId;

      const plantId = req.params.id;
      if (!plantId) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      const plant = await storage.getPlantById(plantId);
      if (!plant) {
        return res.status(404).json({ error: 'Plant not found' });
      }

      // Ensure the plant belongs to the authenticated user
      // We need to get the appUser first to compare plant.userId
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

      if (plant.userId !== appUser.id) {
        return res.status(403).json({ error: 'Forbidden', details: 'Plant does not belong to the authenticated user.' });
      }

      // Fetch latest environment data for the user
      // This might not have soil_moisture_0_to_10cm, which generatePlantRecommendations uses.
      // We'll pass what we have. The AI service might need to handle missing data gracefully.
      const latestEnvReading = await storage.getLatestEnvironmentReadingByUserId(appUser.id.toString());

      const environmentForAi: EnvironmentData = {
        temperature: latestEnvReading?.temperature ?? null,
        humidity: latestEnvReading?.humidity ?? null,
        lightLevel: latestEnvReading?.lightLevel ?? null, // This is a string from user input, AI expects qualitative
        soil_moisture_0_to_10cm: latestEnvReading?.soil_moisture_0_to_10cm ?? null, // Corrected property name
        // Ensure all fields expected by EnvironmentData are covered, even if null
      };

      const plantForAi: PlantData = {
        name: plant.name,
        species: plant.species,
        waterFrequencyDays: plant.waterFrequencyDays,
        lastWatered: plant.lastWatered ? new Date(plant.lastWatered) : null,
        // lightRequirement: plant.lightRequirement, // Include if part of your PlantData and available
        // location: plant.location, // Include if available
        // notes: plant.notes, // Include if available
      };

      const recommendations = await generatePlantRecommendations(plantForAi, environmentForAi);
      
      // Optionally, save these recommendations to the database
      // For now, just returning them to the client
      if (recommendations && recommendations.length > 0) {
        // Example: Storing each recommendation
        // for (const rec of recommendations) {
        //   await storage.addRecommendation({
        //     plantId: plant.id,
        //     userId: appUser.id, // Ensure userId is appUser.id
        //     recommendationType: rec.recommendationType,
        //     message: rec.message,
        //     status: 'pending', // Or 'active'
        //     source: 'AI_Groq',
        //   });
        // }
      }

      return res.json(recommendations);
    } catch (error) {
      return handleError(res, error, `[Recommendations Route - Plant ID: ${req.params.id}]`);
    }
  });

  // New route for general AI-generated plant tip
  app.get('/api/ai-general-tip', ClerkExpressRequireAuth(), async (req, res) => {
    console.log('[routes.ts] /api/ai-general-tip: Route handler started.');
    try {
      if (!req.auth || !req.auth.userId) {
        console.error('[routes.ts] /api/ai-general-tip: Unauthorized - User not authenticated.');
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for GET /api/ai-general-tip' });
      }
      console.log('[routes.ts] /api/ai-general-tip: User authenticated with Clerk ID:', req.auth.userId);

      const weatherResponse = await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto');
      if (!weatherResponse.ok) {
        console.error('[routes.ts] /api/ai-general-tip: Failed to fetch weather data. Status:', weatherResponse.status);
        return res.status(503).json({ error: 'Failed to fetch weather data for AI tip.' });
      }
      const weatherData = await weatherResponse.json() as OpenMeteoApiResponse;
      const currentWeatherData: EnvironmentData = {
        temperature: weatherData.current?.temperature_2m ?? null,
        humidity: weatherData.current?.relative_humidity_2m ?? null,
        lightLevel: null, // EnvironmentData requires lightLevel; OpenMeteo current data doesn't provide it
        soil_moisture_0_to_10cm: null, // Optional in EnvironmentData, keeping as null
      };
      const season = getSeason(new Date()); 
      console.log('[routes.ts] /api/ai-general-tip: Fetched weather and season. Weather:', currentWeatherData, 'Season:', season);

      console.log('[routes.ts] /api/ai-general-tip: Calling generateGeneralDashboardTip with weather:', currentWeatherData, 'season:', season);
      const tip = await generateGeneralDashboardTip(currentWeatherData, season);
      console.log('[routes.ts] /api/ai-general-tip: Received tip from service:', tip);

      if (tip) {
        console.log('[routes.ts] /api/ai-general-tip: Successfully generated tip. Sending JSON response:', { tip });
        return res.json({ tip });
      } else {
        console.log('[routes.ts] /api/ai-general-tip: Tip generation failed or returned empty. Sending 503 JSON response.');
        return res.status(503).json({ error: 'Could not generate an AI tip at this moment.' });
      }
    } catch (error) {
      console.error('[routes.ts] /api/ai-general-tip: Error caught in route handler:', error);
      return handleError(res, error, 'Failed to generate general AI tip');
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
        email: clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || '',
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
        api_image_url: validatedBody.imageUrl,   // string | undefined from Zod schema, mapped to api_image_url
        acquiredDate: validatedBody.acquiredDate,  // Date | undefined from Zod schema
        status: validatedBody.status,            // string | undefined from Zod schema
        // lastWatered is Date | undefined from Zod schema, default to new Date() if undefined
        lastWatered: validatedBody.lastWatered === undefined ? new Date() : validatedBody.lastWatered,
      };
      console.log(`[routes.ts] POST /api/plants - Plant data for DB (plantDataForDb): ${JSON.stringify(plantDataForDb)}`);

      console.log(`[routes.ts] POST /api/plants - About to call storage.createPlant. Storage type: ${storage.constructor.name}`);
      const plant = await storage.createPlant(plantDataForDb);
      console.log(`[routes.ts] POST /api/plants - Plant object received from storage.createPlant: ${JSON.stringify(plant)}`);

      // Create initial care tasks and recommendations for the new plant
      if (plant && plant.id) {
        try {
          // Create watering task
          const wateringDueDate = new Date();
          wateringDueDate.setDate(wateringDueDate.getDate() + 7); // Due in 7 days
          await storage.createPlantCareTask({
            plantId: plant.id.toString(),
            type: 'watering',
            dueDate: wateringDueDate,
            status: 'pending'
          });

          // Create fertilizing task
          const fertilizingDueDate = new Date();
          fertilizingDueDate.setDate(fertilizingDueDate.getDate() + 30); // Due in 30 days
          await storage.createPlantCareTask({
            plantId: plant.id.toString(),
            type: 'fertilizing',
            dueDate: fertilizingDueDate,
            status: 'pending'
          });

          // Create pruning task
          const pruningDueDate = new Date();
          pruningDueDate.setDate(pruningDueDate.getDate() + 90); // Due in 90 days
          await storage.createPlantCareTask({
            plantId: plant.id.toString(),
            type: 'pruning',
            dueDate: pruningDueDate,
            status: 'pending'
          });

          console.log(`[routes.ts] POST /api/plants - Successfully created initial care tasks for plant ID: ${plant.id}`);

          // Generate and store recommendations
          const environmentForNewPlant: EnvironmentData = {
            temperature: 22, // Example default, consider fetching or allowing user input
            humidity: 50,    // Example default
            lightLevel: "medium" // Example default
          };
          const plantForAi: PlantData = {
            name: plant.name,
            species: plant.species,
            waterFrequencyDays: plant.waterFrequencyDays,
            lastWatered: plant.lastWatered,
          };

          const recommendations = await generatePlantRecommendations(plantForAi, environmentForNewPlant);
          if (recommendations && recommendations.length > 0 && appUser && appUser.id) {
            for (const rec of recommendations) {
              await storage.createRecommendation({
                userId: appUser.id,
                plantId: plant.id,
                recommendationType: rec.recommendationType,
                message: rec.message,
              });
            }
            console.log(`[routes.ts] POST /api/plants - Successfully generated and stored ${recommendations.length} recommendations for plant ID: ${plant.id}`);
          } else {
            console.log(`[routes.ts] POST /api/plants - No recommendations generated or appUser.id missing for plant ID: ${plant.id}`);
          }
        } catch (error) {
          console.error(`[routes.ts] POST /api/plants - Error creating initial tasks/recommendations for plant ID: ${plant.id}:`, error);
          // Don't fail the request if task/recommendation creation fails, but log it
        }
      }
      
      return res.status(201).json(plant);
    } catch (error) {
      console.error('[routes.ts] POST /api/plants - Error creating plant:', error); // Ensure this logs the error object
      return handleError(res, error);
    }
  });

  app.put('/api/plants/:id', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      const plantId = req.params.id;
      if (!plantId) {
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
      const plantId = req.params.id;
      if (!plantId) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      // Attempt to delete the plant
      // The storage.deletePlant method will throw an error if the plant is not found
      // or if another database error occurs.
      await storage.deletePlant(plantId);

      // If deletePlant completes without error, the plant was successfully deleted.
      // Return 204 No Content.
      return res.status(204).send();

    } catch (error: any) {
      // Log the error for server-side debugging
      console.error(`[API] Error in DELETE /api/plants/${req.params.id}:`, error);

      // Check if the error message indicates 'not found' (this might need adjustment
      // based on how storage.deletePlant signals a 'not found' error specifically,
      // if it differentiates it from other errors).
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: 'Plant not found' });
      }
      
      // For all other errors, use the generic error handler
      return handleError(res, error);
    }
  });

  app.get('/api/plants/:id/health', ClerkExpressRequireAuth(), async (req: any, res) => {
    try {
      const plantId = req.params.id;
      if (!plantId) {
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
      return handleError(res, error, 'Failed to get health metrics for plant ' + req.params.id);
    }
  });

  // GET route to fetch saved AI care tips
  app.get('/api/plants/:id/ai-care-tips', ClerkExpressRequireAuth(), async (req, res) => {
    console.log('[routes.ts] GET /api/plants/' + req.params.id + '/ai-care-tips - Route handler started.');
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'User not authenticated for GET /api/plants/:id/ai-care-tips' });
      }
      const plantId = req.params.id;
      if (!plantId) {
        return res.status(400).json({ error: 'Valid plant ID is required' });
      }

      const clerkUserId = req.auth.userId;
      const appUser = await storage.getUserByClerkId(clerkUserId);
      if (!appUser || !appUser.id) {
        return res.status(404).json({ error: 'User not found in local database.' });
      }

      const savedTips = await storage.getAiCareTips(plantId, appUser.id.toString()); 
      console.log('[routes.ts] GET /api/plants/' + plantId + '/ai-care-tips - Fetched tips:', savedTips);
      return res.json(savedTips);
    } catch (error) {
      console.error('[routes.ts] GET /api/plants/' + req.params.id + '/ai-care-tips - Error:', error);
      return handleError(res, error, 'Failed to get AI care tips for plant ' + req.params.id);
    }
  });

  // Basic login route (non-Clerk, for potential direct auth testing or legacy)
  app.post('/api/auth/login', async (req, res) => {
    console.log('[routes.ts] POST /api/auth/login - Route handler started.');
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      const user = await storage.getUserByUsername(username); 
      if (!user || user.password !== password) { 
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      console.log('[routes.ts] POST /api/auth/login - User authenticated:', user.username);
      return res.json({ 
        id: user.id, 
        username: user.username,
        name: user.name,
        email: user.email
      });
    } catch (error) {
      console.error('[routes.ts] POST /api/auth/login - Error:', error);
      return handleError(res, error, 'Login failed');
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

      const readings = await storage.getLatestEnvironmentReadingByUserId(appUser.id.toString());
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
      const { data, error } = validateBody(insertEnvironmentReadingSchema, { ...req.body, userId: appUser.id.toString() });
      if (error) {
        return res.status(400).json({ error: 'Invalid environment data', details: error });
      }

      const reading = await storage.createEnvironmentReading(data); // data now includes the correct appUser.id
      
      // Generate recommendations based on the new reading, using the correct appUser.id
      await storage.generateRecommendations(appUser.id.toString());
      
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

      const plantCareTasks = await storage.getPlantCareTasksByUserId(appUser.id.toString());
      return res.json(plantCareTasks);
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
      const { data, error } = validateBody(insertPlantCareTaskSchema, { ...req.body, userId: appUser.id.toString() });
      if (error) {
        return res.status(400).json({ error: 'Invalid care task data', details: error });
      }

      const plantCareTask = await storage.createPlantCareTask(data); // data now includes the correct appUser.id
      return res.status(201).json(plantCareTask);
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

      const taskId = req.params.id;
      if (!taskId) {
        return res.status(400).json({ error: 'Valid task ID is required' });
      }

      // TODO: Add authorization check: ensure task belongs to authenticated user

      const completedTask = await storage.completePlantCareTask(taskId.toString());
      if (!completedTask) {
        return res.status(404).json({ error: 'Care task not found' });
      }

      // If it's a watering task, update the plant's last watered date
      if (completedTask.type === 'water') {
        const plant = await storage.getPlantById(completedTask.plantId);
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

          await storage.updatePlant(plant.id.toString(), updatePayload);
          
          // Add to care history
          await storage.createCareHistory({
            plantId: plant.id,
            actionType: 'watered',
            notes: 'Completed watering task'
          });
          
          // Update plant health metrics
          await storage.updatePlantHealthMetrics(plant.id.toString());
        }
      }

      return res.json(completedTask);
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

      const taskId = req.params.id;
      if (!taskId) {
        return res.status(400).json({ error: 'Valid task ID is required' });
      }

      // TODO: Add authorization check: ensure task belongs to authenticated user

      const skippedTask = await storage.skipPlantCareTask(taskId.toString());
      if (!skippedTask) {
        return res.status(404).json({ error: 'Care task not found' });
      }

      return res.json(skippedTask);
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

      const recommendations = await storage.getRecommendationsByUserId(appUser.id.toString());
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
      await storage.generateRecommendations(appUser.id.toString());
      const recommendations = await storage.getRecommendationsByUserId(appUser.id.toString());
      
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
      const recId = req.params.id;
      if (!recId) {
        return res.status(400).json({ error: 'Valid recommendation ID is required' });
      }

      const recommendation = await storage.applyRecommendation(recId.toString());
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
      const plantId = req.params.id;
      if (!plantId) {
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

      const stats = await storage.getDashboardStats(appUser.id.toString());
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
      const plantId = req.params.plantId;
      if (!plantId) {
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
