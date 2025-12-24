[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [config/business-types](../README.md) / BusinessTypeJourney

# Interface: BusinessTypeJourney

Defined in: [src/config/business-types.ts:26](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L26)

Business type journey configuration
Defines the onboarding and product creation experience for each business category

## Properties

### onboarding

> **onboarding**: `object`

Defined in: [src/config/business-types.ts:28](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L28)

Onboarding-specific settings

#### additionalSteps?

> `optional` **additionalSteps**: `string`[]

Additional onboarding steps for this business type (future)

#### colorScheme

> **colorScheme**: `string`

AI prompt guidance for color scheme preferences

#### logoStyle

> **logoStyle**: `string`

AI prompt guidance for logo generation style

***

### productCreation

> **productCreation**: `object`

Defined in: [src/config/business-types.ts:37](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L37)

Product creation form customization

#### aiDescriptionStyle

> **aiDescriptionStyle**: `string`

AI prompt style for product descriptions

#### imageRequirements

> **imageRequirements**: `string`

Image requirements and guidance

#### requiredFields?

> `optional` **requiredFields**: `string`[]

Required fields specific to this business type
