/**
 * Cloudflare Worker: Gemini Image Generation Proxy
 * Bypasses geo-restrictions by relaying requests through Cloudflare's global edge.
 * 
 * Deploy: wrangler deploy
 * Endpoint: https://gemini-image-proxy.<your-subdomain>.workers.dev/generate
 */

export default {
    async fetch(request, env) {
        // CORS headers for preflight
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                },
            });
        }

        if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed" }), {
                status: 405,
                headers: { "Content-Type": "application/json" },
            });
        }

        try {
            const body = await request.json();
            const { prompt, api_key } = body;

            if (!prompt || !api_key) {
                return new Response(
                    JSON.stringify({ error: "Missing prompt or api_key" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            // Call Gemini 2.5 Flash Image from Cloudflare's edge (dedicated image gen model)
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${api_key}`;

            const geminiResponse = await fetch(geminiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                    },
                }),
            });

            const result = await geminiResponse.json();

            // Return the response (includes base64 image data if successful)
            return new Response(JSON.stringify(result), {
                status: geminiResponse.status,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        } catch (error) {
            return new Response(
                JSON.stringify({ error: error.message || "Internal error" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    },
};
