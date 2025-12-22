[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [ai/provider](../README.md) / geminiFlash

# Variable: geminiFlash

> `const` **geminiFlash**: `LanguageModelV2`

Defined in: [src/ai/provider.ts:19](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/ai/provider.ts#L19)

Gemini Model Exports (Vercel AI SDK)

Model Selection Guide:
- geminiFlash: Fast, cost-effective. Use for simple tasks (descriptions, autofill)
- geminiPro: Currently aliased to geminiFlash. Upgrade to gemini-2.0-pro when needed.
- gemini25FlashImage: Multimodal model for text, image understanding, AND image generation
  Use with providerOptions: { google: { responseModalities: ['TEXT', 'IMAGE'] } }
