[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/go54](../README.md) / transferDomain

# Function: transferDomain()

> **transferDomain**(`data`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/go54.ts:291](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/go54.ts#L291)

Transfer a domain from another registrar

## Parameters

### data

#### contacts

\{ `admin`: [`ContactInfo`](../interfaces/ContactInfo.md); `billing`: [`ContactInfo`](../interfaces/ContactInfo.md); `registrant`: [`ContactInfo`](../interfaces/ContactInfo.md); `tech`: [`ContactInfo`](../interfaces/ContactInfo.md); \}

#### contacts.admin

[`ContactInfo`](../interfaces/ContactInfo.md)

#### contacts.billing

[`ContactInfo`](../interfaces/ContactInfo.md)

#### contacts.registrant

[`ContactInfo`](../interfaces/ContactInfo.md)

#### contacts.tech

[`ContactInfo`](../interfaces/ContactInfo.md)

#### domain

`string`

#### eppcode

`string`

#### nameservers?

\{ `ns1`: `string`; `ns2`: `string`; `ns3?`: `string`; `ns4?`: `string`; `ns5?`: `string`; \}

#### nameservers.ns1

`string`

#### nameservers.ns2

`string`

#### nameservers.ns3?

`string`

#### nameservers.ns4?

`string`

#### nameservers.ns5?

`string`

#### regperiod

`number`

## Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>
