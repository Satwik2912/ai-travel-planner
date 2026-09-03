/**
 * Chat Assistant Service
 * Handles conversational modification of trips using Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Activity, ItineraryDay } from './trip-generation-service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface ChatContext {
  destination: string;
  days: ItineraryDay[];
  budget: number;
  currency: string;
  travelers: number;
  travelStyle: string;
  transportation: string;
}

export interface ModificationRequest {
  type: 'swap' | 'time' | 'budget' | 'add' | 'remove' | 'replace';
  day: number;
  activityIndex?: number;
  newActivity?: Partial<Activity>;
  reason?: string;
}

export interface ChatResponse {
  message: string;
  modifications?: ModificationRequest[];
  updatedItinerary?: ItineraryDay[];
  confidence: number;
}

/**
 * Format current itinerary for context in chat
 */
export function formatItineraryContext(context: ChatContext): string {
  let itineraryText = `
Current Trip: ${context.destination}
Budget: ${context.currency} ${context.budget}
Duration: ${context.days.length} days
Travel Style: ${context.travelStyle}
Transportation: ${context.transportation}
Travelers: ${context.travelers}

ITINERARY:
`;

  for (const day of context.days) {
    itineraryText += `
Day ${day.day} (${day.date}):
${day.activities
  .map(
    (a, idx) =>
      `  ${idx + 1}. ${a.time} - ${a.name} (${a.type}, ${a.duration}min, ${context.currency}${a.cost})`
  )
  .join('\n')}
Daily Budget: ${context.currency}${day.dailyBudget}
Total Distance: ${day.totalDistance}
Total Travel Time: ${day.totalTravelTime}
`;
  }

  return itineraryText;
}

/**
 * Build system prompt for chat assistant
 */
export function buildChatSystemPrompt(context: ChatContext): string {
  const itineraryContext = formatItineraryContext(context);

  return `You are a helpful travel assistant AI. You help users modify their trip itineraries through conversation.

${itineraryContext}

CAPABILITIES:
You can help users:
1. Swap activities between time slots or days
2. Adjust activity times (earlier/later)
3. Remove activities they don't want
4. Replace activities with alternatives
5. Add breaks or free time
6. Redistribute budget across the trip
7. Group activities by location/theme
8. Adjust pacing (faster or slower days)

MODIFICATION REQUESTS:
When the user asks to modify the itinerary, respond with:
1. Acknowledge their request
2. Explain what will change
3. Show the impact on budget/time
4. Ask for confirmation if needed

CONSTRAINTS:
- Each day should be 8-12 hours active (9 AM - 8 PM typical)
- Activities should be 60-120 minutes duration
- Total trip budget must be respected (${context.currency}${context.budget})
- Daily budget limit: ${context.currency}${Math.round(context.budget / context.days.length)} per day
- Maintain variety: mix attractions, meals, activities, rest

RESPONSE FORMAT:
Always respond in a friendly, conversational tone. When making changes:
- Highlight what's different
- Show new times clearly
- Mention cost impacts
- Suggest why the change works

Example response:
"Sure! I'll move the museum visit to the morning on Day 2. This gives you more time to explore the area and avoids the afternoon crowds. It'll free up your Day 1 afternoon for that market you wanted to visit. This adds 15 minutes of travel time but keeps you within budget."`;
}

/**
 * Parse user message to extract modification intent
 */
export function parseUserIntent(message: string, context: ChatContext): ModificationRequest[] {
  const requests: ModificationRequest[] = [];

  const lowerMessage = message.toLowerCase();

  // Detect swap intent
  if (
    lowerMessage.includes('swap') ||
    lowerMessage.includes('move') ||
    lowerMessage.includes('change order')
  ) {
    requests.push({ type: 'swap', day: 1, reason: 'User requested activity reordering' });
  }

  // Detect time adjustment
  if (
    lowerMessage.includes('earlier') ||
    lowerMessage.includes('later') ||
    lowerMessage.includes('morning') ||
    lowerMessage.includes('afternoon') ||
    lowerMessage.includes('time')
  ) {
    requests.push({ type: 'time', day: 1, reason: 'User requested time adjustment' });
  }

  // Detect removal
  if (
    lowerMessage.includes('remove') ||
    lowerMessage.includes('skip') ||
    lowerMessage.includes('delete') ||
    lowerMessage.includes("don't want") ||
    lowerMessage.includes('too crowded')
  ) {
    requests.push({ type: 'remove', day: 1, reason: 'User wants to remove an activity' });
  }

  // Detect replacement
  if (
    lowerMessage.includes('instead of') ||
    lowerMessage.includes('replace') ||
    lowerMessage.includes('swap out')
  ) {
    requests.push({ type: 'replace', day: 1, reason: 'User wants to replace an activity' });
  }

  // Detect addition
  if (
    lowerMessage.includes('add') ||
    lowerMessage.includes('include') ||
    lowerMessage.includes('visit')
  ) {
    requests.push({ type: 'add', day: 1, reason: 'User wants to add an activity' });
  }

  // Detect budget concern
  if (
    lowerMessage.includes('expensive') ||
    lowerMessage.includes('budget') ||
    lowerMessage.includes('cost') ||
    lowerMessage.includes('too much')
  ) {
    requests.push({ type: 'budget', day: 1, reason: 'User has budget concerns' });
  }

  return requests;
}

