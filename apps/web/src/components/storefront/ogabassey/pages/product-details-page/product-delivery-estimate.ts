export function getDeliveryEstimate(
  deliveryLocation: 'Lagos' | 'Outside Lagos',
  today = new Date()
) {
  const minDays = deliveryLocation === 'Lagos' ? 1 : 3;
  const maxDays = deliveryLocation === 'Lagos' ? 2 : 5;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const formatDate = (daysToAdd: number) => {
    const date = new Date(today);
    date.setDate(today.getDate() + daysToAdd);
    return formatter.format(date);
  };

  return `${formatDate(minDays)} - ${formatDate(maxDays)}`;
}
