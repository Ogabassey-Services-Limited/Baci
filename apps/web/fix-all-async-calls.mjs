#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptsDir = path.join(__dirname, 'scripts');

// Get all TypeScript files
const files = fs
  .readdirSync(scriptsDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => path.join(scriptsDir, f));

console.log(`📝 Processing ${files.length} TypeScript files...`);

let fixedCount = 0;
let skippedCount = 0;
const fixedFiles = [];

for (const filePath of files) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;

    // Pattern: Match function call at the end of file without .catch()
    // Look for: functionName(); at the end (possibly with trailing whitespace)
    // But NOT if it's already followed by .catch(

    const lines = content.split('\n');
    const lastNonEmptyLineIndex = lines.findLastIndex(
      (line) => line.trim() !== ''
    );

    if (lastNonEmptyLineIndex === -1) {
      skippedCount++;
      continue;
    }

    const lastLine = lines[lastNonEmptyLineIndex];

    // Check if last line is a simple function call: functionName();
    const simpleFunctionCallMatch = lastLine.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\(\);?\s*$/
    );

    if (simpleFunctionCallMatch) {
      const funcName = simpleFunctionCallMatch[1];

      // Check if this file already has .catch() - if so, skip
      if (content.includes('.catch((error) =>')) {
        // Check if the .catch is for THIS function call
        const alreadyFixed = content.includes(`${funcName}().catch(`);
        if (alreadyFixed) {
          skippedCount++;
          continue;
        }
      }

      // Replace the last line with proper error handling
      lines[lastNonEmptyLineIndex] = `${funcName}().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});`;

      content = lines.join('\n');

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        fixedCount++;
        fixedFiles.push(path.basename(filePath));
        console.log(`✅ Fixed: ${path.basename(filePath)} (${funcName})`);
      }
    } else {
      skippedCount++;
    }
  } catch (error) {
    console.error(
      `❌ Error processing ${path.basename(filePath)}:`,
      error.message
    );
  }
}

console.log(`\n📊 Summary:`);
console.log(`   ✅ Fixed: ${fixedCount} files`);
console.log(`   ⏭️  Skipped: ${skippedCount} files`);
console.log(`   📁 Total processed: ${files.length} files`);

if (fixedFiles.length > 0) {
  console.log(`\n📝 Fixed files:`);
  for (const f of fixedFiles) {
    console.log(`   - ${f}`);
  }
}
