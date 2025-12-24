[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [schemas/onboarding](../README.md) / step3Schema

# Variable: step3Schema

> `const` **step3Schema**: `ZodObject`\<\{ `confirmPassword`: `ZodOptional`\<`ZodString`\>; `email`: `ZodString`; `password`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodLiteral`\<`""`\>\]\>\>; \}, `$strip`\>

Defined in: [src/schemas/onboarding.ts:49](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/schemas/onboarding.ts#L49)

Step 3: Account Creation (with client-side refinement + breach checking)
