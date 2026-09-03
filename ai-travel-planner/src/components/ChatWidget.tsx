'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatWidgetProps {
  itinerary: any[];
  context: {
    destination: string;
    days: any[];
    budget: number;
    currency: string;
    travelers: number;
    travelStyle: string;
    transportation: string;
  };
  onItineraryUpdate?: (newItinerary: any[]) => void;
}

export default function ChatWidget({ itinerary, context, onItineraryUpdate }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your travel assistant. I can help you modify your ${context.destination} trip itinerary. You can ask me to:
• Move activities to different times
• Swap activities between days
• Remove activities you don't want
• Add breaks or new activities
• Redistribute your budget
• Adjust pacing for a faster/slower trip

What would you like to change?`,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [lastChanges, setLastChanges] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setLastChanges(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          context: {
            ...context,
            days: itinerary,
          },
          conversationHistory: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If itinerary was updated, notify parent and store changes
      if (data.updatedItinerary && onItineraryUpdate) {
        onItineraryUpdate(data.updatedItinerary);
        setLastChanges(data.changes);
        setShowChanges(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content:
          "Sorry, I encountered an error. Could you try rephrasing your request? For example: 'Skip the shopping center' or 'Move museum to morning'",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Chat Widget Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition flex items-center justify-center z-40 ${
          isOpen
            ? 'bg-purple-600 text-white'
            : 'bg-purple-600 text-white hover:bg-purple-700'
        }`}
      >
        {isOpen ? (
          <ChevronDown className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 bg-white rounded-lg shadow-2xl flex flex-col z-50 h-96 md:h-[500px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-t-lg">
            <h3 className="font-bold text-lg">Travel Assistant</h3>
            <p className="text-xs text-purple-100">Ask me to modify your itinerary</p>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-800 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Changes Display */}
            {showChanges && lastChanges && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-green-800 mb-2">✓ Itinerary Updated!</p>
                <ul className="text-green-700 space-y-1">
                  {lastChanges.activitiesAdded > 0 && (
                    <li>+ {lastChanges.activitiesAdded} activity added</li>
                  )}
                  {lastChanges.activitiesRemoved > 0 && (
                    <li>- {lastChanges.activitiesRemoved} activity removed</li>
                  )}
                  {lastChanges.costChange !== 0 && (
                    <li>
                      Budget change: {lastChanges.costChange > 0 ? '+' : ''}
                      {context.currency}
                      {Math.round(lastChanges.costChange)}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg rounded-bl-none flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t p-3 bg-gray-50 rounded-b-lg">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim()}
                className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Tip: Try "Move museum to morning" or "Skip the shopping"
            </p>
          </div>
        </div>
      )}
    </>
  );
}
