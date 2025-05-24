import * as dotenv from 'dotenv';
import path from 'path'; 
import { fileURLToPath } from 'url'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');

const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
  console.error(`Error loading .env file from ${envPath}:`, dotenvResult.error);
} else {
  if (dotenvResult.parsed && Object.keys(dotenvResult.parsed).length > 0) {
    console.log(`Successfully loaded .env file from ${envPath}.`);
    console.log('Parsed variable keys by dotenv:', Object.keys(dotenvResult.parsed));
  } else {
    console.log(`.env file found at ${envPath}, but it might be empty, contain only comments, or an unexpected issue occurred during parsing.`);
  }
}

console.log(`[server/index.ts] Value of process.env.DATABASE_URL after dotenv.config: ${process.env.DATABASE_URL}`);

import { ClerkExpressRequireAuth, ClerkExpressWithAuth, clerkClient } from '@clerk/clerk-sdk-node';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "./storage";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(ClerkExpressWithAuth());

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
