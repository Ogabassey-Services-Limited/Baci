import fs from 'fs';

interface HPLaptop {
    productSlug: string;
    [key: string]: unknown;
}

const allHp: HPLaptop[] = JSON.parse(fs.readFileSync('hp_laptop_images.json', 'utf-8'));

const elitebooks = allHp.filter((p) => p.productSlug.includes('elitebook'));

console.log(`Found ${elitebooks.length} EliteBooks in sitemap.`);
console.log('--- List of Slugs ---');
elitebooks.forEach((p) => console.log(p.productSlug));
