export function calculateDays(startDate: Date, endDate: Date): number {
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function calculateDailyBudget(totalBudget: number, days: number): number {
  return Math.floor(totalBudget / days);
}

export function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  });
  return formatter.format(amount);
}

export function generateTimeSlot(startHour: number, durationMinutes: number): {
  start: string;
  end: string;
} {
  const start = new Date();
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMinutes);

  return {
    start: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    end: end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function optimizeRoute(
  places: Array<{ latitude: number; longitude: number }>,
  startTime: number
): Array<{ index: number; startTime: string }> {
  // Simple greedy algorithm for route optimization
  const visited = new Set<number>();
  const result: Array<{ index: number; startTime: string }> = [];

  let currentLat = places[0]?.latitude || 0;
  let currentLng = places[0]?.longitude || 0;
  let currentTime = startTime;

  for (let i = 0; i < places.length; i++) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;

    for (let j = 0; j < places.length; j++) {
      if (!visited.has(j)) {
        const distance = Math.sqrt(
          Math.pow(places[j].latitude - currentLat, 2) +
            Math.pow(places[j].longitude - currentLng, 2)
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = j;
        }
      }
    }

    if (nearestIndex !== -1) {
      visited.add(nearestIndex);
      result.push({
        index: nearestIndex,
        startTime: `${Math.floor(currentTime)}:00`,
      });

      currentLat = places[nearestIndex].latitude;
      currentLng = places[nearestIndex].longitude;
      currentTime += 1.5; // Assume 1.5 hours per place
    }
  }

  return result;
}

export function validateBudget(
  itemCost: number,
  dailyBudget: number,
  currentSpent: number
): boolean {
  return currentSpent + itemCost <= dailyBudget;
}

export function parseOpeningHours(hours: string): {
  opens: string;
  closes: string;
} {
  const match = hours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (match) {
    return {
      opens: `${match[1]}:${match[2]}`,
      closes: `${match[3]}:${match[4]}`,
    };
  }
  return { opens: '', closes: '' };
}

export function calculateTimeToTravel(
  distance: number,
  transportType: string
): number {
  const speedMap: Record<string, number> = {
    walking: 5, // km/h
    public_transport: 15,
    car: 30,
  };

  const speed = speedMap[transportType] || 15;
  return Math.ceil((distance / speed) * 60); // Return in minutes
}
