import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  calculateDomainPrice,
  getDomainPricing,
} from '@/config/domain-pricing';
import { type ContactInfo, registerDomain } from '@/lib/go54';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/domains/purchase
 * Purchase a domain through Go54
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { domain, years = 1, contactInfo } = await request.json();

    // Validate domain - using required separator [.-] instead of optional [-.]?
    // to prevent ReDoS (exponential backtracking) vulnerability
    const domainRegex = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
        { status: 400 }
      );
    }

    // Extract TLD and get pricing
    let tld = `.${domain.split('.').slice(-1)[0]}`;
    if (
      domain.endsWith('.com.ng') ||
      domain.endsWith('.org.ng') ||
      domain.endsWith('.net.ng') ||
      domain.endsWith('.edu.ng') ||
      domain.endsWith('.name.ng')
    ) {
      tld = `.${domain.split('.').slice(-2).join('.')}`;
    }

    const pricing = getDomainPricing(tld);
    if (!pricing) {
      return NextResponse.json({ error: 'Unsupported TLD' }, { status: 400 });
    }

    const priceCalculation = calculateDomainPrice(tld, years);
    if (!priceCalculation) {
      return NextResponse.json(
        { error: 'Unable to calculate price' },
        { status: 400 }
      );
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // TODO: Verify payment via Paystack before proceeding
    // if (!paymentVerified) {
    //   return NextResponse.json({ error: 'Payment not verified' }, { status: 402 });
    // }

    // Check if domain already exists
    const { data: existingDomain } = await supabase
      .from('domains')
      .select('id')
      .eq('domain', domain)
      .single();

    if (existingDomain) {
      return NextResponse.json(
        { error: 'This domain is already registered' },
        { status: 409 }
      );
    }

    // Prepare contact information
    // Validate required contact information before proceeding
    const resolvedFirstname =
      contactInfo?.firstname || merchant.business_name?.split(' ')[0] || '';
    const resolvedLastname =
      contactInfo?.lastname || merchant.business_name?.split(' ')[1] || '';
    const resolvedFullname =
      contactInfo?.fullname || merchant.business_name || '';
    const resolvedEmail =
      contactInfo?.email || merchant.email || user.email || '';
    const resolvedAddress1 = contactInfo?.address1 || '';
    const resolvedCity = contactInfo?.city || '';
    const resolvedState = contactInfo?.state || '';
    const resolvedZipcode = contactInfo?.zipcode || '';
    const resolvedCountry = merchant.country || '';
    const resolvedPhonenumber = contactInfo?.phonenumber || '';
    if (
      !resolvedFirstname ||
      !resolvedLastname ||
      !resolvedFullname ||
      !resolvedEmail ||
      !resolvedAddress1 ||
      !resolvedCity ||
      !resolvedState ||
      !resolvedZipcode ||
      !resolvedCountry ||
      !resolvedPhonenumber
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required contact information. Please provide all required fields.',
        },
        { status: 400 }
      );
    }
    const contacts: ContactInfo = {
      firstname: resolvedFirstname,
      lastname: resolvedLastname,
      fullname: resolvedFullname,
      companyname: merchant.business_name || '',
      email: resolvedEmail,
      address1: resolvedAddress1,
      address2: contactInfo?.address2 || '',
      city: resolvedCity,
      state: resolvedState,
      zipcode: resolvedZipcode,
      country: resolvedCountry,
      phonenumber: resolvedPhonenumber,
    };

    try {
      // Register domain via Go54
      const registrationResult = await registerDomain({
        domain,
        regperiod: years,
        contacts: {
          registrant: contacts,
          tech: contacts,
          billing: contacts,
          admin: contacts,
        },
        // Use default nameservers (can be updated later)
        nameservers: {
          ns1: 'ns1.whogohost.com',
          ns2: 'ns2.whogohost.com',
        },
        addons: {
          dnsmanagement: 1,
          emailforwarding: 0,
          idprotection: 1, // Enable WHOIS privacy
        },
      });

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + years);

      // Store domain in database
      const { data: newDomain, error: insertError } = await supabase
        .from('domains')
        .insert({
          merchant_id: merchant.id,
          domain,
          tld,
          domain_type: 'purchased',
          status: 'active',
          verified_at: new Date().toISOString(),
          purchase_info: {
            provider: 'go54',
            order_id: registrationResult.orderId,
            cost_price: priceCalculation.costPrice,
            sell_price: priceCalculation.sellPrice,
            profit: priceCalculation.profit,
            registered_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            auto_renew: true,
            nameservers: ['ns1.whogohost.com', 'ns2.whogohost.com'],
            years,
          },
          nameservers: ['ns1.whogohost.com', 'ns2.whogohost.com'],
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error storing domain:', insertError);
        return NextResponse.json(
          { error: 'Domain registered but failed to store in database' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        domain: newDomain,
        message: `Successfully registered ${domain} for ${years} year(s)`,
        nextSteps: [
          'Domain will be active within 24 hours',
          'You can configure DNS settings in the domain settings',
          'Point your domain to Baci by updating nameservers',
        ],
      });
    } catch (go54Error: unknown) {
      console.error('Go54 registration error:', go54Error);
      const errorMessage =
        go54Error instanceof Error ? go54Error.message : 'Unknown error';

      return NextResponse.json(
        {
          error: 'Failed to register domain with Go54',
          details: errorMessage,
          suggestion:
            'Please ensure Go54 API credentials are configured and account has sufficient balance',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error purchasing domain:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
