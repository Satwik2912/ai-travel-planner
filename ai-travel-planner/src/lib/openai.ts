import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize with the newer AQ format keys (currently recommended by Google)
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export async function generateTripPlan(
  destination: string,
  days: number,
  budget: number,
  interests: string[],
  travelStyle: string
) {
  const prompt = `You are an expert travel planner. Create a detailed ${days}-day itinerary for ${destination}.
  
  Budget: $${budget}
  Interests: ${interests.join(', ')}
  Travel Style: ${travelStyle}
  
  Generate a JSON response with daily activities, restaurants, and attractions. Each day should have a schedule with times, places, and estimated costs.`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

export { genAI };
