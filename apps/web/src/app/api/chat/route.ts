import { streamText } from 'ai';
import { activeTextModel } from '@/ai/provider';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = streamText({
      model: activeTextModel,
      system:
        "You are Ogabassey's AI Customer Support Agent. You are helpful, polite, and knowledgeable about electronics (Phones, Laptops, Gaming). Keep answers short and sales-oriented. If you don't know an order status, ask them to provide an Order ID.",
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response('Error processing chat request', { status: 500 });
  }
}
