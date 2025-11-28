# Custom Domain Setup Guide

This guide explains how to set up custom domain functionality for Baci using Go54's domain reseller API.

## Prerequisites

1. **Go54 Reseller Account**
   - Sign up at: https://www.whogohost.com/domains/domain-reseller
   - Wait for account activation (1-2 business days)
   - You'll receive API credentials via email

2. **Funded Account**
   - Go54 uses an "Advance Deposit" system
   - You must pre-fund your account before purchasing domains
   - Minimum recommended deposit: ₦50,000 - ₦100,000

## Environment Variables

Add these to your `.env.local` file:

```bash
# Go54 Domain Reseller API
GO54_EMAIL=your-email@example.com
GO54_API_KEY=your-api-key-here

# Root domain for subdomain routing (optional)
NEXT_PUBLIC_ROOT_DOMAIN=baci.tech
```

### How to Get Your API Credentials

1. Log in to your Go54 reseller account
2. Navigate to **API Settings** or **Reseller Settings**
3. Copy your **API Key**
4. Your email is the one you used to sign up

## Database Setup

Run the migration to create the domains table:

```bash
# Using Supabase CLI
supabase db push

# Or manually run the migration
psql $DATABASE_URL < supabase/migrations/20251122000002_create_domains_table.sql
```

This creates:
- `domains` table for storing domain configurations
- `slug` column in `merchants` table for subdomain routing
- RLS policies for secure access
- Triggers for automatic primary domain management

## Domain Pricing

All prices are in Nigerian Naira (NGN) per year.

### Nigerian Domains (40% markup)

| TLD | Cost Price | Sell Price | Your Profit |
|-----|------------|------------|-------------|
| .name.ng | ₦500 | ₦700 | ₦200 |
| .com.ng | ₦5,999 | ₦8,399 | ₦2,400 |
| .org.ng | ₦7,200 | ₦10,080 | ₦2,880 |
| .net.ng | ₦7,200 | ₦10,080 | ₦2,880 |
| .ng | ₦15,600 | ₦21,840 | ₦6,240 |
| .edu.ng | ₦15,600 | ₦21,840 | ₦6,240 |

### Global Domains (30% markup)

| TLD | Cost Price | Sell Price | Your Profit |
|-----|------------|------------|-------------|
| .org | ₦14,000 | ₦18,200 | ₦4,200 |
| .com | ₦14,999 | ₦19,499 | ₦4,500 |
| .info | ₦16,200 | ₦21,060 | ₦4,860 |
| .biz | ₦18,000 | ₦23,400 | ₦5,400 |
| .net | ₦29,000 | ₦37,700 | ₦8,700 |

### Premium Domains (20% markup)

| TLD | Cost Price | Sell Price | Your Profit |
|-----|------------|------------|-------------|
| .store | ₦50,000 | ₦60,000 | ₦10,000 |

## Features Implemented

### ✅ Domain Search
- Check availability for all supported TLDs
- View pricing for each domain
- Recommended and popular domain suggestions

### ✅ Domain Purchase
- Purchase domains through Go54 API
- Automatic registration with merchant details
- WHOIS privacy protection included
- DNS management enabled

### ✅ Custom Domain (BYOD - Bring Your Own Domain)
- Add domains you already own
- DNS verification via TXT record
- SSL certificate provisioning

### ✅ Domain Management
- View all domains in dashboard
- Set primary domain
- Check expiry dates
- Manage DNS settings
- Auto-renewal configuration

### ✅ DNS Records Management
- Get/update DNS records (A, AAAA, CNAME, MX, TXT, NS, SRV)
- Configure DNS zone for custom domains
- Full control over domain DNS settings

### ✅ Email Forwarding
- Set up email forwarding from custom domain
- Support for multiple forwarding rules
- Catch-all email forwarding option

### ✅ ID Protection (WHOIS Privacy)
- Enable/disable WHOIS privacy protection
- Protect personal information in domain registration
- Toggle privacy settings after domain registration

### ✅ Custom Domain Routing
- Middleware automatically routes custom domains to merchant storefronts
- Supports both subdomain (merchant.baci.tech) and custom domains (merchant.com)
- SSL/HTTPS support via hosting provider

## How It Works

