[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/sanitize](../README.md) / stripHtmlTags

# Function: stripHtmlTags()

> **stripHtmlTags**(`text`): `string`

Defined in: [src/lib/sanitize.ts:21](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/sanitize.ts#L21)

Strips HTML tags from a string by iteratively applying the regex until no more matches.
This prevents incomplete sanitization from nested patterns like <scr<script>ipt>.

## Parameters

### text

`string`

## Returns

`string`
