import fs from 'fs';

const allHp = JSON.parse(fs.readFileSync('hp_laptop_images.json', 'utf-8'));

const elitebooks = allHp.filter((p: any) => p.productSlug.includes('elitebook'));

console.log(`Found ${elitebooks.length} EliteBooks in sitemap.`);
console.log('--- List of Slugs ---');
elitebooks.forEach((p: any) => console.log(p.productSlug));
