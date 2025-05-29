import * as dotenv from 'dotenv';
import './env'; // Load environment variables first
import path from 'path'; 
import { fileURLToPath } from 'url'; 
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { ClerkExpressRequireAuth, ClerkExpressWithAuth, clerkClient } from '@clerk/clerk-sdk-node';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "./storage";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(ClerkExpressWithAuth());

// Route for fetching plant details from Perenual API
app.get('/api/plant-details/:plantName', ClerkExpressRequireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  const { plantName } = req.params;
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

    const plantDetailsResponse = await axios.request(plantDetailsOptions);
    log(`Successfully fetched detailed information for plant ID: ${plantId}. Status: ${plantDetailsResponse.status}`);
    
    res.json(plantDetailsResponse.data);

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

  const port = 5000;
  server.listen({
    port,
    host: "127.0.0.1",
  }, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
})();
