/**
 * Google Routes API Service
 * Handles route calculations, distances, and travel times
 */

const GOOGLE_SERVER_KEY = process.env.GOOGLE_MAPS_SERVER_KEY;

export interface RouteInfo {
  distance: number; // in km
  duration: number; // in minutes
  startAddress: string;
  endAddress: string;
  polyline?: string;
}

export interface RoutesResponse {
  routes: RouteInfo[];
  startAddress: string;
  endAddress: string;
}

/**
 * Calculate route between two coordinates
 * Returns distance and travel time
 */
export async function calculateRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  travelMode: 'DRIVE' | 'TRANSIT' | 'WALK' = 'DRIVE'
): Promise<RouteInfo | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&mode=${travelMode.toLowerCase()}&key=${GOOGLE_SERVER_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.error('No route found');
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Convert meters to km and seconds to minutes
    const distanceKm = leg.distance.value / 1000;
    const durationMinutes = Math.round(leg.duration.value / 60);

    return {
      distance: parseFloat(distanceKm.toFixed(2)),
      duration: durationMinutes,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      polyline: route.overview_polyline.points,
    };
  } catch (error) {
    console.error('Error calculating route:', error);
    return null;
  }
}

/**
 * Calculate distances between multiple places
 * Useful for route optimization
 */
export async function calculateDistanceBetweenPlaces(
  places: Array<{ lat: number; lng: number; name: string }>
): Promise<Map<string, RouteInfo>> {
  const results = new Map<string, RouteInfo>();

  try {
    // Calculate distances between consecutive places
    for (let i = 0; i < places.length - 1; i++) {
      const start = places[i];
      const end = places[i + 1];
      const key = `${start.name}-${end.name}`;

      const route = await calculateRoute(start.lat, start.lng, end.lat, end.lng);
      if (route) {
        results.set(key, route);
      }
    }
  } catch (error) {
    console.error('Error calculating distances:', error);
  }

  return results;
}

/**
 * Estimate travel time between two coordinates
 * Quick estimation without full route details
 */
export async function estimateTravelTime(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<number> {
  try {
    const route = await calculateRoute(startLat, startLng, endLat, endLng);
    return route ? route.duration : 0;
  } catch (error) {
    console.error('Error estimating travel time:', error);
    return 0;
  }
}

/**
 * Format travel time to human-readable string
 */
export function formatTravelTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Calculate total travel distance between multiple waypoints
 */
export async function calculateTotalDistance(
  coordinates: Array<{ lat: number; lng: number }>
): Promise<number> {
  let totalDistance = 0;

  try {
    for (let i = 0; i < coordinates.length - 1; i++) {
      const route = await calculateRoute(
        coordinates[i].lat,
        coordinates[i].lng,
        coordinates[i + 1].lat,
        coordinates[i + 1].lng
      );
      if (route) {
        totalDistance += route.distance;
      }
    }
  } catch (error) {
    console.error('Error calculating total distance:', error);
  }

  return parseFloat(totalDistance.toFixed(2));
}
