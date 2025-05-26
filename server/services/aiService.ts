import Groq from "groq-sdk";
import type { PlantData, EnvironmentData } from "../../shared/schema";

// Initialize the Groq client with the API key from environment variables
const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.warn(
    "GROQ_API_KEY is not set. AI features will not work. Please add it to your .env file."
  );
}

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
const modelName = "llama3-8b-8192"; // Or consider "mixtral-8x7b-32768" for more complex tasks

async function generateGroqCompletion(
  prompt: string,
  isJsonOutput: boolean = true
): Promise<string | null> {
  if (!groq) {
    console.error("Groq client not initialized. Skipping AI completion.");
    return null;
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
      temperature: 0.7, // Adjust for creativity vs. determinism
      max_tokens: 1024,  // Adjust based on expected output length
      top_p: 1,
      stream: false,
      ...(isJsonOutput ? { response_format: { type: "json_object" } } : {}),
    });
    return chatCompletion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error(`Error generating completion with Groq (${modelName}):`, error);
    return null;
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
  plantType: string // This could be plant.species or a broader category
): Promise<Array<{ category: string; tip: string }>> {
  const prompt = `
As an expert AI botanist, provide comprehensive and actionable plant care tips for the following plant, considering its specific type, the current weather conditions, and the season. Focus on practical advice the user can implement immediately.

Plant Information:
- Name: ${plant.name}
- Species/Type: ${plantType}
- Current watering frequency: ${plant.waterFrequencyDays ? `Every ${plant.waterFrequencyDays} days` : 'Unknown'}
- Last watered: ${plant.lastWatered ? new Date(plant.lastWatered).toLocaleDateString() : 'Unknown'}

Weather Conditions:
- Temperature: ${weather.temperature !== null && weather.temperature !== undefined ? `${weather.temperature}°C` : 'Not available'}
- Humidity: ${weather.humidity !== null && weather.humidity !== undefined ? `${weather.humidity}%` : 'Not available'}
- Soil Moisture (0-10cm): ${weather.soil_moisture_0_to_10cm !== null && weather.soil_moisture_0_to_10cm !== undefined ? `${weather.soil_moisture_0_to_10cm} m³/m³` : 'Not available'}

Season: ${season}

Please provide 2-3 detailed care tips. For each tip, specify:
1. A category (e.g., "Watering", "Sunlight", "Fertilizing", "Pest Control", "Temperature/Humidity Adjustment", "Seasonal Care")
2. A concise, actionable tip (2-3 sentences maximum).

Format your response as a valid JSON object containing a single key "tips" which is an array of objects, each with "category" and "tip" fields.
Example:
{
  "tips": [
    {"category": "Watering", "tip": "Given the current warm weather and ${plantType}'s needs, check soil moisture every 2 days. Water thoroughly when the top inch is dry."},
    {"category": "Sunlight", "tip": "During this ${season}, ensure your ${plantType} receives at least 6 hours of indirect sunlight. An east-facing window would be ideal."},
    {"category": "Fertilizing", "tip": "With the ${season} growth period, consider a balanced liquid fertilizer every 4 weeks for your ${plantType}." }
  ]
}
`;

  const responseText = await generateGroqCompletion(prompt, true);

  if (!responseText) {
    return [
      {
        category: "General",
        tip: "Unable to generate specific AI tips at this moment. Please ensure your plant's basic needs are met.",
      },
    ];
  }

  try {
    const parsedResponse = JSON.parse(responseText);
     // Check if the response has the expected structure
    if (parsedResponse && Array.isArray(parsedResponse.tips)) {
        return parsedResponse.tips;
    }
    console.error("Unexpected JSON structure from Groq AI care tips:", parsedResponse);
    return [{ category: "General", tip: "Received malformed advice. Please try again later." }];
  } catch (parseError) {
    console.error("Error parsing JSON from Groq AI care tips response:", parseError, responseText);
    return [
      {
        category: "General",
        tip: "Received complex advice. Please re-check your plant's environment and try again later.",
      },
    ];
  }
}
