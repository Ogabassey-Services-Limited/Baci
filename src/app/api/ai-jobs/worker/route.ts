import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { geminiFlash, withRetry } from '@/ai/provider';

// Use environment variable to configure job process limit, defaulting to 5
const DEFAULT_JOB_PROCESS_LIMIT = (() => {
    const limitStr = process.env.AI_WORKER_JOB_PROCESS_LIMIT;
    const parsed = Number(limitStr);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 5;
})();

/**
 * Create and return a Supabase client configured from environment variables at runtime.
 *
 * @returns A Supabase client initialized with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
 */
function getSupabaseClient() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// Zod schema for price list processing response
const ChangeDetailsSchema = z.object({
    name: z.string(),
    price: z.number(),
    sku: z.string().optional(),
    description: z.string().optional(),
    stock: z.number().optional(),
    brand: z.string().optional(),
});

const ChangeSchema = z.object({
    type: z.enum(['update', 'new', 'remove']),
    productId: z.string().optional().describe('SKU or ID of the product to update or remove'),
    newPrice: z.number().optional().describe('The new price for a product update'),
    details: ChangeDetailsSchema,
    reason: z.string().optional().describe('Reasoning for the change, especially for removals'),
});

const PriceListResponseSchema = z.object({
    changes: z.array(ChangeSchema),
    summary: z.string().describe('A human-readable summary of all changes'),
    clarificationRequest: z.object({
        question: z.string(),
        options: z.array(z.string()),
    }).optional(),
    missingParameterRequest: z.object({
        productName: z.string(),
        missingFields: z.array(z.string()),
    }).optional(),
});

/**
 * Processes pending AI jobs from the database and updates their status lifecycle.
 *
 * Processes up to the configured job limit: marks each job as `processing`, executes the job (currently supports `price_list_processing`), then marks it `completed` with output or `failed` with an error. Authentication requires an `Authorization: Bearer <AI_WORKER_SECRET>` header.
 *
 * @param request - Incoming NextRequest; must include an `Authorization` header with the worker secret.
 * @returns A JSON response describing the operation outcome. On success the object contains `message`, `processed` (number of jobs handled), and `results` (array of `{ id, status, error? }`). On failure returns an error message and appropriate HTTP status.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabaseClient();

        // Verify authorization (you might want to use a secret token here)
        const authHeader = request.headers.get('authorization');
        const expectedToken = process.env.AI_WORKER_SECRET;

        if (!expectedToken) {
            return NextResponse.json(
                { error: 'AI worker secret not configured' },
                { status: 500 }
            );
        }

        if (authHeader !== `Bearer ${expectedToken}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get job process limit from configuration
        const jobProcessLimit = DEFAULT_JOB_PROCESS_LIMIT;

        // Get pending jobs (limit to configurable number at a time to avoid timeout)
        const { data: jobs, error: fetchError } = await supabase
            .from('ai_jobs')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(jobProcessLimit);

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
                console.error('Error processing job:', job.id, error);

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

interface ProcessPriceListInput {
    currentProducts: Record<string, unknown>[];
    priceListData: string;
    vendor: string;
    fileType: string;
}

/**
 * Analyze a vendor price list against the current catalog and produce a structured set of suggested changes.
 *
 * @param input - Processing input containing current catalog and the vendor price list:
 *   - `currentProducts`: array of product records representing the current catalog
 *   - `priceListData`: raw vendor price list content (e.g., CSV or JSON)
 *   - `vendor`: vendor identifier
 *   - `fileType`: format description of `priceListData` (for example, "CSV" or "JSON")
 * @returns An object conforming to `PriceListResponseSchema` describing the result:
 *   - `changes`: array of change objects (each with `type`, optional `productId`, optional `newPrice`, and `details`)
 *   - `summary`: concise summary of detected changes
 *   - optional `clarificationRequest`: `{ question, options }` when the AI needs disambiguation
 *   - optional `missingParameterRequest`: `{ productName, missingFields[] }` when required fields are absent
 */
async function processPriceList(input: ProcessPriceListInput) {
    const { currentProducts, priceListData, vendor, fileType } = input;

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
`;

    const { object } = await withRetry(async () => {
        return await generateObject({
            model: geminiFlash,
            schema: PriceListResponseSchema,
            prompt,
        });
    });

    return object;
}