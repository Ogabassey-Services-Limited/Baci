
'use server';

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Product } from "@/lib/products";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable not set.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro-preview",
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ],
});

export interface Change {
  type: 'update' | 'new' | 'remove';
  productId?: string;
  newPrice?: number;
  details: {
    name: string;
    price: number;
    sku?: string;
    description?: string;
    stock?: number;
    brand?: string;
  };
  reason?: string;
}

export interface AIResponse {
  changes: Change[];
  summary: string;
  clarificationRequest?: {
    question: string;
    options: string[];
  };
   missingParameterRequest?: {
    productName: string;
    missingFields: string[];
  };
}

export async function processPriceList(
  currentProducts: Product[],
  priceListData: string,
  vendor: string,
  fileType: string,
): Promise<AIResponse> {

  const jsonSchema = `{
    "type": "object",
    "properties": {
      "changes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": {"type": "string", "enum": ["update", "new", "remove"]},
            "productId": {"type": "string", "description": "SKU or ID of the product to update or remove. Must match an ID from the current catalog."},
            "newPrice": {"type": "number", "description": "The new price for a product update."},
            "details": {
              "type": "object",
              "properties": {
                "name": {"type": "string"},
                "price": {"type": "number"},
                "sku": {"type": "string"},
                "description": {"type": "string"},
                "stock": {"type": "number"},
                "brand": {"type": "string"}
              },
              "required": ["name", "price"]
            },
            "reason": {"type": "string", "description": "Reasoning for the change, especially for removals."}
          },
          "required": ["type", "details"]
        }
      },
      "summary": {"type": "string", "description": "A human-readable summary of all changes."},
      "clarificationRequest": {
        "type": "object",
        "properties": {
          "question": {"type": "string"},
          "options": {"type": "array", "items": {"type": "string"}}
        }
      },
      "missingParameterRequest": {
        "type": "object",
        "properties": {
            "productName": {"type": "string"},
            "missingFields": {"type": "array", "items": {"type": "string"}}
        }
      }
    },
    "required": ["changes", "summary"]
  }`;

  const prompt = `
    You are an AI assistant for an e-commerce platform. Your task is to analyze a new price list and compare it to the current product catalog.
    Return a structured JSON object that details all suggested changes.

    Current Product Catalog (JSON):
    ${JSON.stringify(currentProducts)}

    New Price List from Vendor "${vendor}" (Format: ${fileType}):
    ---
    ${priceListData}
    ---

    Instructions:
    1.  Analyze the new price list and identify all differences from the current catalog.
    2.  For existing products, identify price changes. Use the SKU/ID to match products.
    3.  Identify any completely new products in the price list.
    4.  Identify products in the current catalog that are NOT in the new price list; suggest them for removal.
    5.  Populate the 'changes' array with objects representing these findings.
    6.  If a required field for a new product like "Condition" is missing, use the 'missingParameterRequest' field to ask for it.
    7.  If you are uncertain about a change (e.g., two products have similar names), use 'clarificationRequest' to ask the user.
    8.  Provide a concise 'summary' of all the changes you found.
    9.  IMPORTANT: Your entire response MUST be a single valid JSON object that conforms to this schema. Do not include any text before or after the JSON.
    JSON Schema: ${jsonSchema}
    `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean the response to ensure it's valid JSON
    const jsonString = responseText.replace(/^```json\s*|```$/g, '').trim();

    const parsedResponse: AIResponse = JSON.parse(jsonString);
    return parsedResponse;
  } catch (error) {
    console.error("Error processing price list with AI:", error);
    // Return a structured error response
    return {
      changes: [],
      summary: "An error occurred while processing the price list. The AI model could not return a valid response. Please check the file format or try again.",
    };
  }
}
