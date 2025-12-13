import fs from 'fs';

// Load current matches
const matches = JSON.parse(fs.readFileSync('final_migration.json', 'utf-8'));

// Define bad matches to remove (by supabaseId or score-based rules)
const badMatches = [
    // Samsung S25 Plus matched to S20 Plus (wrong model)
    'e8a44e4d-5414-4a79-ab3d-d0b3af85a387',
    // PS4 Controller matched to Stadia Controller (wrong product)
    '5a733b6a-ce5e-4888-b7d8-612432743259',
    // Joy Con matched to CTr (completely wrong)
    'e57eff25-b0c2-42af-8aa6-1f92462ec80c',
    // Car Mechanic Simulator matched to Farming Simulator (wrong game)
    '7230fd22-413d-4621-9e50-76dec5f1d2f5',
    // Mortal Kombat XL matched to Mortal Kombat 1 (different game)
    '8900d5d7-cf22-4d82-a7bd-9f493614a623',
    // Dell Latitude 5310 matched to 3410 (different model - borderline but keeping it out)
    '10a81b5f-94d3-4046-b993-901e93e4be94',
];

const cleanedMatches = matches.filter((m: any) => !badMatches.includes(m.supabaseId));

console.log(`Original matches: ${matches.length}`);
console.log(`After cleanup: ${cleanedMatches.length}`);
console.log(`Removed: ${matches.length - cleanedMatches.length}`);

fs.writeFileSync('final_migration_cleaned.json', JSON.stringify(cleanedMatches, null, 2));
console.log('\n✅ Saved to final_migration_cleaned.json');

// Print confirmed matches
console.log('\n📋 Confirmed Matches:');
cleanedMatches.forEach((m: any) => {
    console.log(`  • ${m.oldProductName} → ${m.supabaseName}`);
});
