import { generateKeyPairSync } from 'node:crypto';

export function buildTestKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicJwk = publicKey.export({ format: 'jwk' });
  const privateKeyPem = privateKey
    .export({ format: 'pem', type: 'pkcs8' })
    .toString();

  return {
    privateKeyPem,
    publicJwksJson: JSON.stringify({ keys: [publicJwk] }),
  };
}
