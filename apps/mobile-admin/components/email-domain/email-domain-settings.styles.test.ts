import { describe, expect, it } from 'vitest';
import { makeEmailDomainSettingsStyles } from './email-domain-settings.styles';
import type { EmailDomainColors } from './email-domain-settings.styles';

const colors: EmailDomainColors = {
  background: '#fff',
  border: '#eee',
  card: '#fafafa',
  error: '#d00',
  errorLight: '#fee',
  info: '#06c',
  infoLight: '#def',
  primary: '#25f',
  success: '#1a3',
  successLight: '#dfd',
  text: '#012',
  textMuted: '#678',
  textSecondary: '#345',
} as EmailDomainColors;

describe('makeEmailDomainSettingsStyles', () => {
  it('uses the active theme colors for cards and invalid inputs', () => {
    const styles = makeEmailDomainSettingsStyles(colors);

    expect(styles.card).toEqual(expect.objectContaining({ borderColor: '#eee' }));
    expect(styles.inputInvalid).toEqual(
      expect.objectContaining({ borderColor: '#d00' })
    );
  });
});
