import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ trips: [] });
    }

    const trips = await prisma.trip.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        days: {
          select: { dayNumber: true, date: true },
          orderBy: { dayNumber: 'asc' },
        },
      },
    });

    const payload = trips.map((trip) => ({
      id: trip.id,
      destination: trip.destination,
      days: trip.days.length,
      budget: trip.budget,
      currency: trip.currency,
      startDate: trip.startDate.toISOString().split('T')[0],
      endDate: trip.endDate.toISOString().split('T')[0],
      travelers: trip.travelers,
      travelStyle: trip.travelStyle,
      transportation: trip.transportation,
      createdAt: trip.createdAt,
    }));

    return NextResponse.json({ trips: payload });
  } catch (error) {
    console.error('Failed to fetch trips:', error);
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
  }
}
