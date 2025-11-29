[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/go54](../README.md) / registerDomain

# Function: registerDomain()

> **registerDomain**(`data`): `Promise`\<[`DomainRegistrationResult`](../interfaces/DomainRegistrationResult.md)\>

Defined in: [src/lib/go54.ts:243](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/go54.ts#L243)

Register a new domain

## Parameters

### data

#### addons?

\{ `dnsmanagement?`: `0` \| `1`; `emailforwarding?`: `0` \| `1`; `idprotection?`: `0` \| `1`; \}

#### addons.dnsmanagement?

`0` \| `1`

#### addons.emailforwarding?

`0` \| `1`

#### addons.idprotection?

`0` \| `1`

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

`Promise`\<[`DomainRegistrationResult`](../interfaces/DomainRegistrationResult.md)\>
