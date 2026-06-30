import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert, Linking } from 'react-native';
import { createInsuranceFlowActions } from './insurance-flow-actions';

describe('createInsuranceFlowActions', () => {
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;
  let openUrlSpy: jest.SpiedFunction<typeof Linking.openURL>;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens an allowlisted MyCover hosted flow URL', async () => {
    const actions = createInsuranceFlowActions(jest.fn());

    await actions.openInsuranceFlowUrl('https://mycover.ai/purchase?q=claim');

    expect(openUrlSpy).toHaveBeenCalledWith(
      'https://mycover.ai/purchase?q=claim'
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('alerts instead of opening a disallowed URL', async () => {
    const actions = createInsuranceFlowActions(jest.fn());

    await actions.openInsuranceFlowUrl('https://evil.test/phish');

    expect(openUrlSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Unable to open link',
      expect.any(String)
    );
  });

  it('alerts when opening an allowlisted URL fails (openURL rejects)', async () => {
    openUrlSpy.mockRejectedValueOnce(new Error('no handler') as never);
    const actions = createInsuranceFlowActions(jest.fn());

    await actions.openInsuranceFlowUrl('https://mycover.ai/purchase?q=claim');

    expect(openUrlSpy).toHaveBeenCalledWith(
      'https://mycover.ai/purchase?q=claim'
    );
    expect(alertSpy).toHaveBeenCalledWith(
      'Unable to open link',
      expect.any(String)
    );
  });

  it('opens an allowlisted S3 certificate URL', async () => {
    const actions = createInsuranceFlowActions(jest.fn());

    await actions.openInsuranceCertificateUrl(
      'https://s3.eu-west-2.amazonaws.com/staging.mycover.ai/cert.pdf'
    );

    expect(openUrlSpy).toHaveBeenCalledWith(
      'https://s3.eu-west-2.amazonaws.com/staging.mycover.ai/cert.pdf'
    );
  });

  it('routes the claim fallback to support', () => {
    const handleContactSupport = jest.fn();
    const actions = createInsuranceFlowActions(handleContactSupport);

    actions.openInsuranceClaimFallback();

    expect(alertSpy).toHaveBeenCalledWith(
      'File your claim',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Contact support' }),
      ])
    );
    // Invoke the "Contact support" action to confirm it is wired.
    const buttons = alertSpy.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    buttons.find((b) => b.text === 'Contact support')?.onPress?.();
    expect(handleContactSupport).toHaveBeenCalledTimes(1);
  });
});
