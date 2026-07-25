import { describe, expect, it, vi } from 'vitest';
import {
  type DomainProvisionClient,
  provisionMerchantDomain,
} from './provision-merchant-domain';

function clientReturning(error: { code?: string } | null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const client = { from: vi.fn(() => ({ insert })) } as DomainProvisionClient;
  return { client, insert };
}

const input = {
  merchantId: 'merch-1',
  merchantSlug: 'test',
  rootDomain: 'usebaci.com',
};

describe('provisionMerchantDomain', () => {
  it('inserts the subdomain derived from the merchant slug', async () => {
    // Arrange
    const { client, insert } = clientReturning(null);

    // Act
    const result = await provisionMerchantDomain(client, input);

    // Assert
    expect(result.provisioned).toBe(true);
    expect(insert).toHaveBeenCalledWith({
      merchant_id: 'merch-1',
      domain: 'test.usebaci.com',
      tld: '.usebaci.com',
      domain_type: 'subdomain',
      status: 'active',
      is_primary: true,
    });
  });

  it('treats an already-provisioned domain as success', async () => {
    // Arrange — 23505 means a previous attempt already created the row.
    const { client } = clientReturning({ code: '23505' });

    // Act
    const result = await provisionMerchantDomain(client, input);

    // Assert
    expect(result.provisioned).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('reports any other failure with the error intact', async () => {
    // Arrange
    const { client } = clientReturning({ code: '42501' });

    // Act
    const result = await provisionMerchantDomain(client, input);

    // Assert — the caller needs the code to decide whether to alert.
    expect(result.provisioned).toBe(false);
    expect(result.error).toEqual({ code: '42501' });
  });

  it('runs on whichever client it is handed, holding no privileged client of its own', async () => {
    // Arrange
    const { client, insert } = clientReturning(null);

    // Act
    await provisionMerchantDomain(client, input);

    // Assert — the caller supplies the caller-scoped client; a denial must stay
    // a denial rather than being forced through with service-role.
    expect(client.from).toHaveBeenCalledWith('domains');
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
