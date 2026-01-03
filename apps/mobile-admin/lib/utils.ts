export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
    }).format(amount);
};

export const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000000) return `₦${(amount / 1000000000).toFixed(2)}B`;
    if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `₦${amount.toLocaleString()}`;
    return `₦${amount.toFixed(2)}`;
};
