/**
 * Runner script that coordinates the Samsung spec population
 * This demonstrates the workflow for the agent
 */

import {
  getSamsungPhonesWithoutSpecs,
  parseGSMArenaSpecs,
  insertSpecs,
  getGSMArenaSearchUrl,
} from './agent-populate-samsung-specs';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Samsung Spec Population Runner ===\n');

  try {
    // Step 1: Get products
    const products = await getSamsungPhonesWithoutSpecs();

    if (products.length === 0) {
      console.log('✅ All Samsung phones already have specs!');
      return;
    }

    console.log(`\nFound ${products.length} products to process:\n`);

    // Display products with search URLs
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   GSM Arena: ${getGSMArenaSearchUrl(product.name)}\n`);
    });

    console.log('--- AGENT INSTRUCTIONS ---');
    console.log('For each product above, the agent should:');
    console.log('1. Use WebFetch to get GSM Arena search results');
    console.log('2. Parse specs using parseGSMArenaSpecs()');
    console.log('3. Insert using insertSpecs()');
    console.log('4. Wait 5 seconds before next request');
    console.log('\nReady for agent execution!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
