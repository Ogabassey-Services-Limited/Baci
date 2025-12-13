import fs from 'fs';

const items = JSON.parse(fs.readFileSync('sourcing_wishlist.json', 'utf-8'));

const LAPTOP_KEYWORDS = [
    'macbook', 'latitude', 'elitebook', 'probook', 'thinkpad', 'xps', 'inspiron',
    'precision', 'surface', 'zenbook', 'yoga', 'ideapad', 'envy', 'pavilion',
    'laptop', 'notebook', 'chromebook'
];

const laptopItems = items.filter(item => {
    const name = item.productName.toLowerCase();
    return LAPTOP_KEYWORDS.some(kw => name.includes(kw));
});

console.log(`original: ${items.length}`);
console.log(`laptops: ${laptopItems.length}`);

fs.writeFileSync('sourcing_wishlist_laptops.json', JSON.stringify(laptopItems, null, 2));

// Print top 10 for review
console.log("Top 10 Laptops:");
laptopItems.slice(0, 10).forEach(i => console.log(`- ${i.productName}`));
