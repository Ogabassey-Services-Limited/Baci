'use client';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

// Configure Google AI provider using the same key as the main app
const google = createGoogleGenerativeAI({
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_GENAI_API_KEY || process.env.GOOGLE_GENAI_API_KEY,
});

const model = google('gemini-2.0-flash');

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export const chatWithGemini = async (
    history: ChatMessage[],
    newMessage: string
): Promise<string> => {
    try {
        const messages = [
            {
                role: 'system',
                content:
                    "You are Ogabassey's AI Customer Support Agent. You are helpful, polite, and knowledgeable about electronics (Phones, Laptops, Gaming). Keep answers short and sales-oriented. If you don't know an order status, ask them to provide an Order ID.",
            },
            ...history.map((msg) => ({
                role: msg.role === 'model' ? 'assistant' : 'user',
                content: msg.text,
            })),
            {
                role: 'user',
                content: newMessage,
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any; // Type casting to satisfy Vercel AI SDK strict message types

        const { text } = await generateText({
            model: model,
            messages: messages,
        });

        return (
            text || "I'm having trouble connecting right now. Please try again."
        );
    } catch (error) {
        console.error('Chat error:', error);
        return "I'm currently offline. Please contact human support at +234 814 697 8921.";
    }
};
