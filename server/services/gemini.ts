import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Initialize the Google AI client with the API key from environment variables
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey!);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export interface PlantData {
  name: string;
  species: string | null;
  waterFrequencyDays: number | null;
  lightRequirement: string | null;
  lastWatered: Date | null;
}

export interface EnvironmentData {
  temperature: number | null;
  humidity: number | null;
  lightLevel: string | null;
}

/**
 * Generate plant care recommendations using Google's Gemini AI
 */
export async function generatePlantRecommendations(
  plant: PlantData, 
  environment: EnvironmentData
): Promise<{ recommendationType: string; message: string }[]> {
  try {
    // Create a detailed prompt for the AI to generate meaningful recommendations
    const prompt = `
As a plant care expert AI, please provide specific care recommendations for the following plant based on its current environment:

Plant Information:
- Name: ${plant.name}
- Species: ${plant.species || 'Unknown'}
- Current watering frequency: ${plant.waterFrequencyDays ? `Every ${plant.waterFrequencyDays} days` : 'Unknown'}
- Light requirement: ${plant.lightRequirement || 'Unknown'}
- Last watered: ${plant.lastWatered ? new Date(plant.lastWatered).toLocaleDateString() : 'Unknown'}

Current Environment:
- Temperature: ${environment.temperature ? `${environment.temperature}°C` : 'Unknown'}
- Humidity: ${environment.humidity ? `${environment.humidity}%` : 'Unknown'}
- Light level: ${environment.lightLevel || 'Unknown'}

Please provide 1-2 actionable recommendations for this plant focusing only on watering or light adjustments.
For each recommendation, clearly specify:
1. The type (either "water" or "light")
2. A detailed yet concise recommendation (maximum 2 sentences) that includes:
   - For watering: suggest specific frequency changes (e.g., "every X days")
   - For light: suggest specific placement changes

Format your response as a JSON array with objects containing "recommendationType" and "message" fields only.
For example:
[
  {"recommendationType": "water", "message": "Your plant needs less frequent watering. Consider watering once every 9 days instead of weekly."},
  {"recommendationType": "light", "message": "Move your plant to an east-facing window to provide more indirect sunlight throughout the day."}
]
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract the JSON array from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Could not extract JSON from Gemini response:", responseText);
      return [];
    }
    
    const recommendations = JSON.parse(jsonMatch[0]);
    return recommendations;
  } catch (error) {
    console.error("Error generating recommendations with Gemini:", error);
    // Return a default recommendation in case of an error
    return [{
      recommendationType: "water",
      message: `Your ${plant.name} might benefit from an adjusted watering schedule based on current conditions. Monitor soil moisture levels and adjust as needed.`
    }];
  }
}