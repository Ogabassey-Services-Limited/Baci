[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [ai/provider](../README.md) / sanitizePromptInput

# Function: sanitizePromptInput()

> **sanitizePromptInput**(`input`, `maxLength`): [`SanitizeResult`](../interfaces/SanitizeResult.md)

Defined in: [src/ai/provider.ts:154](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/ai/provider.ts#L154)

Sanitize user input for AI prompts to prevent prompt injection

## Parameters

### input

`string`

### maxLength

`number` = `500`

## Returns

[`SanitizeResult`](../interfaces/SanitizeResult.md)

Object with sanitized value and metadata about truncation
