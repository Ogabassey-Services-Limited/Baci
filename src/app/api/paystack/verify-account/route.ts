import { NextResponse, type NextRequest } from 'next/server';
import { resolveAccountNumber } from '@/lib/paystack';

/**
 * POST /api/paystack/verify-account
 * Verifies a bank account number using Paystack's resolve endpoint
 * Requires both account number and bank code
 */
export async function POST(request: NextRequest) {
    try {
        if (!process.env.PAYSTACK_SECRET_KEY) {
            console.error('PAYSTACK_SECRET_KEY is missing in environment variables');
            return NextResponse.json(
                { error: 'Server configuration error: Paystack secret key is missing.' },
                { status: 500 }
            );
        }

        const { accountNumber, bankCode } = await request.json();

        if (!accountNumber || !bankCode) {
            return NextResponse.json(
                { error: 'Account number and bank code are required' },
                { status: 400 }
            );
        }

        if (accountNumber.length !== 10) {
            return NextResponse.json(
                { error: 'Account number must be 10 digits' },
                { status: 400 }
            );
        }

        // Verify with Paystack
        const accountDetails = await resolveAccountNumber(accountNumber, bankCode);

        return NextResponse.json({
            accountName: accountDetails.account_name,
            accountNumber: accountDetails.account_number,
            bankId: accountDetails.bank_id,
        });
    } catch (error) {
        console.error('Account verification error:', error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : 'Could not verify account. Please check the details.',
            },
            { status: 400 }
        );
    }
}
