import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

// Use service role client to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-preview",
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
});

// POST /api/ai-jobs/worker - Process pending AI jobs (called by cron or manually)
export async function POST(request: NextRequest) {
    try {
        // Verify authorization (you might want to use a secret token here)
        const authHeader = request.headers.get('authorization');
        const expectedToken = process.env.AI_WORKER_SECRET || 'dev-secret-token';

        if (authHeader !== `Bearer ${expectedToken}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get pending jobs (limit to 5 at a time to avoid timeout)
        const { data: jobs, error: fetchError } = await supabase
            .from('ai_jobs')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(5);

        if (fetchError) {
            console.error('Error fetching pending jobs:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch jobs' },
                { status: 500 }
            );
        }

        if (!jobs || jobs.length === 0) {
            return NextResponse.json({
                message: 'No pending jobs',
                processed: 0
            });
        }

        const results = [];

        for (const job of jobs) {
            try {
                // Mark as processing
                await supabase
                    .from('ai_jobs')
                    .update({
                        status: 'processing',
                        started_at: new Date().toISOString()
                    })
                    .eq('id', job.id);

                // Process based on job type
                let output;
                if (job.type === 'price_list_processing') {
                    output = await processPriceList(job.input);
                } else {
                    throw new Error(`Unknown job type: ${job.type}`);
                }

                // Mark as completed
                await supabase
                    .from('ai_jobs')
                    .update({
                        status: 'completed',
                        output,
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', job.id);

                results.push({ id: job.id, status: 'completed' });
            } catch (error) {
                console.error(`Error processing job ${job.id}:`, error);

                // Mark as failed
                await supabase
                    .from('ai_jobs')
                    .update({
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', job.id);

                results.push({ id: job.id, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
            }
        }

        return NextResponse.json({
            message: `Processed ${results.length} jobs`,
            processed: results.length,
            results
        });
    } catch (error) {
        console.error('Unexpected error in AI worker:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processPriceList(input: any) {
    const { currentProducts, priceListData, vendor, fileType } = input;

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

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean the response to ensure it's valid JSON
    const jsonString = responseText.replace(/^```json\s*|```$/g, '').trim();

    const parsedResponse = JSON.parse(jsonString);
    return parsedResponse;
}
