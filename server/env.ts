import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine the correct __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Construct the path to the .env file in the project root
const envPath = path.resolve(__dirname, '../.env');

const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
  console.error(`[env.ts] Error loading .env file from ${envPath}:`, dotenvResult.error);
} else {
  if (dotenvResult.parsed && Object.keys(dotenvResult.parsed).length > 0) {
    console.log(`[env.ts] Successfully loaded .env file from ${envPath}.`);
    // To see which keys were loaded, uncomment the next line during debugging:
    // console.log('[env.ts] Parsed variable keys by dotenv:', Object.keys(dotenvResult.parsed));
  } else {
    console.warn(`[env.ts] .env file found at ${envPath}, but it might be empty or no variables were parsed.`);
  }
}