/**
 * Generate response from Gemini for chat
 */
export async function generateChatResponse(
  userMessage: string,
  context: ChatContext,
  conversationHistory: ChatMessage[],
  apiKey: string
): Promise<ChatResponse> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const systemPrompt = buildChatSystemPrompt(context);

    // Build conversation for Gemini
    const messages = [
      {
        role: 'user' as const,
        parts: [{ text: systemPrompt }],
      },
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user' as const,
        parts: [{ text: userMessage }],
      },
    ];

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const response = await model.generateContent({
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    const assistantMessage = await response.response.text();

    // Parse user intent from message
    const modifications = parseUserIntent(userMessage, context);

    return {
      message: assistantMessage,
      modifications: modifications.length > 0 ? modifications : undefined,
      confidence: 0.85,
    };
  } catch (error) {
    console.error('Error generating chat response:', error);
    return {
      message: `I encountered an issue processing your request. Could you rephrase that? For example, you could say:
- "Move the museum to the morning"
- "I want to skip the shopping area"
- "Add more time for restaurants"
- "Can we do activities closer together?"`,
      confidence: 0.3,
    };
  }
}

/**
 * Apply modifications to itinerary
 */
export function applyModifications(
  itinerary: ItineraryDay[],
  modifications: ModificationRequest[],
  context: ChatContext
): ItineraryDay[] {
  let updated = JSON.parse(JSON.stringify(itinerary)) as ItineraryDay[];

  for (const mod of modifications) {
    if (mod.day < 1 || mod.day > updated.length) continue;

    const dayIdx = mod.day - 1;
    const day = updated[dayIdx];

    switch (mod.type) {
      case 'time': {
        // Shift activity times within the day
        if (day.activities.length > 0) {
          // Simple approach: rotate activities forward
          const lastActivity = day.activities.pop();
          if (lastActivity) day.activities.unshift(lastActivity);
        }
        break;
      }

      case 'remove': {
        // Remove an activity (remove one per modification)
        if (mod.activityIndex !== undefined && day.activities[mod.activityIndex]) {
          day.activities.splice(mod.activityIndex, 1);
        }
        break;
      }

      case 'add': {
        // Add a break or new activity
        if (mod.newActivity) {
          day.activities.push({
            time: '17:00',
            name: mod.newActivity.name || 'Activity',
            type: mod.newActivity.type || 'activity',
            duration: mod.newActivity.duration || 60,
            cost: mod.newActivity.cost || 0,
            address: mod.newActivity.address || '',
            notes: mod.newActivity.notes || '',
          });
        }
        break;
      }

      case 'replace': {
        // Replace activity at index
        if (mod.activityIndex !== undefined && mod.newActivity && day.activities[mod.activityIndex]) {
          day.activities[mod.activityIndex] = {
            time: day.activities[mod.activityIndex].time,
            name: mod.newActivity.name || day.activities[mod.activityIndex].name,
            type: mod.newActivity.type || day.activities[mod.activityIndex].type,
            duration: mod.newActivity.duration || day.activities[mod.activityIndex].duration,
            cost: mod.newActivity.cost || day.activities[mod.activityIndex].cost,
            address: mod.newActivity.address || day.activities[mod.activityIndex].address,
            notes: mod.newActivity.notes || day.activities[mod.activityIndex].notes,
          };
        }
        break;
      }

      case 'swap': {
        // Swap order of two consecutive activities
        if (day.activities.length >= 2) {
          const temp = day.activities[0];
          day.activities[0] = day.activities[1];
          day.activities[1] = temp;
        }
        break;
      }
    }
  }

  return updated;
}

/**
 * Summarize itinerary changes
 */
export function summarizeChanges(
  original: ItineraryDay[],
  modified: ItineraryDay[]
): { activitiesAdded: number; activitiesRemoved: number; costChange: number } {
  let activitiesAdded = 0;
  let activitiesRemoved = 0;
  let costChange = 0;

  for (let i = 0; i < Math.max(original.length, modified.length); i++) {
    const origDay = original[i];
    const modDay = modified[i];

    if (!origDay || !modDay) continue;

    const origCount = origDay.activities.length;
    const modCount = modDay.activities.length;

    if (modCount > origCount) {
      activitiesAdded += modCount - origCount;
    } else if (modCount < origCount) {
      activitiesRemoved += origCount - modCount;
    }

    costChange += modDay.dailyBudget - origDay.dailyBudget;
  }

  return { activitiesAdded, activitiesRemoved, costChange };
}
