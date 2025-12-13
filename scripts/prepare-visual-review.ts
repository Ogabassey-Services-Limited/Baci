import fs from 'fs';
import path from 'path';

const imageDir = path.resolve(process.cwd(), 'orphaned_images_full');
const files = fs.readdirSync(imageDir).filter(f => f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg'));

// Create batches of 20 images
const batchSize = 20;
const batches = [];
for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
}

console.log(`Found ${files.length} images. Created ${batches.length} batches.`);

// Create a markdown file to display images for visual inspection
let markdownContent = `# Orphaned Image Identification\n\n`;

batches.forEach((batch, batchIndex) => {
    markdownContent += `## Batch ${batchIndex + 1}\n\n`;
    markdownContent += `\`\`\`carousel\n`;

    batch.forEach((file, index) => {
        const filePath = path.join(imageDir, file);
        markdownContent += `![${file}](${filePath})\n`;
        markdownContent += `> **File:** \`${file}\`\n\n`;
        if (index < batch.length - 1) {
            markdownContent += `<!-- slide -->\n`;
        }
    });

    markdownContent += `\`\`\`\n\n`;
});

fs.writeFileSync('orphaned_images_review.md', markdownContent);
console.log('Created orphaned_images_review.md for visual inspection.');
