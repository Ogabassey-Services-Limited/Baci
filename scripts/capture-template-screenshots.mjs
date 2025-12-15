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

// Valid template ID pattern: alphanumeric and hyphens only (prevent path traversal)
const VALID_TEMPLATE_ID = /^[a-z0-9-]+$/i;

// Templates to capture (from registry)
// Change this to only capture specific templates if needed
const TEMPLATES = process.argv.slice(2).length > 0
  ? process.argv.slice(2).filter(id => VALID_TEMPLATE_ID.test(id)) // Validate CLI args
  : [
    'electronics',
    'fashion',
    'home-goods',
    'food-beverage',
    'health-beauty',
    'hair-extensions',
    'pharmaceuticals',
    'gadget-universe',
    'ogabassey',
    'gadgets-pro',
    'handmade',
    // Draft templates (optional)
    // 'lumina',
    // 'modern',
  ];

const BASE_URL = 'http://localhost:3000';
const VIEWPORT = { width: 1440, height: 900 };
const CONCURRENCY = 3; // Number of parallel screenshot captures

async function captureScreenshot(browser, templateId) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  if (!VALID_TEMPLATE_ID.test(templateId)) {
    throw new Error(`Invalid template ID: ${templateId}`);
  }

  const url = `${BASE_URL}/template-preview/${templateId}`;
  console.log(`📸 Capturing: ${templateId}`);
  console.log(`   URL: ${url}`);

  try {
    await page.goto(url, {
      waitUntil: 'networkidle2', // Wait for network to be idle
      timeout: 30000
    });

    // Small additional wait for any final animations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Hide the preview action bar at the bottom for cleaner screenshot
    await page.evaluate(() => {
      const actionBar = document.querySelector('.fixed.bottom-0');
      if (actionBar) {
        actionBar.style.display = 'none';
      }
    });

    // Path traversal protection: Ensure templateId was validated (already checked at line 58)
    // This defensive check prevents any bypasses if validation logic changes
    if (!VALID_TEMPLATE_ID.test(templateId)) {
      throw new Error(`Invalid template ID: ${templateId}`);
    }
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

  // Check if dev server is running with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(BASE_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error('Server not responding');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ Error: Dev server connection timed out');
    } else {
      console.error('❌ Error: Dev server is not running on localhost:3000');
    }
    console.error('   Please start it with: npm run dev\n');
    process.exit(1);
  }

  console.log(`✅ Dev server is running on ${BASE_URL}\n`);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  console.log(`📋 Capturing ${TEMPLATES.length} templates (${CONCURRENCY} at a time)...\n`);

  const results = [];

  // Process templates in parallel batches
  for (let i = 0; i < TEMPLATES.length; i += CONCURRENCY) {
    const batch = TEMPLATES.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(templateId => captureScreenshot(browser, templateId))
    );
    results.push(...batchResults);
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
