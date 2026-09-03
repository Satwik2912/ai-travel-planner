/**
 * Trip Generation Engine
 * Orchestrates the creation of detailed, constraint-aware itineraries
 */

import { PlaceSearchResult } from './places-service';

export interface ItineraryRequest {
  destination: string;
  days: number;
  budget: number;
  currency: string;
  travelers: number;
  travelStyle: 'budget' | 'balanced' | 'luxury';
  transportation: 'walking' | 'public' | 'car';
  interests: string[];
  foodPreferences: string[];
  attractions: PlaceSearchResult[];
  restaurants: PlaceSearchResult[];
  activities: PlaceSearchResult[];
  hotels: PlaceSearchResult[];
}

export interface GeneratedItinerary {
  days: ItineraryDay[];
  summary: ItinerarySummary;
}

export interface ItineraryDay {
  day: number;
  date: string;
  activities: Activity[];
  dailyBudget: number;
  totalDistance: string;
  totalTravelTime: string;
}

export interface Activity {
  time: string;
  name: string;
  type: 'attraction' | 'restaurant' | 'activity' | 'hotel';
  duration: number;
  cost: number;
  address: string;
  notes: string;
  rating?: number;
  travelTimeFromPrevious?: number;
  distanceFromPrevious?: number;
}

export interface ItinerarySummary {
  totalCost: number;
  totalDistance: string;
  bestTimeToVisit: string;
  tips: string[];
}

/**
 * Estimate cost based on place type and travel style
 */
export function estimateCost(
  placeType: string,
  travelStyle: string
): number {
  const baseCosts: Record<string, number> = {
    attraction: { budget: 10, balanced: 15, luxury: 25 }[travelStyle] || 15,
    restaurant: { budget: 12, balanced: 20, luxury: 40 }[travelStyle] || 20,
    activity: { budget: 15, balanced: 25, luxury: 50 }[travelStyle] || 25,
    hotel: { budget: 40, balanced: 80, luxury: 150 }[travelStyle] || 80,
  };

  return baseCosts[placeType] || 20;
}

/**
 * Filter places based on user interests
 */
export function filterPlacesByInterests(
  places: PlaceSearchResult[],
  interests: string[]
): PlaceSearchResult[] {
  if (!interests || interests.length === 0) {
    return places.slice(0, 5); // Return top 5 if no interests specified
  }

  // Filter places with high ratings (4.5+) first
  return places
    .filter((p) => p.rating >= 4.0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 8);
}

/**
 * Generate time slots for the day
 */
export function generateTimeSlots(day: number): string[] {
  return [
    '09:00', // Morning
    '12:30', // Lunch
    '15:00', // Afternoon
    '18:30', // Dinner
  ];
}

/**
 * Build itinerary prompt for Gemini
 */
export function buildItineraryPrompt(request: ItineraryRequest): string {
  const timeSlots = generateTimeSlots(1);
  const placesContext = `
AVAILABLE ATTRACTIONS (${request.attractions.length} found):
${request.attractions
  .slice(0, 8)
  .map(
    (p) =>
      `- ${p.name} (Rating: ${p.rating}/5, Address: ${p.address})`
  )
  .join('\n')}

AVAILABLE RESTAURANTS (${request.restaurants.length} found):
${request.restaurants
  .slice(0, 6)
  .map(
    (p) =>
      `- ${p.name} (Rating: ${p.rating}/5, Address: ${p.address})`
  )
  .join('\n')}

AVAILABLE ACTIVITIES (${request.activities.length} found):
${request.activities
  .slice(0, 6)
  .map(
    (p) =>
      `- ${p.name} (Rating: ${p.rating}/5, Address: ${p.address})`
  )
  .join('\n')}

AVAILABLE HOTELS (${request.hotels.length} found):
${request.hotels
  .slice(0, 4)
  .map(
    (p) =>
      `- ${p.name} (Rating: ${p.rating}/5, Address: ${p.address})`
  )
  .join('\n')}`;

  const prompt = `You are an expert travel planner. Create a detailed, realistic ${request.days}-day itinerary for ${request.destination}.

TRIP DETAILS:
- Destination: ${request.destination}
- Duration: ${request.days} days
- Total Budget: ${request.currency} ${request.budget}
- Daily Budget: ${request.currency} ${Math.round(request.budget / request.days)}
- Travelers: ${request.travelers}
- Travel Style: ${request.travelStyle}
- Transportation: ${request.transportation}
- Interests: ${request.interests.join(', ') || 'general'}
- Food Preferences: ${request.foodPreferences.join(', ') || 'any'}

${placesContext}

CRITICAL REQUIREMENTS:
1. Use ONLY the places listed above - do NOT invent places
2. Match exact place names as they appear in the list
3. Realistic travel times between locations (5-20 minutes by ${request.transportation})
4. Each day should have 4-5 activities (morning, lunch, afternoon, dinner)
5. Stay within daily budget of ${request.currency} ${Math.round(request.budget / request.days)}
6. Include a mix of attractions, restaurants, and activities
7. Realistic activity durations (60-120 minutes each)
8. Start day at 9:00 AM, end by 8:00 PM

COST GUIDELINES:
- Budget travel style: attractions $10-15, restaurants $12-20, activities $15-25
- Balanced style: attractions $15-25, restaurants $20-35, activities $25-40
- Luxury style: attractions $25-50, restaurants $40-70, activities $50-100

For each activity, MUST provide:
- time: exact HH:MM format (09:00, 12:30, etc.)
- name: EXACT place name from the lists above
- type: 'attraction', 'restaurant', 'activity', or 'hotel'
- duration: in minutes (typically 60-120)
- cost: estimated cost in ${request.currency}
- address: location from list
- notes: brief description

Generate a JSON response with this exact structure:
{
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "time": "HH:MM",
          "name": "exact place name from lists",
          "type": "attraction|restaurant|activity|hotel",
          "duration": 90,
          "cost": 20,
          "address": "address from list",
          "notes": "Why this activity fits"
        }
      ],
      "dailyBudget": 200,
      "totalDistance": "8.5 km",
      "totalTravelTime": "2h 15m"
    }
  ],
  "summary": {
    "totalCost": ${request.budget},
    "totalDistance": "50 km",
    "bestTimeToVisit": "Spring and Fall",
    "tips": [
      "Book attractions in advance during peak season",
      "Use public transportation to save costs",
      "Try local markets for authentic dining experiences",
      "Wear comfortable walking shoes"
    ]
  }
}

RETURN ONLY VALID JSON - no markdown, no explanations, no extra text.`;

  return prompt;
}

