export type ImeiVerdictType = 'safe' | 'caution' | 'danger';

export function getVerdictColors(type: ImeiVerdictType) {
  switch (type) {
    case 'safe':
      return { bg: '#DEF7EC', text: '#059669', border: '#A7F3D0' };
    case 'danger':
      return { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' };
    default:
      return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
  }
}
