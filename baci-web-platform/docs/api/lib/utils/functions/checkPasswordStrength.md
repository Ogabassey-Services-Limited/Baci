[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/utils](../README.md) / checkPasswordStrength

# Function: checkPasswordStrength()

> **checkPasswordStrength**(`password`): `number`

Defined in: [src/lib/utils.ts:50](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/utils.ts#L50)

Password strength checker following NIST SP 800-63B guidelines

NIST recommendations:
- Minimum 8 characters (we use this as baseline)
- Longer is better (12+ is strong, 16+ is very strong)
- No complexity requirements (they don't help)
- Block common passwords
- Check against breach databases (done separately)

Returns: 0 (none), 1 (weak), 2 (medium), 3 (strong)

## Parameters

### password

`string`

## Returns

`number`
