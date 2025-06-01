import Groq from "groq-sdk";
import type { PlantData, EnvironmentData } from "../../shared/schema";

// Helper function to calculate days since a given date
function calculateDaysSince(dateString: string | Date | null | undefined): string {
  if (dateString instanceof Date) {
    // If it's already a Date object, use it directly
    const today = new Date();
    const differenceInTime = today.getTime() - dateString.getTime();
    const differenceInDays = Math.floor(differenceInTime / (1000 * 3600 * 24));
    if (differenceInDays < 0) return 'N/A (future date)';
    if (differenceInDays === 0) return 'today';
    if (differenceInDays === 1) return '1 day ago';
    return `${differenceInDays} days ago`;
  }
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const today = new Date();
  const differenceInTime = today.getTime() - date.getTime();
  const differenceInDays = Math.floor(differenceInTime / (1000 * 3600 * 24));
  if (differenceInDays < 0) return 'N/A (future date)'; // Should not happen for lastWatered
  if (differenceInDays === 0) return 'today';
  if (differenceInDays === 1) return '1 day ago';
  return `${differenceInDays} days ago`;
}

// Initialize the Groq client with the API key from environment variables
const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.error("[aiService.ts] GROQ_API_KEY is not set. AI features will not work. Please add it to your .env file.");
  const errorVal = JSON.stringify({ error: "AI service not configured." });
  console.log('[aiService.ts] GROQ_API_KEY missing, returning:', errorVal);
}

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
const modelName = "llama3-8b-8192"; // Or consider "mixtral-8x7b-32768" for more complex tasks

async function generateGroqCompletion(prompt: string, expectJson: boolean): Promise<any> {
  console.log('[aiService.ts] generateGroqCompletion: Called. Expecting JSON:', expectJson);
  if (!groq) {
    console.error("Groq client not initialized. Skipping AI completion.");
    return expectJson ? { error: "AI service not configured" } : null;
  }
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: modelName,
      temperature: 0.7,
      max_tokens: expectJson ? 2048 : 150, // Allow more tokens for JSON, less for plain text tips
      top_p: 1,
      stop: null,
      stream: false,
    });
    console.log('[aiService.ts] generateGroqCompletion: Groq API call completed. Response:', chatCompletion);

    const content = chatCompletion.choices[0]?.message?.content;
    console.log('[aiService.ts] generateGroqCompletion: Extracted content:', content);

    if (expectJson) {
      try {
        const parsedJson = JSON.parse(content || "{}");
        console.log('[aiService.ts] generateGroqCompletion: Parsed JSON content:', parsedJson);
        return parsedJson;
      } catch (e) {
        console.error("[aiService.ts] generateGroqCompletion: Failed to parse Groq JSON response:", e, "Raw content:", content);
        return { error: "Failed to parse AI response" };
      }
    } else {
      console.log('[aiService.ts] generateGroqCompletion: Returning text content:', content || null);
      return content || null;
    }
  } catch (error) {
    console.error("[aiService.ts] generateGroqCompletion: Error calling Groq API or processing its response:", error);
    return expectJson ? { error: "AI service request failed" } : null;
  }
}

/**
 * Generate plant care recommendations using Groq AI
 */
export async function generatePlantRecommendations(
  plant: PlantData,
  environment: EnvironmentData
): Promise<{ recommendationType: string; message: string }[]> {
  const prompt = `
As a plant care expert AI, please provide specific care recommendations for the following plant based on its current environment:

Plant Information:
- Name: ${plant.name}
- Species: ${plant.species || 'Unknown'}
- Current watering frequency: ${plant.waterFrequencyDays ? `Every ${plant.waterFrequencyDays} days` : 'Unknown'}
- Last watered: ${plant.lastWatered ? new Date(plant.lastWatered).toLocaleDateString() : 'Unknown'}

Current Environment:
- Temperature: ${environment.temperature ? `${environment.temperature}°C` : 'Unknown'}
- Humidity: ${environment.humidity ? `${environment.humidity}%` : 'Unknown'}
- Soil Moisture (0-10cm): ${environment.soil_moisture_0_to_10cm !== null && environment.soil_moisture_0_to_10cm !== undefined ? `${environment.soil_moisture_0_to_10cm} m³/m³` : 'Unknown'}

Please provide 1-2 actionable recommendations for this plant focusing only on watering or light adjustments.
For each recommendation, clearly specify:
1. The type (either "water" or "light")
2. A detailed yet concise recommendation (maximum 2 sentences) that includes:
   - For watering: suggest specific frequency changes (e.g., "every X days")
   - For light: suggest specific placement changes

Format your response as a valid JSON object containing a single key "recommendations" which is an array of objects, each with "recommendationType" and "message" fields.
For example:
{
  "recommendations": [
    {"recommendationType": "water", "message": "Your plant needs less frequent watering. Consider watering once every 9 days instead of weekly."},
    {"recommendationType": "light", "message": "Move your plant to an east-facing window to provide more indirect sunlight throughout the day."}
  ]
}
`;

  const responseText = await generateGroqCompletion(prompt, true);

  if (!responseText) {
    return [
      {
        recommendationType: "water",
        message: `Could not generate AI recommendations for ${plant.name}. Monitor soil moisture and adjust as needed.`,
      },
    ];
  }

  try {
    const parsedResponse = JSON.parse(responseText);
    // Check if the response has the expected structure
    if (parsedResponse && Array.isArray(parsedResponse.recommendations)) {
        return parsedResponse.recommendations;
    }
    console.error("Unexpected JSON structure from Groq recommendations:", parsedResponse);
    return [];
  } catch (error) {
    console.error("Error parsing JSON from Groq recommendations:", error, responseText);
    // Fallback if JSON parsing fails or structure is wrong
    return [
      {
        recommendationType: "water",
        message: `Received complex advice for ${plant.name}. Please re-check your plant's environment and try again later.`,
      },
    ];
  }
}

