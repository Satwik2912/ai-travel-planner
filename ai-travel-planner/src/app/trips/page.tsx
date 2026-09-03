'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, DollarSign, Heart } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';

type TripListItem = {
  id: string;
  destination: string;
  days: number;
  budget: number;
  currency: string;
  startDate: string;
};

export default function TripsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    const fetchTrips = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/trips');
        if (!response.ok) {
          throw new Error('Failed to fetch trips');
        }

        const data = await response.json();
        setTrips(data.trips || []);
      } catch (error) {
        console.error('Error loading trips:', error);
        setTrips([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-12 text-center text-gray-700 font-semibold">
            Loading your trips...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-white" />
            <h1 className="text-3xl font-bold text-white">My Trips</h1>
          </div>
          <Link
            href="/planner"
            className="bg-white text-purple-600 px-6 py-2 rounded-lg font-bold hover:bg-gray-100 transition"
          >
            + New Trip
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              No trips yet
            </h2>
            <p className="text-gray-600 mb-6">
              Start planning your first trip with AI!
            </p>
            <Link
              href="/planner"
              className="inline-block bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700 transition"
            >
              Create Your First Trip
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition transform hover:scale-105"
              >
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-32 flex items-center justify-center text-5xl">
                  ✈️
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    {trip.destination}
                  </h3>

                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{trip.days} days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      <span>
                        {trip.currency} {trip.budget}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/trips/results?tripId=${trip.id}`}
                      className="flex-1 bg-purple-600 text-white py-2 rounded font-bold text-center hover:bg-purple-700 transition"
                    >
                      View
                    </Link>
                    <button className="flex-1 bg-gray-200 text-gray-800 py-2 rounded font-bold hover:bg-gray-300 transition flex items-center justify-center">
                      <Heart className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
