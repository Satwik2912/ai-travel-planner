import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { 
  validateDestination, 
  getDestinationPlaces,
  getDestinationCoordinates,
} from '@/lib/places-service';
import {
  buildItineraryPrompt,
  validateAndRepairItinerary,
  createFilteredPlaceLists,
  ItineraryRequest,
} from '@/lib/trip-generation-service';
import {
  optimizeFullItinerary,
  validateOptimizedItinerary,
} from '@/lib/optimization-service';
import prisma from '@/lib/prisma';

// Initialize Gemini with AQ format keys (newer standard)
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('GEMINI_API_KEY is not configured');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

const TripRequestSchema = z.object({
  destination: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.number().min(0),
  currency: z.string().default('USD'),
  travelers: z.number().min(1).default(1),
  travelStyle: z.string().optional(),
  transportation: z.string().optional(),
  interests: z.array(z.string()).default([]),
  foodPreferences: z.array(z.string()).default([]),
});

type TripRequest = z.infer<typeof TripRequestSchema>;

function buildDateTime(dateStr: string, timeStr: string): Date {
  const safeTime = /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : '09:00';
  return new Date(`${dateStr}T${safeTime}:00`);
}

export async function POST(request: NextRequest) {
  let tripRequest: TripRequest | null = null;

  try {
    const { userId } = await auth();
    const body = await request.json();
    tripRequest = TripRequestSchema.parse(body);

    // Calculate number of days
    const startDate = new Date(tripRequest.startDate);
    const endDate = new Date(tripRequest.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (days <= 0) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Validate destination using Google Places API
    console.log(`Validating destination: ${tripRequest.destination}`);
    const isValidDestination = await validateDestination(tripRequest.destination);

    if (!isValidDestination) {
      console.warn(
        `Destination validation failed for ${tripRequest.destination}; continuing with best-effort itinerary generation.`
      );
    }

    // Fetch real places from Google Places API
    console.log(`Fetching real places for ${tripRequest.destination}...`);
    const realPlaces = await getDestinationPlaces(tripRequest.destination);
    const destinationCoords = await getDestinationCoordinates(tripRequest.destination);

    // Filter places based on travel style and create request for generation engine
    const travelStyle = (tripRequest.travelStyle || 'balanced') as 'budget' | 'balanced' | 'luxury';
    const transportation = (tripRequest.transportation || 'public') as 'walking' | 'public' | 'car';
    
    const filteredPlaces = createFilteredPlaceLists(
      realPlaces.attractions,
      realPlaces.restaurants,
      realPlaces.activities,
      realPlaces.hotels,
      tripRequest.interests,
      travelStyle
    );

    // Build request for generation engine
    const genRequest: ItineraryRequest = {
      destination: tripRequest.destination,
      days,
      budget: tripRequest.budget,
      currency: tripRequest.currency,
      travelers: tripRequest.travelers,
      travelStyle,
      transportation,
      interests: tripRequest.interests,
      foodPreferences: tripRequest.foodPreferences,
      ...filteredPlaces,
    };

    // Generate improved prompt
    const itineraryPrompt = buildItineraryPrompt(genRequest);

    console.log('Generating itinerary with Gemini...');
    const itineraryResponse = await genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }).generateContent(itineraryPrompt);
    
    const itineraryText = await itineraryResponse.response.text();
    let itinerary: any = {};

    try {
      // Extract JSON from response (sometimes Gemini wraps it in markdown)
      const jsonMatch = itineraryText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        itinerary = JSON.parse(jsonMatch[0]);
      } else {
        itinerary = JSON.parse(itineraryText);
      }
    } catch (e) {
      console.error('Failed to parse itinerary:', e);
      console.error('Response was:', itineraryText.substring(0, 500));
      // Return with fallback message
      itinerary = {
        days: [],
        summary: { totalCost: tripRequest.budget, tips: [] }
      };
    }

    // Validate and repair itinerary
    console.log('Validating and repairing itinerary...');
    const validatedItinerary = validateAndRepairItinerary(itinerary, genRequest, startDate);

    // Optimize the itinerary (Phase 8)
    console.log('Optimizing itinerary for route efficiency and budget...');
    const optimizedDays = optimizeFullItinerary({
      days: validatedItinerary.days,
      allPlaces: {
        attractions: realPlaces.attractions,
        restaurants: realPlaces.restaurants,
        activities: realPlaces.activities,
        hotels: realPlaces.hotels,
      },
      dailyBudget: Math.round(tripRequest.budget / days),
      transportation: genRequest.transportation,
    });

    // Validate optimization results
    console.log('Validating optimized itinerary constraints...');
    const constraintValidation = validateOptimizedItinerary(
      optimizedDays,
      tripRequest.budget,
      days
    );

    let persistedTripId: string | null = null;

    if (userId) {
      const userRecord = await prisma.user.upsert({
        where: { clerkId: userId },
        update: {},
        create: {
          clerkId: userId,
          email: `${userId}@clerk.local`,
          name: 'Traveler',
        },
      });

      const createdTrip = await prisma.trip.create({
        data: {
          userId: userRecord.id,
          destination: tripRequest.destination,
          startDate,
          endDate,
          budget: tripRequest.budget,
          currency: tripRequest.currency,
          travelers: tripRequest.travelers,
          interests: tripRequest.interests,
          foodPreferences: tripRequest.foodPreferences,
          travelStyle: tripRequest.travelStyle,
          transportation: tripRequest.transportation,
          estimatedCost: validatedItinerary.summary.totalCost || tripRequest.budget,
          days: {
            create: optimizedDays.map((day) => ({
              dayNumber: day.day,
              date: new Date(`${day.date}T00:00:00`),
              activities: {
                create: day.activities.map((activity, idx) => {
                  const activityStart = buildDateTime(day.date, activity.time);
                  const activityEnd = new Date(
                    activityStart.getTime() + activity.duration * 60000
                  );

                  return {
                    title: activity.name,
                    description: activity.notes,
                    category: activity.type,
                    startTime: activityStart,
                    endTime: activityEnd,
                    placeName: activity.address,
                    rating: activity.rating,
                    estimatedCost: activity.cost,
                    order: idx,
                  };
                }),
              },
            })),
          },
          budgetBreakdown: {
            create: {
              accommodation: tripRequest.budget * 0.3,
              transportation: tripRequest.budget * 0.1,
              food: tripRequest.budget * 0.25,
              activities: tripRequest.budget * 0.25,
              shopping: tripRequest.budget * 0.05,
              miscellaneous: tripRequest.budget * 0.03,
              emergency: tripRequest.budget * 0.02,
            },
          },
        },
      });

      persistedTripId = createdTrip.id;
    }

    // Return optimized itinerary with real places and validation data
    return NextResponse.json({
      success: true,
      tripId: persistedTripId || Math.random().toString(36).substring(2, 11),
      destination: tripRequest.destination,
      days,
      budget: tripRequest.budget,
      currency: tripRequest.currency,
      coordinates: destinationCoords,
      itinerary: optimizedDays,
      summary: validatedItinerary.summary,
      realPlaces: filteredPlaces,
      optimization: {
        isValid: constraintValidation.isValid,
        budgetStatus: constraintValidation.budgetStatus,
        timeStatus: constraintValidation.timeStatus,
        suggestions: constraintValidation.suggestions,
      },
      message: 'Trip itinerary generated, optimized, and validated successfully!',
    });
  } catch (error) {
    console.error('Error generating trip:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    // Fallback: Return mock data when API fails (useful for testing)
    console.log('Using mock itinerary fallback');
    
    if (!tripRequest) {
      return NextResponse.json(
        { error: 'Failed to parse request' },
        { status: 400 }
      );
    }

    const startDate = new Date(tripRequest.startDate);
    const endDate = new Date(tripRequest.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const mockItinerary = {
      days: [
        {
          day: 1,
          date: tripRequest.startDate,
          activities: [
            { time: '09:00', name: `${tripRequest.destination} Central`, type: 'attraction', duration: 120, cost: 15, address: 'City Center', notes: 'Explore main landmarks' },
            { time: '12:30', name: 'Local Restaurant', type: 'restaurant', duration: 90, cost: 25, address: 'Downtown', notes: 'Lunch' },
            { time: '15:00', name: 'Museum', type: 'attraction', duration: 120, cost: 20, address: 'Cultural District', notes: 'History & art' },
            { time: '18:30', name: 'Dinner Spot', type: 'restaurant', duration: 90, cost: 30, address: 'Entertainment Area', notes: 'Dinner' },
          ],
          dailyBudget: tripRequest.budget / days,
          totalDistance: '15 km',
          totalTravelTime: '3h 30m',
        },
      ],
      summary: {
        totalCost: tripRequest.budget,
        totalDistance: `${15 * days} km`,
        bestTimeToVisit: 'Spring or Fall',
        tips: ['Book accommodations in advance', 'Use public transportation', 'Try local cuisine'],
      },
    };

    return NextResponse.json({
      success: true,
      tripId: Math.random().toString(36).substr(2, 9),
      destination: tripRequest.destination,
      days,
      budget: tripRequest.budget,
      currency: tripRequest.currency,
      itinerary: mockItinerary.days,
      summary: mockItinerary.summary,
      realPlaces: {
        attractions: [],
        restaurants: [],
        activities: [],
        hotels: [],
      },
      message: 'Trip itinerary generated with fallback data. Check API keys and internet connection.',
      fallback: true,
    });
  }
}
