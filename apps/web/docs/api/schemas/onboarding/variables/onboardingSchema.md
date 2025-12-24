[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [schemas/onboarding](../README.md) / onboardingSchema

# Variable: onboardingSchema

> `const` **onboardingSchema**: `ZodObject`\<\{ `brandColors`: `ZodString`; `brandPreferences`: `ZodOptional`\<`ZodString`\>; `businessName`: `ZodString`; `businessType`: `ZodString`; `confirmPassword`: `ZodOptional`\<`ZodString`\>; `email`: `ZodString`; `logoDataUri`: `ZodString`; `otherBusinessType`: `ZodOptional`\<`ZodString`\>; `password`: `ZodOptional`\<`ZodUnion`\<readonly \[`ZodString`, `ZodLiteral`\<`""`\>\]\>\>; \}, `$strip`\>

Defined in: [src/schemas/onboarding.ts:94](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/schemas/onboarding.ts#L94)

Combined schema for final server-side validation.
This merges the base schemas first, then applies all refinements.
