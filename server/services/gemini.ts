import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Initialize the Google AI client with the API key from environment variables
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey!);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

import type { PlantData, EnvironmentData } from "../../shared/schema";

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

/**
 * Generate AI-powered plant care tips based on plant data, weather, season, and plant type.
 */
export async function generateAiCareTips(
  plant: PlantData,
  weather: EnvironmentData, // Using EnvironmentData for weather as it comes from open-meteo
  season: string,
  plantType: string // This could be plant.species or a broader category
): Promise<Array<{ category: string; tip: string }>> {
  try {
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

Format your response as a JSON array of objects, each containing "category" and "tip" fields.
Example:
[
  {"category": "Watering", "tip": "Given the current warm weather and ${plantType}'s needs, check soil moisture every 2 days. Water thoroughly when the top inch is dry."},
  {"category": "Sunlight", "tip": "During this ${season}, ensure your ${plantType} receives at least 6 hours of indirect sunlight. An east-facing window would be ideal."},
  {"category": "Fertilizing", "tip": "With the ${season} growth period, consider a balanced liquid fertilizer every 4 weeks for your ${plantType}." }
]
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch || !jsonMatch[0]) {
      console.error("Could not extract JSON from Gemini AI care tips response:", responseText);
      return [{ category: "General", tip: "Unable to generate specific tips at this moment. Please ensure your plant's basic needs are met." }];
    }

    try {
      const tips = JSON.parse(jsonMatch[0]);
      return tips;
    } catch (parseError) {
      console.error("Error parsing JSON from Gemini AI care tips response:", parseError, responseText);
      return [{ category: "General", tip: "Received complex advice. Please re-check your plant's environment and try again later." }];
    }

  } catch (error) {
    console.error("Error generating AI care tips with Gemini:", error);
    return [{
      category: "Error",
      tip: `Could not generate AI tips for ${plant.name} at this time. Please try again later.`
    }];
  }
}