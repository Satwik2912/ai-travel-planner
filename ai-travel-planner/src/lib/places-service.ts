/**
 * Google Places API Service
 * Handles place searching, validation, and detail retrieval
 */

const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const GOOGLE_SERVER_KEY = process.env.GOOGLE_MAPS_SERVER_KEY;

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  rating: number;
  reviewCount: number;
  types: string[];
  lat: number;
  lng: number;
  photoUrl?: string;
}

export interface PlaceDetail extends PlaceSearchResult {
  hours?: string[];
  phone?: string;
  website?: string;
  priceLevel?: number;
  description: string;
}

/**
 * Search for places in a destination
 */
export async function searchPlaces(
  destination: string,
  searchType: 'attraction' | 'restaurant' | 'hotel' | 'activity',
  limit = 5
): Promise<PlaceSearchResult[]> {
  try {
    // First, get the destination coordinates
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      destination
    )}&key=${GOOGLE_SERVER_KEY}`;

    const geoResponse = await fetch(geocodingUrl);
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      console.error(`Destination not found: ${destination}`);
      return [];
    }

    const { lat, lng } = geoData.results[0].geometry.location;

    // Map search types to Google Places types
    const typeMap: Record<string, string> = {
      attraction: 'tourist_attraction|museum|park|monument',
      restaurant: 'restaurant|cafe|bar',
      hotel: 'lodging',
      activity: 'recreation_center|amusement_park|art_gallery',
    };

    const googleType = typeMap[searchType] || searchType;

    // Search for places near the destination
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=${googleType}&key=${GOOGLE_SERVER_KEY}`;

    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();

    if (!placesData.results) {
      console.error('No places found');
      return [];
    }

    // Transform results
    const results: PlaceSearchResult[] = placesData.results.slice(0, limit).map((place: any) => {
      let photoUrl = '';
      if (place.photos && place.photos.length > 0) {
        photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_SERVER_KEY}`;
      }

      return {
        placeId: place.place_id,
        name: place.name,
        address: place.vicinity || '',
        rating: place.rating || 0,
        reviewCount: place.user_ratings_total || 0,
        types: place.types || [],
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        photoUrl,
      };
    });

    return results;
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
}

/**
 * Get detailed information about a place
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetail | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,rating,user_ratings_total,opening_hours,formatted_phone_number,website,price_level,types,photos,geometry&key=${GOOGLE_SERVER_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.result) {
      return null;
    }

    const place = data.result;
    let photoUrl = '';
    if (place.photos && place.photos.length > 0) {
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_SERVER_KEY}`;
    }

    return {
      placeId,
      name: place.name,
      address: place.formatted_address || '',
      rating: place.rating || 0,
      reviewCount: place.user_ratings_total || 0,
      types: place.types || [],
      lat: place.geometry?.location.lat || 0,
      lng: place.geometry?.location.lng || 0,
      photoUrl,
      hours: place.opening_hours?.weekday_text || [],
      phone: place.formatted_phone_number,
      website: place.website,
      priceLevel: place.price_level,
      description: `${place.name} - ${place.formatted_address || ''}`,
    };
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
}

/**
 * Validate that a destination exists
 */
export async function validateDestination(destination: string): Promise<boolean> {
  try {
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      destination
    )}&key=${GOOGLE_SERVER_KEY}`;

    const response = await fetch(geocodingUrl);
    const data = await response.json();

    return data.results && data.results.length > 0;
  } catch (error) {
    console.error('Error validating destination:', error);
    return false;
  }
}

/**
 * Get destination coordinates
 */
export async function getDestinationCoordinates(destination: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      destination
    )}&key=${GOOGLE_SERVER_KEY}`;

    const response = await fetch(geocodingUrl);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  } catch (error) {
    console.error('Error getting destination coordinates:', error);
    return null;
  }
}

/**
 * Search for specific place types in a destination
 * Useful for generating comprehensive itineraries
 */
export async function getDestinationPlaces(destination: string): Promise<{
  attractions: PlaceSearchResult[];
  restaurants: PlaceSearchResult[];
  hotels: PlaceSearchResult[];
  activities: PlaceSearchResult[];
}> {
  const [attractions, restaurants, hotels, activities] = await Promise.all([
    searchPlaces(destination, 'attraction', 8),
    searchPlaces(destination, 'restaurant', 8),
    searchPlaces(destination, 'hotel', 5),
    searchPlaces(destination, 'activity', 8),
  ]);

  return {
    attractions,
    restaurants,
    hotels,
    activities,
  };
}
