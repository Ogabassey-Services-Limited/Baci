const MTN_PREFIXES = [
  '0703',
  '0706',
  '0803',
  '0806',
  '0810',
  '0813',
  '0814',
  '0816',
  '0903',
  '0906',
  '0913',
  '0916',
];

const AIRTEL_PREFIXES = [
  '0701',
  '0708',
  '0802',
  '0808',
  '0812',
  '0901',
  '0902',
  '0904',
  '0907',
  '0912',
];

const GLO_PREFIXES = ['0705', '0805', '0807', '0811', '0815', '0905', '0915'];

const MOBILE_9_PREFIXES = ['0809', '0817', '0818', '0908', '0909'];

export function detectNetworkProvider(phoneNumber: string) {
  const number = phoneNumber.replace(/^\+?234/, '0').replace(/\s/g, '');
  const prefix = number.substring(0, 4);

  if (MTN_PREFIXES.includes(prefix)) {
    return 'MTN';
  }

  if (AIRTEL_PREFIXES.includes(prefix)) {
    return 'AIRTEL';
  }

  if (GLO_PREFIXES.includes(prefix)) {
    return 'GLO';
  }

  if (MOBILE_9_PREFIXES.includes(prefix)) {
    return '9MOBILE';
  }

  return null;
}
