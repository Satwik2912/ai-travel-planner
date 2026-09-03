'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MapPin, Clock, DollarSign, Navigation, Heart, Share2, AlertCircle, Loader2 } from 'lucide-react';
import ChatWidget from '@/components/ChatWidget';

export const dynamic = 'force-dynamic';

function TripResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tripData, setTripData] = useState<any>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [currentItinerary, setCurrentItinerary] = useState<any[]>([]);

  useEffect(() => {
    const fetchTripData = async () => {
      try {
        setLoading(true);

        const tripId = searchParams.get('tripId');

        if (tripId) {
          const storedResponse = await fetch(`/api/trips/${tripId}`);
          if (!storedResponse.ok) {
            const errorData = await storedResponse.json();
            throw new Error(errorData.error || 'Failed to load saved trip');
          }

          const storedTripData = await storedResponse.json();
          setTripData(storedTripData);
          setCurrentItinerary(storedTripData.itinerary || []);
          setIsFallback(false);
          return;
        }

        // Get form data from URL params or use defaults
        const destination = searchParams.get('destination') || 'Tokyo';
        const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
        const endDate =
          searchParams.get('endDate') ||
          new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
        const budget = parseFloat(searchParams.get('budget') || '1000');
        const travelers = parseInt(searchParams.get('travelers') || '1');
        const currency = searchParams.get('currency') || 'USD';
        const interests = searchParams.get('interests')?.split(',') || [];
        const foodPreferences = searchParams.get('foodPreferences')?.split(',') || [];
        const travelStyle = searchParams.get('travelStyle') || 'balanced';
        const transportation = searchParams.get('transportation') || 'public';

        // Call the API to generate trip
        const response = await fetch('/api/generate-trip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination,
            startDate,
            endDate,
            budget,
            travelers,
            currency,
            interests,
            foodPreferences,
            travelStyle,
            transportation,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate trip');
        }

        const data = await response.json();
        setTripData(data);
        setCurrentItinerary(data.itinerary || []);
        setIsFallback(data.fallback || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchTripData();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-800 font-semibold">Loading your trip...</p>
          <p className="text-gray-600 text-sm mt-2">This may take a moment while we search for places...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <div className="flex gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-red-800 text-lg">Error Generating Trip</h2>
                <p className="text-red-700 mt-2">{error}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/planner')}
              className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition"
            >
              ← Back to Planner
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!tripData) {
    return null;
  }

  const itinerary = currentItinerary.length > 0 ? currentItinerary : tripData.itinerary || [];
  const summary = tripData.summary || {};

  const budgetBreakdown = {
    accommodation: tripData.budget * 0.3,
    food: tripData.budget * 0.25,
    activities: tripData.budget * 0.25,
    transport: tripData.budget * 0.1,
    shopping: tripData.budget * 0.05,
    emergency: tripData.budget * 0.05,
  };

  const totalSpent = Object.values(budgetBreakdown).reduce((a: number, b: number) => a + b, 0);
  const remaining = tripData.budget - totalSpent;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Fallback Warning */}
        {isFallback && (
          <div className="mb-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-800 font-semibold">Using Sample Data</p>
              <p className="text-yellow-700 text-sm">Google Places API is unavailable. Showing sample itinerary.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">🌍 {tripData.destination} Trip</h1>
              <div className="flex gap-6 text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>{tripData.days} Days</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  <span>
                    {tripData.currency} {tripData.budget}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition">
                <Heart className="w-5 h-5" />
                Save Trip
              </button>
              <button className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
                <Share2 className="w-5 h-5" />
                Share
              </button>
            </div>
          </div>
        </div>

        {itinerary.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-600 text-lg">No activities scheduled for this trip yet.</p>
            <button
              onClick={() => router.push('/planner')}
              className="mt-6 bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition"
            >
              ← Back to Planner
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content - Itinerary */}
            <div className="lg:col-span-2 space-y-6">
              {itinerary.map((day: any, dayIdx: number) => (
                <div key={dayIdx} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  {/* Day Header */}
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4">
                    <h2 className="text-2xl font-bold">
                      Day {day.day} -{' '}
                      {new Date(day.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </h2>
                    <div className="flex gap-4 text-sm mt-2">
                      {day.totalDistance && <span>📍 {day.totalDistance}</span>}
                      {day.totalTravelTime && <span>⏱️ {day.totalTravelTime}</span>}
                      <span>
                        💰 {tripData.currency} {day.dailyBudget?.toFixed(2) || '0'}
                      </span>
                    </div>
                  </div>

                  {/* Activities */}
                  <div className="p-4 space-y-4">
                    {day.activities && day.activities.length > 0 ? (
                      day.activities.map((activity: any, idx: number) => (
                        <div key={idx}>
                          {/* Travel time from previous activity */}
                          {activity.travelTimeFromPrevious && idx > 0 && (
                            <div className="bg-blue-50 border-l-4 border-blue-500 px-3 py-2 mb-3 text-xs text-blue-700">
                              <div className="font-semibold">Travel from previous location</div>
                              <div>{activity.travelTimeFromPrevious} min • {activity.distanceFromPrevious} km</div>
                            </div>
                          )}

                          {/* Activity card */}
                          <div className="flex gap-4 pb-4 border-b last:border-b-0">
                            <div className="w-20 text-center">
                              <div className="text-lg font-bold text-purple-600">{activity.time}</div>
                              {activity.duration && (
                                <div className="text-xs text-gray-500">{activity.duration} min</div>
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-800 text-lg">{activity.name}</h3>
                              {activity.address && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{activity.address}</span>
                                </div>
                              )}
                              {activity.notes && (
                                <p className="text-sm text-gray-600 mt-1 italic">{activity.notes}</p>
                              )}
                              <div className="flex gap-3 mt-2 flex-wrap">
                                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                  {activity.type}
                                </span>
                                {activity.cost > 0 && (
                                  <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                    {tripData.currency} {activity.cost}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">No activities scheduled</p>
                    )}
                  </div>
                </div>
              ))}

              {itinerary.length < tripData.days && (
                <div className="bg-white rounded-lg shadow-lg p-6 text-center text-gray-600">
                  <p>Days {itinerary.length + 1}-{tripData.days} will follow similar structure</p>
                </div>
              )}
            </div>

            {/* Sidebar - Budget & Info */}
            <div className="space-y-6">
              {/* Budget Breakdown */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Budget Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(budgetBreakdown).map(([category, amount]: [string, any]) => (
                    <div key={category} className="flex justify-between items-center">
                      <span className="text-gray-600 capitalize">{category}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${Math.min((amount / tripData.budget) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-gray-800 w-14 text-right">
                          {tripData.currency} {Math.round(amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-800">Total Estimated</span>
                      <span className="font-bold text-lg text-gray-800">
                        {tripData.currency} {Math.round(totalSpent)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">Remaining</span>
                      <span className={`font-bold text-lg ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tripData.currency} {Math.round(remaining)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Placeholder */}
              <div className="bg-white rounded-lg shadow-lg p-6 h-64 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                <div className="text-center">
                  <Navigation className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Interactive Map</p>
                  <p className="text-xs text-gray-500">Google Maps integration coming soon</p>
                </div>
              </div>

              {/* Optimization Insights */}
              {tripData.optimization && (
                <div className={`rounded-lg shadow-lg p-6 ${tripData.optimization.isValid ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'}`}>
                  <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${tripData.optimization.isValid ? 'text-green-800' : 'text-yellow-800'}`}>
                    <span>✨ Optimization Status</span>
                  </h3>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className={tripData.optimization.isValid ? 'text-green-800' : 'text-yellow-800'}>Budget Status</span>
                      <span className={`font-semibold px-2 py-1 rounded text-white ${tripData.optimization.budgetStatus === 'within' ? 'bg-green-600' : 'bg-red-600'}`}>
                        {tripData.optimization.budgetStatus === 'within' ? '✓ Within Budget' : '✗ Over Budget'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className={tripData.optimization.isValid ? 'text-green-800' : 'text-yellow-800'}>Pacing</span>
                      <span className={`font-semibold px-2 py-1 rounded text-white ${tripData.optimization.timeStatus === 'optimal' ? 'bg-green-600' : tripData.optimization.timeStatus === 'tight' ? 'bg-yellow-600' : 'bg-red-600'}`}>
                        {tripData.optimization.timeStatus === 'optimal' ? '✓ Optimal' : tripData.optimization.timeStatus === 'tight' ? '⚠ Tight' : '✗ Impossible'}
                      </span>
                    </div>
                  </div>

                  {tripData.optimization.suggestions && tripData.optimization.suggestions.length > 0 && (
                    <div className={`text-xs border-t ${tripData.optimization.isValid ? 'border-green-200' : 'border-yellow-200'} pt-3 mt-3`}>
                      <p className={`font-semibold mb-2 ${tripData.optimization.isValid ? 'text-green-800' : 'text-yellow-800'}`}>Suggestions:</p>
                      <ul className={tripData.optimization.isValid ? 'text-green-700' : 'text-yellow-700'}>
                        {tripData.optimization.suggestions.slice(0, 3).map((suggestion: string, idx: number) => (
                          <li key={idx} className="mb-1">• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Trip Stats */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Trip Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-bold">{tripData.days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily Budget</span>
                    <span className="font-bold">
                      {tripData.currency} {Math.round(tripData.budget / tripData.days)}
                    </span>
                  </div>
                  {summary.totalDistance && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Distance</span>
                      <span className="font-bold">{summary.totalDistance}</span>
                    </div>
                  )}
                  {summary.totalTravelTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Travel Time</span>
                      <span className="font-bold">{summary.totalTravelTime}</span>
                    </div>
                  )}
                  {summary.bestTimeToVisit && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-sm text-gray-600 font-semibold mb-2">Best Time to Visit:</p>
                      <p className="text-xs text-gray-600">{summary.bestTimeToVisit}</p>
                    </div>
                  )}
                  {summary.tips && summary.tips.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-sm text-gray-600 font-semibold mb-2">Tips:</p>
                      {summary.tips.slice(0, 3).map((tip: string, idx: number) => (
                        <p key={idx} className="text-xs text-gray-600 mb-1">
                          • {tip}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="bg-white text-purple-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition"
          >
            ↻ Regenerate
          </button>
          <button
            onClick={() => router.push('/planner')}
            className="bg-white text-purple-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition"
          >
            ← New Trip
          </button>
          <button
            onClick={() => router.push('/trips')}
            className="bg-white text-purple-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition"
          >
            📋 All Trips
          </button>
        </div>

        {/* Chat Widget */}
        {tripData && (
          <ChatWidget
            itinerary={itinerary}
            context={{
              destination: tripData.destination,
              days: itinerary,
              budget: tripData.budget,
              currency: tripData.currency,
              travelers: tripData.travelers || 1,
              travelStyle: tripData.travelStyle || 'balanced',
              transportation: tripData.transportation || 'public',
            }}
            onItineraryUpdate={(newItinerary) => {
              setCurrentItinerary(newItinerary);
              // Update trip data with new itinerary
              setTripData((prev: any) => ({
                ...prev,
                itinerary: newItinerary,
              }));
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function TripResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 text-center">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-800 font-semibold">Loading trip results...</p>
          </div>
        </div>
      }
    >
      <TripResultsContent />
    </Suspense>
  );
}
