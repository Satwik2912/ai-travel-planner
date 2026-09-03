/**
 * Trip Optimization Engine
 * Optimizes itineraries for route efficiency, budget, and time constraints
 */

import { Activity, ItineraryDay } from './trip-generation-service';
import { PlaceSearchResult } from './places-service';

export interface OptimizationRequest {
  days: ItineraryDay[];
  allPlaces: {
    attractions: PlaceSearchResult[];
    restaurants: PlaceSearchResult[];
    activities: PlaceSearchResult[];
    hotels: PlaceSearchResult[];
  };
  dailyBudget: number;
  transportation: string;
  operatingHours?: Record<string, { open: string; close: string }>;
}

/**
 * Calculate distance between two locations (simplified Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * Convert minutes since midnight back to HH:MM format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Calculate travel time between two points based on transportation mode
 */
export function estimateTravelTime(
  distance: number,
  transportation: string
): number {
  const speedMap: Record<string, number> = {
    walking: 5, // km/h
    public: 20, // km/h (average with waiting)
    car: 30, // km/h (average with traffic)
  };

  const speed = speedMap[transportation] || 20;
  return Math.round((distance / speed) * 60); // Convert to minutes
}

/**
 * Check if activity can fit within operating hours
 */
export function canFitWithinHours(
  startTime: number,
  duration: number,
  operatingHours: { open: string; close: string }
): boolean {
  const openMinutes = timeToMinutes(operatingHours.open);
  const closeMinutes = timeToMinutes(operatingHours.close);
  const endTime = startTime + duration;

  return startTime >= openMinutes && endTime <= closeMinutes;
}

/**
 * Optimize activity order within a day using nearest-neighbor algorithm
 */
export function optimizeActivityOrder(
  activities: Activity[],
  placeMap: Map<string, PlaceSearchResult>,
  transportation: string,
  startingPoint?: { lat: number; lng: number }
): Activity[] {
  if (activities.length <= 1) return activities;

  const optimized: Activity[] = [];
  const remaining = [...activities];
  
  // Start with hotel or first activity
  let currentLocation = startingPoint || { lat: 0, lng: 0 };
  
  // Find and add hotel activity first if it exists
  const hotelIdx = remaining.findIndex((a) => a.type === 'hotel');
  if (hotelIdx >= 0) {
    optimized.push(remaining.splice(hotelIdx, 1)[0]);
    const hotelPlace = placeMap.get(remaining[hotelIdx]?.name.toLowerCase());
    if (hotelPlace) {
      currentLocation = { lat: hotelPlace.lat, lng: hotelPlace.lng };
    }
  }

  // Greedy nearest-neighbor for remaining activities
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const place = placeMap.get(remaining[i].name.toLowerCase());
      if (!place) continue;

      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        place.lat,
        place.lng
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestIdx = i;
      }
    }

    const nextActivity = remaining.splice(nearestIdx, 1)[0];
    optimized.push(nextActivity);

    // Update current location
    const nextPlace = placeMap.get(nextActivity.name.toLowerCase());
    if (nextPlace) {
      currentLocation = { lat: nextPlace.lat, lng: nextPlace.lng };
    }
  }

  return optimized;
}

/**
 * Calculate travel times between consecutive activities
 */
export function calculateTravelTimes(
  activities: Activity[],
  placeMap: Map<string, PlaceSearchResult>,
  transportation: string
): Activity[] {
  const updated = [...activities];

  for (let i = 0; i < updated.length - 1; i++) {
    const current = placeMap.get(updated[i].name.toLowerCase());
    const next = placeMap.get(updated[i + 1].name.toLowerCase());

    if (current && next) {
      const distance = calculateDistance(current.lat, current.lng, next.lat, next.lng);
      const travelTime = estimateTravelTime(distance, transportation);

      updated[i + 1].travelTimeFromPrevious = travelTime;
      updated[i + 1].distanceFromPrevious = Math.round(distance * 100) / 100;
    }
  }

  return updated;
}

/**
 * Reschedule activities to fit within available time, accounting for travel time
 */
