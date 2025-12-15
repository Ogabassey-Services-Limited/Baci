/**
 * Go54 API Integration Test Script
 *
 * This script tests the Go54 domain reseller API integration
 * Run with: npx tsx scripts/test-go54.ts
 */

// Load environment variables from .env.local FIRST
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

// Verify environment variables loaded
console.log('🔍 Checking environment variables...');
console.log(`GO54_EMAIL: ${process.env.GO54_EMAIL ? '✅ Set' : '❌ Not set'}`);
console.log(`GO54_API_KEY: ${process.env.GO54_API_KEY ? '✅ Set (length: ' + process.env.GO54_API_KEY.length + ')' : '❌ Not set'}`);
console.log('');

if (!process.env.GO54_EMAIL || !process.env.GO54_API_KEY) {
  console.error('❌ Environment variables not loaded!');
  console.error('Make sure .env.local exists and has GO54_EMAIL and GO54_API_KEY uncommented');
  process.exit(1);
}

async function testGo54Integration() {
  // Dynamic import AFTER env is loaded
  const { checkDomainAvailability } = await import('../src/lib/go54.js');

  console.log('🧪 Testing Go54 API Integration\n');
  console.log('================================================\n');

  // Test 1: Authentication (implicit in all requests)
  console.log('Test 1: Authentication & Domain Availability Check');
  console.log('--------------------------------------------------');
  try {
    const testDomain = 'test-' + Date.now(); // Random domain to check
    console.log(`Checking availability for: ${testDomain}.com\n`);

    const results = await checkDomainAvailability(testDomain, ['.com', '.ng', '.com.ng']);

    console.log('✅ Authentication successful!');
    console.log('📊 Domain availability results:');
    console.log(JSON.stringify(results, null, 2));
    console.log('\n');
  } catch (error: unknown) {
    console.error('❌ Test 1 Failed:');
    if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('Error:', String(error));
    }
    console.error('\nPossible issues:');
    console.error('- API credentials are incorrect');
    console.error('- Network connectivity issue');
    console.error('- Go54 API endpoint changed');
    console.error('\nFull error:', error);
    console.log('\n');
    process.exit(1);
  }

  // Test 2: Check specific domain (if you have one registered)
  console.log('Test 2: Get Domain Information (Optional)');
  console.log('--------------------------------------------------');
  console.log('ℹ️  Skipping - requires a registered domain');
  console.log('To test: Uncomment the code below and add your domain\n');

  /*
  const { getDomainNameservers } = await import('../src/lib/go54.js');
  try {
    const yourDomain = 'yourdomain.com'; // Replace with actual domain
    console.log(`Fetching nameservers for: ${yourDomain}\n`);

    const nameservers = await getDomainNameservers(yourDomain);
    console.log('✅ Nameservers retrieved:');
    console.log(JSON.stringify(nameservers, null, 2));
    console.log('\n');
  } catch (error) {
    console.error('❌ Test 2 Failed:', error instanceof Error ? error.message : String(error));
    console.log('\n');
  }
  */

  console.log('================================================');
  console.log('✅ All tests completed!\n');
  console.log('Next steps:');
  console.log('1. ✅ Authentication is working');
  console.log('2. ✅ Domain availability checking is working');
  console.log('3. 📝 Review the API response format');
  console.log('4. 🔧 Update TypeScript interfaces if needed');
  console.log('5. 🚀 Integrate into your application UI');
}

// Run tests
testGo54Integration().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