/**
 * Generate AI-powered plant care tips using Groq AI
 */
export async function generateAiCareTips(
  plant: PlantData,
  weather: EnvironmentData, // Using EnvironmentData for weather as it comes from open-meteo
  season: string,
  taskType: string // e.g., "Watering", "Pruning", "Fertilizing"
  // plantType: string, // This was from the old signature, can be removed or re-evaluated if needed
): Promise<string | null> {
  const daysSinceLastWatered = calculateDaysSince(plant.lastWatered);

  const prompt = `
You are a smart plant care assistant.

Based on the following input, generate a short, friendly reminder to the user about plant care. Include the plant name, the task, and 1 useful tip. The tone should be warm and helpful.

Input:
Plant: ${plant.name}
Task: ${taskType}
Last Watered: ${daysSinceLastWatered} (on ${plant.lastWatered ? new Date(plant.lastWatered).toLocaleDateString() : 'N/A'})
Temperature: ${weather.temperature !== null && weather.temperature !== undefined ? `${weather.temperature}°C` : 'Not available'}
Humidity: ${weather.humidity !== null && weather.humidity !== undefined ? `${weather.humidity}%` : 'Not available'}
Season: ${season}

Output:
(The AI should generate the friendly reminder string here, similar to: 🌱 Hey there! Your ${plant.name} is ready for a drink today 🌞 It’s been ${daysSinceLastWatered} since the last watering and ${season.toLowerCase()} weather is here. Tip: Water deeply but infrequently – and avoid letting water sit in the center of the plant.)
`;

  const responseText = await generateGroqCompletion(prompt, false); // Expect plain text output

  if (!responseText) {
    return `Could not generate an AI tip for your ${plant.name} regarding ${taskType.toLowerCase()} at this moment. Please check its needs manually.`;
  }

  // The responseText is the direct friendly reminder string
  const cleanedTip = responseText.trim().replace(/^"|"$/g, '');
    console.log('[aiService.ts] generateGeneralDashboardTip: Returning cleaned tip:', cleanedTip);
    return cleanedTip;
}

/**
 * Generate a general AI-powered plant care tip for the dashboard using Groq AI
 */
export async function generateGeneralDashboardTip(
  weather: EnvironmentData, // Using EnvironmentData for weather as it comes from open-meteo
  season: string
): Promise<string | null> {
  console.log('[aiService.ts] generateGeneralDashboardTip: Called with weather:', weather, 'season:', season);
  const prompt = `As a friendly plant care assistant, generate **only** one short, encouraging, and actionable general plant care tip (1-2 sentences) suitable for a dashboard. The tip should be applicable to a diverse collection of common household plants, not specific to any single plant. **Do not include any extra explanations, notes, or parenthetical text outside of the tip itself. Output only the tip text.** Current conditions: Temperature is ${weather.temperature}°C, Humidity is ${weather.humidity}%, Season is ${season}.`;
  console.log('[aiService.ts] generateGeneralDashboardTip: Generated prompt:', prompt);

  try {
    const responseText = await generateGroqCompletion(prompt, false); // false for plain text
    console.log('[aiService.ts] generateGeneralDashboardTip: Received from generateGroqCompletion:', responseText);
    if (!responseText || typeof responseText !== 'string') { // Added check for string type
      const fallbackMsg = `Could not generate a general AI tip at this moment. Remember to check your plants' needs based on the current ${season.toLowerCase()} conditions!`;
      console.log('[aiService.ts] generateGeneralDashboardTip: responseText is invalid or empty, returning fallback:', fallbackMsg);
      return fallbackMsg;
    }
    const trimmedTip = responseText.trim();
    console.log('[aiService.ts] generateGeneralDashboardTip: Returning trimmed tip:', trimmedTip);
    return trimmedTip;
  } catch (error) {
    console.error("[aiService.ts] generateGeneralDashboardTip: Error during/after generateGroqCompletion:", error);
    const errorMsg = `Failed to generate AI tip due to an internal error. Basic tip: Ensure your plants get appropriate light for the ${season.toLowerCase()}!`;
    console.log('[aiService.ts] generateGeneralDashboardTip: Caught error, returning error message:', errorMsg);
    return errorMsg;
  }
}
