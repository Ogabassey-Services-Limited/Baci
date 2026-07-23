interface SettlementNotificationData {
  businessName: string;
  email: string;
  settlements: Array<{
    amount: number;
    description: string;
    gateway: string;
    id: string;
  }>;
  totalAmount: number;
}

export function buildSettlementNotificationEmail(
  data: SettlementNotificationData
) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const dashboardUrl = `https://dashboard.${rootDomain}/dashboard/wallet`;
  const settlementRows = data.settlements
    .map(
      (settlement) => `
        <tr>
          <td>${settlement.description}</td>
          <td>${settlement.gateway}</td>
          <td>₦${settlement.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
        </tr>`
    )
    .join('');

  return {
    emailType: 'notifications' as const,
    htmlContent: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">💰 Funds Settled!</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="color: #374151; font-size: 16px; margin-top: 0;">Hi ${data.businessName},</p>
          <p style="color: #374151; font-size: 16px;">Great news! Your funds have been settled and are now available in your wallet.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
            <p style="margin: 0 0 8px; color: #166534; font-size: 14px; text-transform: uppercase;">Total Settled</p>
            <p style="margin: 0; color: #15803d; font-size: 32px; font-weight: 700;">₦${data.totalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <thead><tr style="background: #f9fafb;"><th>Description</th><th>Source</th><th>Amount</th></tr></thead>
            <tbody>${settlementRows}</tbody>
          </table>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Your Wallet</a>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px; text-align: center;">You can withdraw these funds anytime from your dashboard.</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">This is an automated notification from Baci.</p>
        </div>
      </div>`,
    subject: `💰 ₦${data.totalAmount.toLocaleString()} settled to your wallet`,
    to: data.email,
    toName: data.businessName,
  };
}
