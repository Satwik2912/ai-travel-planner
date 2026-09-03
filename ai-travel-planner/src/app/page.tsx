import Link from 'next/link';
import { MapPin, Sparkles, Calendar } from 'lucide-react';
import { SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center px-4">
      {/* Auth Buttons - Top Right */}
      <div className="absolute top-6 right-6 flex gap-4">
        {userId ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <>
            <SignInButton mode="modal">
              <button className="bg-white text-purple-600 px-6 py-2 rounded-lg font-bold hover:bg-gray-100 transition">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition">
                Sign Up
              </button>
            </SignUpButton>
          </>
        )}
      </div>

      <div className="text-center max-w-4xl">
        <div className="mb-8 flex justify-center">
          <div className="bg-white/10 backdrop-blur-md rounded-full p-4">
            <MapPin className="w-16 h-16 text-white" />
          </div>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
          AI Travel Planner
        </h1>

        <p className="text-xl md:text-2xl text-white/90 mb-8">
          Your perfect trip, powered by AI. Tell us your destination and budget,
          and we'll build a complete itinerary with spots to check out, food
          places, and a daily schedule.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
            <MapPin className="w-8 h-8 text-white mb-3 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Smart Destinations
            </h3>
            <p className="text-white/80 text-sm">
              AI recommends perfect activities based on your interests
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
            <Sparkles className="w-8 h-8 text-white mb-3 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Real-time Validation
            </h3>
            <p className="text-white/80 text-sm">
              All places verified with Google Maps data
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
            <Calendar className="w-8 h-8 text-white mb-3 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Optimized Schedule
            </h3>
            <p className="text-white/80 text-sm">
              Smart routing to maximize your time
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/planner"
            className="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition transform hover:scale-105"
          >
            Start Planning
          </Link>
          <Link
            href="/trips"
            className="bg-white/20 text-white px-8 py-4 rounded-lg font-bold text-lg border-2 border-white hover:bg-white/30 transition"
          >
            View My Trips
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 text-white/60 text-sm text-center">
        <p>🚀 Built with Next.js, OpenAI, and Google Maps</p>
      </div>
    </div>
  );
}
