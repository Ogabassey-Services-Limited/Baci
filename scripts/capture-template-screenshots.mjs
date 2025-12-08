#!/usr/bin/env node
/**
 * Template Screenshot Capture Script
 *
 * This script automatically captures screenshots of all template preview pages
 * and saves them to /public/template-previews/
 *
 * Usage:
 *   npm run capture-screenshots
 *   # or
 *   node scripts/capture-template-screenshots.mjs
 *
 * Requirements:
 *   - Dev server running on localhost:3000
 *   - Puppeteer installed: npm install puppeteer --save-dev
 */

import puppeteer from 'puppeteer';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'template-previews');

// Templates to capture (from registry)
// Change this to only capture specific templates if needed
const TEMPLATES = process.argv.slice(2).length > 0
  ? process.argv.slice(2) // Capture specific templates if passed as arguments
  : [
    'electronics',
    'fashion',
    'home-goods',
    'food-beverage',
    'health-beauty',
    'hair-extensions',
    'pharmaceuticals',
    'gadget-universe',
    'ogabassey-v2',
    'gadgets-pro',
    'handmade',
    // Draft templates (optional)
    // 'lumina',
    // 'modern',
  ];

const BASE_URL = 'http://localhost:3000';
const VIEWPORT = { width: 1440, height: 900 };
const WAIT_TIME = 5000; // Wait for page to fully render

async function captureScreenshot(browser, templateId) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  const url = `${BASE_URL}/template-preview/${templateId}`;
  console.log(`📸 Capturing: ${templateId}`);
  console.log(`   URL: ${url}`);

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for content to fully render
    await new Promise(resolve => setTimeout(resolve, WAIT_TIME));

    // Hide the preview action bar at the bottom for cleaner screenshot
    await page.evaluate(() => {
      const actionBar = document.querySelector('.fixed.bottom-0');
      if (actionBar) {
        actionBar.style.display = 'none';
      }
    });

    const outputPath = join(OUTPUT_DIR, `${templateId}.png`);
    await page.screenshot({
      path: outputPath,
      type: 'png',
      fullPage: false, // Just viewport, not full page scroll
    });

    console.log(`   ✅ Saved: ${outputPath}`);
    return { templateId, success: true };
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return { templateId, success: false, error: error.message };
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('🚀 Template Screenshot Capture Script');
  console.log('=====================================\n');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}\n`);
  }

  // Check if dev server is running
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) {
      throw new Error('Server not responding');
    }
  } catch (error) {
    console.error('❌ Error: Dev server is not running on localhost:3000');
    console.error('   Please start it with: npm run dev\n');
    process.exit(1);
  }

  console.log(`✅ Dev server is running on ${BASE_URL}\n`);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  console.log(`📋 Capturing ${TEMPLATES.length} templates...\n`);

  const results = [];

  for (const templateId of TEMPLATES) {
    const result = await captureScreenshot(browser, templateId);
    results.push(result);
    console.log('');
  }

  await browser.close();

  // Summary
  console.log('\n=====================================');
  console.log('📊 Summary');
  console.log('=====================================\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${TEMPLATES.length}`);

  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.templateId}: ${r.error}`);
    });
  }

  console.log('\n🎉 Done!\n');

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
