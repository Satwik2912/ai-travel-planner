import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tripId } = await params;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: user.id,
      },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            activities: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const itinerary = trip.days.map((day) => {
      const activities = day.activities.map((activity) => ({
        time: activity.startTime.toISOString().slice(11, 16),
        name: activity.title,
        type: activity.category || 'activity',
        duration: Math.max(
          30,
          Math.round((activity.endTime.getTime() - activity.startTime.getTime()) / 60000)
        ),
        cost: activity.estimatedCost || 0,
        address: activity.placeName || '',
        notes: activity.description || '',
        rating: activity.rating || undefined,
      }));

      const dailyBudget = activities.reduce((sum, act) => sum + act.cost, 0);

      return {
        day: day.dayNumber,
        date: day.date.toISOString().split('T')[0],
        activities,
        dailyBudget,
        totalDistance: '0 km',
        totalTravelTime: '0h 0m',
      };
    });

    return NextResponse.json({
      success: true,
      tripId: trip.id,
      destination: trip.destination,
      days: itinerary.length,
      budget: trip.budget,
      currency: trip.currency,
      travelers: trip.travelers,
      travelStyle: trip.travelStyle,
      transportation: trip.transportation,
      itinerary,
      summary: {
        totalCost: itinerary.reduce((sum, day) => sum + day.dailyBudget, 0),
        totalDistance: '0 km',
        bestTimeToVisit: 'Year-round',
        tips: ['Book popular attractions in advance', 'Keep local transit card handy'],
      },
    });
  } catch (error) {
    console.error('Failed to fetch trip details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trip details' },
      { status: 500 }
    );
  }
}
