export function getCustomerEditHeader({
  companyName,
  customerType,
  firstName,
  lastName,
}: {
  companyName: string;
  customerType?: string | null;
  firstName: string;
  lastName: string;
}) {
  const isCompanyCustomer = customerType === 'company';
  const name = isCompanyCustomer
    ? companyName.trim()
    : `${firstName} ${lastName}`.trim();
  const initials = isCompanyCustomer
    ? getInitialsFromText(name)
    : getPersonInitials(firstName, lastName);

  return { initials, name };
}

function getPersonInitials(firstName: string, lastName: string) {
  const first = firstName[0] || '';
  const last = lastName[0] || '';
  return (first + last).toUpperCase() || '?';
}

function getInitialsFromText(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}