export function rescheduleActivities(
  activities: Activity[],
  startHour: number = 9,
  endHour: number = 20
): Activity[] {
  const updated = [...activities];
  let currentTime = startHour * 60; // Start at 9 AM
  const dayEndMinutes = endHour * 60; // End at 8 PM

  for (let i = 0; i < updated.length; i++) {
    const activity = updated[i];

    // Add travel time from previous activity (if any)
    if (i > 0 && activity.travelTimeFromPrevious) {
      currentTime += activity.travelTimeFromPrevious;
    }

    // Check if we have enough time
    const activityEndTime = currentTime + activity.duration;
    if (activityEndTime > dayEndMinutes) {
      // Adjust duration to fit
      activity.duration = Math.max(30, dayEndMinutes - currentTime - 15); // Leave 15 min buffer
    }

    // Set activity time
    activity.time = minutesToTime(currentTime);

    // Move to end of this activity
    currentTime = currentTime + activity.duration;
  }

  return updated;
}

/**
 * Validate and adjust budget for activities
 */
export function optimizeBudget(
  activities: Activity[],
  dailyBudget: number,
  placeMap: Map<string, PlaceSearchResult>
): Activity[] {
  let totalCost = 0;
  const updated = [...activities];

  // Calculate current total
  for (const activity of updated) {
    totalCost += activity.cost;
  }

  // If over budget, reduce costs proportionally
  if (totalCost > dailyBudget) {
    const scaleFactor = dailyBudget / totalCost;

    for (const activity of updated) {
      activity.cost = Math.round(activity.cost * scaleFactor);
    }
  }

  // Check for extremely expensive activities and suggest cheaper alternatives
  const maxActivityBudget = dailyBudget * 0.4; // No single activity should exceed 40% of daily budget

  for (let i = 0; i < updated.length; i++) {
    if (updated[i].cost > maxActivityBudget) {
      // Try to find a cheaper alternative of same type
      // This is a placeholder - real implementation would search placeMap
      const costReduction = updated[i].cost - maxActivityBudget;
      updated[i].cost = maxActivityBudget;
      
      // Distribute savings
      if (i < updated.length - 1) {
        updated[i + 1].cost += costReduction / 2;
      }
    }
  }

  return updated;
}

/**
 * Group activities by location proximity
 */
