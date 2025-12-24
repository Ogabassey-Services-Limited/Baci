[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/sanitize](../README.md) / escapeHtml

# Function: escapeHtml()

> **escapeHtml**(`str`): `string`

Defined in: [src/lib/sanitize.ts:94](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/sanitize.ts#L94)

Escape HTML-sensitive characters for safe use in JSON-LD scripts.
Prevents XSS attacks when placing values inside <script type="application/ld+json"> tags.
Uses Unicode escape sequences to prevent breaking out of the script context.

## Parameters

### str

`string`

## Returns

`string`
