import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCacCompanies,
  fetchCacTaxId,
  findMatchingCacCompany,
} from './cac-public-records';

vi.mock('@/env', () => ({
  getCacApiUrl: () =>
    'https://authapp.cac.gov.ng/name_similarity_app/api/public_search/search',
  getCacTinApiBaseUrl: () =>
    'https://icrp.cac.gov.ng/tin_service/api/v1/public/tin',
}));

const ogabasseyCompany = {
  approvedName: 'OGABASSEY SERVICES LIMITED',
  rcNumber: '7389159',
  companyId: 7_955_903,
  classificationId: 2,
  status: 'ACTIVE',
};

describe('CAC public records', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('searches the current CAC AuthApp endpoint with the public-search payload', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [ogabasseyCompany], success: true }),
    });

    const companies = await fetchCacCompanies('Ogabassey Services Limited', {
      fetchImpl: fetchSpy,
    });

    expect(companies).toEqual([ogabasseyCompany]);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://authapp.cac.gov.ng/name_similarity_app/api/public_search/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          searchTerm: 'Ogabassey Services Limited',
          classification: 'ALL',
        }),
      })
    );
  });

  it('reads tax_id from CAC TIN responses even when the envelope success flag is false', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        success: false,
        data: {
          rc: '7389159',
          type: '2',
          company_name: 'OGABASSEY SERVICES LIMITED',
          tax_id: '2522599781276',
        },
        message: 'New TIN Already generated!',
      }),
    });

    const taxId = await fetchCacTaxId(ogabasseyCompany, {
      fetchImpl: fetchSpy,
    });

    expect(taxId).toBe('2522599781276');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://icrp.cac.gov.ng/tin_service/api/v1/public/tin/generate-tax-id/7955903?rc=7389159&type=2',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('finds an exact active CAC company match by registered business name', () => {
    const match = findMatchingCacCompany(
      [
        { ...ogabasseyCompany, approvedName: 'OTHER SERVICES LIMITED' },
        ogabasseyCompany,
      ],
      { legalEntityName: 'ogabassey services limited' }
    );

    expect(match).toEqual(ogabasseyCompany);
  });

  it('prefers RC number matching when a merchant already has a CAC number', () => {
    const match = findMatchingCacCompany([ogabasseyCompany], {
      legalEntityName: 'Different Name Limited',
      rcNumber: 'RC-7389159',
    });

    expect(match).toEqual(ogabasseyCompany);
  });
});
