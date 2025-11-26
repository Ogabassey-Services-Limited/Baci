/**
 * Simple Go54 API Test
 * Tests basic connectivity and authentication
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import crypto from 'crypto';

config({ path: resolve(process.cwd(), '.env.local') });

const GO54_EMAIL = process.env.GO54_EMAIL || '';
const GO54_API_KEY = process.env.GO54_API_KEY || '';
const GO54_BASE_URL = 'https://whogohost.com/host/modules/addons/DomainsReseller/api/index.php';

console.log('🔧 Simple Go54 API Test\n');
console.log('='.repeat(50));

// Check environment
console.log('\n1️⃣  Environment Variables:');
console.log(`   GO54_EMAIL: ${GO54_EMAIL || '❌ NOT SET'}`);
console.log(`   GO54_API_KEY: ${GO54_API_KEY ? '✅ SET (length: ' + GO54_API_KEY.length + ')' : '❌ NOT SET'}`);

if (!GO54_EMAIL || !GO54_API_KEY) {
  console.error('\n❌ Missing credentials!\n');
  process.exit(1);
}

// Generate token
console.log('\n2️⃣  Generating Authentication Token:');
const now = new Date();
const year = now.getUTCFullYear().toString().slice(2);
const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
const day = now.getUTCDate().toString().padStart(2, '0');
const hour = now.getUTCHours().toString().padStart(2, '0');

const dateStr = `${year}-${month}-${day} ${hour}`;
const message = `${GO54_EMAIL}:${dateStr}`;

console.log(`   Message: ${message}`);

// This is API token generation, NOT password hashing. HMAC-SHA256 is appropriate here because:
// 1. This creates short-lived authentication tokens (hour-based expiry)
// 2. The API key is a shared secret for request signing, not a user password
// 3. This follows the Go54 API specification exactly
// lgtm[js/insufficient-password-hash]
const hash = crypto.createHmac('sha256', message).update(GO54_API_KEY).digest('hex');
const token = Buffer.from(hash).toString('base64');

console.log(`   Token (first 20 chars): ${token.substring(0, 20)}...`);

// Test 1: Simple GET request to check API is reachable
console.log('\n3️⃣  Testing API Endpoint Reachability:');
console.log(`   URL: ${GO54_BASE_URL}`);

async function testAPI() {
  try {
    console.log('\n4️⃣  Making Test Request...');
    console.log('   Endpoint: /domains/lookup');
    console.log('   Method: POST');
    console.log(`   Headers: { username: "${GO54_EMAIL}", token: "..." }`);

    const testParams = new URLSearchParams({
      searchTerm: 'test',
      punnyCodeSearchTerm: 'test',
      tldsToInclude: JSON.stringify(['.com']),
      isIdnDomain: 'false',
      premiumEnabled: 'false',
    });

    const response = await fetch(`${GO54_BASE_URL}/domains/lookup`, {
      method: 'POST',
      headers: {
        'username': GO54_EMAIL,
        'token': token,
      },
      body: testParams,
    });

    console.log(`\n5️⃣  Response Received:`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   OK: ${response.ok}`);

    const responseText = await response.text();
    console.log(`\n6️⃣  Response Body:`);

    try {
      const jsonData = JSON.parse(responseText);
      console.log(JSON.stringify(jsonData, null, 2));

      if (jsonData.error) {
        console.log('\n❌ API Error Received:');
        console.log(`   ${jsonData.error}`);

        if (jsonData.error.includes('IP')) {
          console.log('\n💡 This is an IP whitelist error.');
          console.log('   Action needed: Contact WhoGoHost to whitelist your IP');
        } else if (jsonData.error.includes('Authentication') || jsonData.error.includes('Invalid')) {
          console.log('\n💡 This is an authentication error.');
          console.log('   Check your API credentials');
        }
      } else {
        console.log('\n✅ Success! API is working!');
      }
    } catch (_e) {
      console.log('   Raw response (not JSON):');
      console.log('   ' + responseText.substring(0, 200));
    }

  } catch (error: unknown) {
    console.log('\n❌ Request Failed:');
    if (error instanceof Error) {
      console.log(`   ${error.message}`);

      if (error.message.includes('fetch')) {
        console.log('\n💡 Network error - check your internet connection');
      }
    } else {
      console.log(`   ${String(error)}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Test complete!\n');
}

testAPI();
