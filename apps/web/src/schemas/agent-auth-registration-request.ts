import { z } from 'zod';

const ID_JAG_ASSERTION_TYPE = 'urn:ietf:params:oauth:token-type:id-jag';

export const agentAuthRegistrationRequestSchema = z.strictObject({
  assertion: z.string().trim().min(1),
  assertion_type: z.literal(ID_JAG_ASSERTION_TYPE),
  client_id: z.string().trim().min(1).optional(),
  requested_credential_type: z.literal('api_key').optional(),
  scopes: z.array(z.string().trim().min(1)).max(16).optional(),
  type: z.literal('identity_assertion'),
});
