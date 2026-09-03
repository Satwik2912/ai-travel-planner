export interface TripPlace {
  placeId: string;
  name: string;
  category: string;
  rating: number;
  priceLevel: string;
  openingHours: string[];
  latitude: number;
  longitude: number;
}

export interface Activity {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  place?: TripPlace;
  estimatedCost: number;
  category: string;
}

export interface TripDay {
  dayNumber: number;
  date: Date;
  activities: Activity[];
  estimatedCost: number;
}

export interface Trip {
  id: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  days: TripDay[];
  budget: number;
  estimatedCost: number;
  currency: string;
  travelers: number;
  interests: string[];
  foodPreferences: string[];
  travelStyle: string;
}

export interface BudgetBreakdown {
  accommodation: number;
  transportation: number;
  food: number;
  activities: number;
  shopping: number;
  miscellaneous: number;
  emergency: number;
}
