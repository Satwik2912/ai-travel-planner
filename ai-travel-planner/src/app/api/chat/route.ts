import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  generateChatResponse,
  applyModifications,
  summarizeChanges,
  ChatContext,
  ChatMessage,
} from '@/lib/chat-service';
import { optimizeFullItinerary, validateOptimizedItinerary } from '@/lib/optimization-service';

const ChatRequestSchema = z.object({
  message: z.string().min(1),
  context: z.object({
    destination: z.string(),
    days: z.array(z.any()),
    budget: z.number(),
    currency: z.string(),
    travelers: z.number(),
    travelStyle: z.string(),
    transportation: z.string(),
  }),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chatRequest = ChatRequestSchema.parse(body);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Prepare context
    const context: ChatContext = {
      destination: chatRequest.context.destination,
      days: chatRequest.context.days,
      budget: chatRequest.context.budget,
      currency: chatRequest.context.currency,
      travelers: chatRequest.context.travelers,
      travelStyle: chatRequest.context.travelStyle,
      transportation: chatRequest.context.transportation,
    };

    // Convert conversation history
    const conversationHistory: ChatMessage[] = (chatRequest.conversationHistory || []).map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      })
    );

    console.log(`Processing chat message: "${chatRequest.message.substring(0, 50)}..."`);

    // Generate chat response
    const chatResponse = await generateChatResponse(
      chatRequest.message,
      context,
      conversationHistory,
      apiKey
    );

    // If there are modifications, try to apply them
    let updatedItinerary = context.days;
    let changeSummary = null;

    if (chatResponse.modifications && chatResponse.modifications.length > 0) {
      console.log(`Applying ${chatResponse.modifications.length} modifications...`);
      updatedItinerary = applyModifications(context.days, chatResponse.modifications, context);

      // Re-optimize after modifications
      const placeMap = new Map();
      const optimized = optimizeFullItinerary({
        days: updatedItinerary,
        allPlaces: {
          attractions: [],
          restaurants: [],
          activities: [],
          hotels: [],
        },
        dailyBudget: Math.round(context.budget / context.days.length),
        transportation: context.transportation,
      });

      updatedItinerary = optimized;

      // Calculate changes
      changeSummary = summarizeChanges(context.days, updatedItinerary);

      // Validate updated itinerary
      const validation = validateOptimizedItinerary(
        updatedItinerary,
        context.budget,
        context.days.length
      );

      return NextResponse.json({
        success: true,
        message: chatResponse.message,
        updatedItinerary,
        changes: changeSummary,
        validation: {
          isValid: validation.isValid,
          budgetStatus: validation.budgetStatus,
          timeStatus: validation.timeStatus,
          suggestions: validation.suggestions,
        },
        confidence: chatResponse.confidence,
      });
    }

    // No modifications, just return the chat response
    return NextResponse.json({
      success: true,
      message: chatResponse.message,
      updatedItinerary: null,
      changes: null,
      confidence: chatResponse.confidence,
    });
  } catch (error) {
    console.error('Error processing chat:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to process chat message',
        message: 'I had trouble understanding that. Could you try rephrasing?',
      },
      { status: 500 }
    );
  }
}
