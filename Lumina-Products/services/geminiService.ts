import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProductRecommendation } from "../types";
import { products } from "../data/products";

// Initialize Gemini Client
// Note: process.env.API_KEY is injected by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const searchSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Name of the product" },
      price: { type: Type.STRING, description: "Estimated price (e.g. '$199')" },
      reason: { type: Type.STRING, description: "Short reason why this fits the search query" },
      category: { type: Type.STRING, description: "Product category" }
    },
    required: ["name", "price", "reason", "category"],
  },
};

export const searchProductsWithGemini = async (query: string): Promise<ProductRecommendation[]> => {
  try {
    const model = "gemini-2.5-flash";
    
    // Create context from inventory
    const inventoryContext = products
      .map(p => `${p.name} (${p.category}) - ${p.price}`)
      .join('\n');

    const prompt = `
      You are an intelligent e-commerce shopping assistant. 
      The user is searching for: "${query}".
      
      Here is the available product inventory:
      ${inventoryContext}
      
      Recommend up to 5 specific products from the inventory that match this query.
      If nothing matches well, you can suggest similar types of items but prioritize the inventory.
      Keep the "reason" brief and punchy.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: searchSchema,
        temperature: 0.4,
      },
    });

    const text = response.text;
    if (!text) return [];

    const recommendations = JSON.parse(text) as ProductRecommendation[];
    return recommendations;

  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [];
  }
};