/**
 * Validate and repair parsed itinerary
 */
export function validateAndRepairItinerary(
  data: any,
  request: ItineraryRequest,
  startDate: Date
): GeneratedItinerary {
  const itinerary: GeneratedItinerary = {
    days: [],
    summary: {
      totalCost: request.budget,
      totalDistance: 'To be calculated',
      bestTimeToVisit: 'Year-round',
      tips: [
        'Book in advance',
        'Use public transportation',
        'Try local cuisine',
      ],
    },
  };

  if (!data.days || !Array.isArray(data.days)) {
    return itinerary;
  }

  let totalTripCost = 0;
  let totalTripDistance = 0;

  // All available places for validation
  const allPlaces = new Map<string, PlaceSearchResult>();
  [
    ...request.attractions,
    ...request.restaurants,
    ...request.activities,
    ...request.hotels,
  ].forEach((p) => {
    allPlaces.set(p.name.toLowerCase(), p);
  });

  for (let dayIdx = 0; dayIdx < data.days.length && dayIdx < request.days; dayIdx++) {
    const dayData = data.days[dayIdx];
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + dayIdx);

    const day: ItineraryDay = {
      day: dayIdx + 1,
      date: currentDate.toISOString().split('T')[0],
      activities: [],
      dailyBudget: Math.round(request.budget / request.days),
      totalDistance: '0 km',
      totalTravelTime: '0h',
    };

    if (dayData.activities && Array.isArray(dayData.activities)) {
      let dayTotalCost = 0;
      let dayTotalDistance = 0;

      for (const act of dayData.activities) {
        if (!act.name || !act.time) continue;

        // Find matching place
        const matchedPlace = allPlaces.get(act.name.toLowerCase());
        const cost = act.cost || estimateCost(act.type, request.travelStyle);

        const activity: Activity = {
          time: act.time || '09:00',
          name: act.name,
          type: act.type || 'attraction',
          duration: act.duration || 60,
          cost: cost,
          address: matchedPlace?.address || act.address || 'Location',
          notes: act.notes || '',
          rating: matchedPlace?.rating,
          travelTimeFromPrevious: act.travelTimeFromPrevious || undefined,
          distanceFromPrevious: act.distanceFromPrevious || undefined,
        };

        day.activities.push(activity);
        dayTotalCost += cost;
        dayTotalDistance += act.distanceFromPrevious || 0;
      }

      day.totalDistance = `${dayTotalDistance.toFixed(1)} km`;
      day.totalTravelTime = `${Math.round(dayTotalDistance / 5)}m`; // Rough estimate

      totalTripCost += dayTotalCost;
      totalTripDistance += dayTotalDistance;

      itinerary.days.push(day);
    }
  }

  if (data.summary) {
    itinerary.summary = {
      totalCost: Math.min(totalTripCost, request.budget),
      totalDistance: `${totalTripDistance.toFixed(1)} km`,
      bestTimeToVisit: data.summary.bestTimeToVisit || 'Year-round',
      tips: data.summary.tips || [],
    };
  }

  return itinerary;
}

/**
 * Create filtered place lists based on interests and travel style
 */
export function createFilteredPlaceLists(
  allAttractions: PlaceSearchResult[],
  allRestaurants: PlaceSearchResult[],
  allActivities: PlaceSearchResult[],
  allHotels: PlaceSearchResult[],
  interests: string[],
  travelStyle: string
): {
  attractions: PlaceSearchResult[];
  restaurants: PlaceSearchResult[];
  activities: PlaceSearchResult[];
  hotels: PlaceSearchResult[];
} {
  // Filter by rating based on travel style
  const minRating = { budget: 4.0, balanced: 4.2, luxury: 4.5 }[travelStyle] || 4.0;

  return {
    attractions: allAttractions
      .filter((p) => p.rating >= minRating)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8),
    restaurants: allRestaurants
      .filter((p) => p.rating >= minRating)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 6),
    activities: allActivities
      .filter((p) => p.rating >= minRating)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 6),
    hotels: allHotels
      .filter((p) => p.rating >= minRating)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 4),
  };
}