export function groupByProximity(
  activities: Activity[],
  placeMap: Map<string, PlaceSearchResult>,
  proximityThreshold: number = 2.0 // km
): Activity[][] {
  const groups: Activity[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < activities.length; i++) {
    if (used.has(i)) continue;

    const group: Activity[] = [activities[i]];
    used.add(i);

    const currentPlace = placeMap.get(activities[i].name.toLowerCase());
    if (!currentPlace) continue;

    // Find all activities within proximityThreshold km
    for (let j = i + 1; j < activities.length; j++) {
      if (used.has(j)) continue;

      const otherPlace = placeMap.get(activities[j].name.toLowerCase());
      if (!otherPlace) continue;

      const distance = calculateDistance(
        currentPlace.lat,
        currentPlace.lng,
        otherPlace.lat,
        otherPlace.lng
      );

      if (distance <= proximityThreshold) {
        group.push(activities[j]);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Full day optimization pipeline
 */
export function optimizeDayItinerary(
  day: ItineraryDay,
  placeMap: Map<string, PlaceSearchResult>,
  transportation: string,
  dailyBudget: number,
  startPoint?: { lat: number; lng: number }
): ItineraryDay {
  const optimized = { ...day };

  // Step 1: Optimize activity order (nearest-neighbor)
  let activities = optimizeActivityOrder(
    day.activities,
    placeMap,
    transportation,
    startPoint
  );

  // Step 2: Calculate travel times between activities
  activities = calculateTravelTimes(activities, placeMap, transportation);

  // Step 3: Reschedule activities with time constraints
  activities = rescheduleActivities(activities, 9, 20);

  // Step 4: Optimize budget allocation
  activities = optimizeBudget(activities, dailyBudget, placeMap);

  optimized.activities = activities;

  // Recalculate daily totals
  let totalDistance = 0;
  let totalTravelTime = 0;
  let totalCost = 0;

  for (const activity of activities) {
    if (activity.distanceFromPrevious) {
      totalDistance += activity.distanceFromPrevious;
    }
    if (activity.travelTimeFromPrevious) {
      totalTravelTime += activity.travelTimeFromPrevious;
    }
    totalCost += activity.cost;
  }

  optimized.totalDistance = `${totalDistance.toFixed(1)} km`;
  
  const hours = Math.floor(totalTravelTime / 60);
  const mins = totalTravelTime % 60;
  optimized.totalTravelTime = `${hours}h ${mins}m`;
  optimized.dailyBudget = totalCost;

  return optimized;
}

/**
 * Optimize entire trip itinerary
 */
export function optimizeFullItinerary(
  request: OptimizationRequest
): ItineraryDay[] {
  // Create place lookup map for fast access
  const placeMap = new Map<string, PlaceSearchResult>();

  [
    ...request.allPlaces.attractions,
    ...request.allPlaces.restaurants,
    ...request.allPlaces.activities,
    ...request.allPlaces.hotels,
  ].forEach((p) => {
    placeMap.set(p.name.toLowerCase(), p);
  });

  const optimized: ItineraryDay[] = [];
  let previousDayLastLocation: { lat: number; lng: number } | undefined;

  // Optimize each day
  for (const day of request.days) {
    const optimizedDay = optimizeDayItinerary(
      day,
      placeMap,
      request.transportation,
      request.dailyBudget,
      previousDayLastLocation
    );

    optimized.push(optimizedDay);

    // Track last location for next day
    if (optimizedDay.activities.length > 0) {
      const lastActivityName = optimizedDay.activities[
        optimizedDay.activities.length - 1
      ].name.toLowerCase();
      const lastPlace = placeMap.get(lastActivityName);
      if (lastPlace) {
        previousDayLastLocation = { lat: lastPlace.lat, lng: lastPlace.lng };
      }
    }
  }

  return optimized;
}

/**
 * Validate itinerary constraints
 */
export interface ItineraryValidation {
  isValid: boolean;
  budgetStatus: 'within' | 'over';
  timeStatus: 'optimal' | 'tight' | 'impossible';
  issues: string[];
  suggestions: string[];
}

export function validateOptimizedItinerary(
  days: ItineraryDay[],
  totalBudget: number,
  totalDays: number
): ItineraryValidation {
  const issues: string[] = [];
  const suggestions: string[] = [];

  let totalCost = 0;
  let maxDayDuration = 0;

  for (const day of days) {
    // Check daily budget
    if (day.dailyBudget > totalBudget / totalDays * 1.2) {
      // Allow 20% overage per day
      issues.push(`Day ${day.day}: Budget exceeds daily limit by ${Math.round(day.dailyBudget - totalBudget / totalDays)}`);
      suggestions.push(`Consider replacing expensive activities with budget alternatives`);
    }

    totalCost += day.dailyBudget;

    // Check day duration
    let dayDuration = 0;
    for (const activity of day.activities) {
      dayDuration += activity.duration;
      if (activity.travelTimeFromPrevious) {
        dayDuration += activity.travelTimeFromPrevious;
      }
    }

    maxDayDuration = Math.max(maxDayDuration, dayDuration);

    // Day should be between 8-12 hours
    if (dayDuration > 12 * 60) {
      suggestions.push(`Day ${day.day} is quite packed (${Math.round(dayDuration / 60)}h). Consider removing an activity for a more relaxed pace.`);
    }

    if (dayDuration < 4 * 60) {
      suggestions.push(`Day ${day.day} is light. You could add more activities if desired.`);
    }
  }

  const budgetStatus = totalCost <= totalBudget ? 'within' : 'over';
  const timeStatus = maxDayDuration <= 10 * 60 ? 'optimal' : maxDayDuration <= 12 * 60 ? 'tight' : 'impossible';

  if (budgetStatus === 'over') {
    issues.push(`Total trip cost exceeds budget by ${Math.round(totalCost - totalBudget)}`);
    suggestions.push(`Reduce daily activity costs by choosing budget alternatives`);
  }

  return {
    isValid: issues.length === 0,
    budgetStatus,
    timeStatus,
    issues,
    suggestions,
  };
}
