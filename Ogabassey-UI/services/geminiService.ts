import { GoogleGenAI, Type } from "@google/genai";
import { ProductRecommendation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const searchProductsWithGemini = async (query: string): Promise<ProductRecommendation[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `User search query: "${query}"
      
      You are an intelligent shopping assistant for an electronics store called 'Ogabassey'. 
      Based on the user's query, recommend 3-5 specific electronic products (phones, laptops, gaming consoles, accessories).
      If the user asks a question, answer it by recommending products that solve their problem.
      
      Examples:
      - "Best phone for photos" -> Suggest iPhone 16 Pro Max, Samsung S24 Ultra.
      - "Cheap laptop for school" -> Suggest MacBook Air M1, HP Pavilion.
      
      Return the data strictly in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.STRING },
              reason: { type: Type.STRING, description: "Why this product matches the query" },
              category: { type: Type.STRING }
            },
            required: ["name", "price", "reason", "category"]
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ProductRecommendation[];
    }
    return [];
  } catch (error) {
    console.error("Gemini search error:", error);
    return [];
  }
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const chatWithGemini = async (history: ChatMessage[], newMessage: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: 'user',
                    parts: [{ text: "You are Ogabassey's AI Customer Support Agent. You are helpful, polite, and knowledgeable about electronics (Phones, Laptops, Gaming). Keep answers short and sales-oriented. If you don't know an order status, ask them to provide an Order ID." }]
                },
                ...history.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.text }]
                })),
                {
                    role: 'user',
                    parts: [{ text: newMessage }]
                }
            ]
        });

        return response.text || "I'm having trouble connecting right now. Please try again.";
    } catch (error) {
        console.error("Chat error:", error);
        return "I'm currently offline. Please contact human support at +234 814 697 8921.";
    }
};