### 1. Subdomain Routing (Free)
- Merchant: "Oga Bassey"
- Slug: `ogabassey`
- URL: `ogabassey.baci.tech`
- Middleware rewrites to: `/storefront/ogabassey`

### 2. Custom Domain (BYOD)
- Merchant adds: `ogastore.com`
- Adds TXT record for verification: `_baci-verification=<token>`
- After verification, domain marked as active
- Middleware routes `ogastore.com` → `/storefront/ogabassey`

### 3. Purchased Domain
- Merchant searches for `ogastore.com.ng`
- Pays ₦8,399 via Paystack
- System calls Go54 API to register domain
- Domain automatically configured and active
- Middleware routes `ogastore.com.ng` → `/storefront/ogabassey`

## API Endpoints

### Check Domain Availability
```bash
POST /api/domains/check-availability
{
  "searchTerm": "mystore",
  "tlds": [".com", ".com.ng", ".ng"] # optional
}
```

### Purchase Domain
```bash
POST /api/domains/purchase
{
  "domain": "mystore.com.ng",
  "years": 1,
  "contactInfo": { ... }, # optional
  "paymentVerified": true
}
```

### List Merchant Domains
```bash
GET /api/domains
```

### Add Custom Domain
```bash
POST /api/domains
{
  "domain": "mystore.com",
  "isPrimary": false
}
```

### Get DNS Records
```bash
GET /api/domains/[domain]/dns
```

### Update DNS Records
```bash
POST /api/domains/[domain]/dns
{
  "records": [
    {
      "type": "A",
      "name": "@",
      "value": "192.0.2.1",
      "ttl": 3600
    },
    {
      "type": "CNAME",
      "name": "www",
      "value": "example.com",
      "ttl": 3600
    }
  ]
}
```

### Get Email Forwarding
```bash
GET /api/domains/[domain]/email-forwarding
```

### Update Email Forwarding
```bash
POST /api/domains/[domain]/email-forwarding
{
  "forwards": [
    {
      "prefix": "info",
      "forwardto": "basseybjohn@gmail.com"
    },
    {
      "prefix": "*",
      "forwardto": "basseybjohn@gmail.com"
    }
  ]
}
```

### Get ID Protection Status
```bash
GET /api/domains/[domain]/id-protection
```

### Toggle ID Protection
```bash
POST /api/domains/[domain]/id-protection
{
  "enabled": true
}
```

## Testing Without Go54 Credentials

The domain search endpoint will still work without Go54 credentials:
- Returns pricing for all TLDs
- Shows domains as "available" (assumes availability)
- Warning message indicates API not configured

To test with real availability checks, you need valid Go54 credentials.

## Next Steps

### Before Going Live:

1. **Get Go54 Credentials**
   - Sign up for reseller account
   - Get API credentials
   - Fund account with initial deposit

2. **Configure Environment**
   - Add `GO54_EMAIL` and `GO54_API_KEY` to `.env.local`
   - Verify connection by testing domain search

3. **Set Up Payment**
   - Integrate Paystack for domain purchases
   - Add payment verification to purchase flow
   - Set up webhooks for payment confirmation

4. **Configure DNS**
   - Set up nameservers for custom domains
   - Configure DNS zone for baci.tech
   - Set up wildcard SSL certificate for *.baci.tech

5. **Test Flow**
   - Search for available domains
   - Purchase a cheap domain (.name.ng for ₦700)
   - Verify registration in Go54 dashboard
   - Test custom domain routing

## Troubleshooting

### "Go54 API credentials not configured"
- Add `GO54_EMAIL` and `GO54_API_KEY` to `.env.local`
- Restart development server

### "Failed to register domain"
- Check Go54 account balance
- Verify API credentials are correct
- Check Go54 API status
- Review error logs for details

### "Domain already registered"
- Domain is taken by another merchant or in Go54
- Try a different domain name

### Custom domain not routing
- Check domain is marked as "active" in database
- Verify middleware is running
- Check DNS is pointed to Baci
- Clear browser cache

## Support

For Go54 API issues:
- Email: Technical@whogohost.com
- Website: https://go54.com
- Docs: https://api-docs.go54.com

For Baci implementation questions:
- Check the code comments in `/src/lib/go54.ts`
- Review API routes in `/src/app/api/domains/`
- See middleware logic in `/src/middleware.ts`
