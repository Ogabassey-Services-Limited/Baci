import fs from 'fs';

const matches = JSON.parse(fs.readFileSync('hp_matched_images.json', 'utf-8'));
console.log(`Checking ${matches.length} candidates...`);

const validMatches = matches.filter((m: any) => {
    // Helper to extract series and gen
    const getModelInfo = (name: string) => {
        // Extract number like "840", "440", "640", "15"
        const seriesMatch = name.match(/(\d{3,4}|1[34567]\-[\w\d]+)/);
        // Extract Gen like "G8", "G9", "Gen 10"
        const genMatch = name.match(/G(\d+)|Gen\s*(\d+)/i);

        let series = seriesMatch ? seriesMatch[0] : '';
        let gen = genMatch ? (genMatch[1] || genMatch[2]) : '';

        // Clean series: "15-fa2013" -> "15" (too aggressive?), "840" -> "840"
        // Actually, for Victus "15-fa...", the sitemap slug is "15z-fb300". 
        // 15 matches 15. The rest might not match.
        // Let's rely on strict number matching for EliteBooks/ProBooks (3 digits).
        // Special handling for Victus/Omen
        if (name.toLowerCase().includes('victus')) {
            if (name.includes('15')) return { series: '15', gen: '' };
            if (name.includes('16')) return { series: '16', gen: '' };
        }

        if (series.length > 3 && series.includes('-')) {
            series = series.split('-')[0];
        }

        return { series, gen, size: name.includes('16-inch') ? '16' : (name.includes('14-inch') ? '14' : '') };
    };

    const our = getModelInfo(m.ourProductName);
    const hp = getModelInfo(m.hpProductSlug);

    // Victus/Omen check
    if (m.ourProductName.toLowerCase().includes('victus') || m.ourProductName.toLowerCase().includes('omen')) {
        // Victus 15 matches Victus 15 (or 15z, etc)
        if (our.series === hp.series || (our.series === '15' && m.hpProductSlug.includes('15z'))) {
            console.log(`✅ MATCH (Gaming): ${m.ourProductName} == ${m.hpProductSlug}`);
            return true;
        }
    }

    // EliteBook Mapping Logic (Research Backed)
    // New Convention: "EliteBook 840 G11" -> "EliteBook 8 G1i 14-inch"
    if (m.ourProductName.toLowerCase().includes('elitebook') || m.ourProductName.toLowerCase().includes('probook')) {

        let seriesMatch = false;
        const userSeriesPrefix = our.series.charAt(0); // "8" from "840"
        if (our.series === hp.series) {
            seriesMatch = true; // Exact match (e.g. 640 == 640)
        } else if (hp.series === userSeriesPrefix) {
            // Check size
            if (our.series.endsWith('40') && m.hpProductSlug.includes('14-inch')) seriesMatch = true;
            if (our.series.endsWith('60') && m.hpProductSlug.includes('16-inch')) seriesMatch = true;
            if (our.series.endsWith('30') && m.hpProductSlug.includes('13-inch')) seriesMatch = true;
        }

        // Gen Mapping: G11 == G1i or G1a or G1q
        // User has "G11". HP has "G1i". 
        // Logic: If User "G11", allow HP "G1*"
        let genMatch = false;
        if (our.gen === hp.gen) {
            genMatch = true;
        } else if (our.gen === '11' && (hp.gen.startsWith('1') && hp.gen.length > 1 || m.hpProductSlug.includes('g1'))) {
            // hp.gen might be "1i" or regex failed to pick "G1i".
            // Actually my regex `G(\d+)` treats G1i as G1? No, `\d+` only matches 1.
            // "G1i" -> G1. 
            // So if our="11" and hp="1", it might be valid if it's an AI PC.
            // Let's assume matches with score < 0.25 are decent potential.
            if (m.hpProductSlug.includes('g1')) genMatch = true;
        }

        if (seriesMatch && genMatch) {
            console.log(`✅ MATCH (Elite/Pro): ${m.ourProductName} == ${m.hpProductSlug}`);
            return true;
        }
    }

    // Default Strict rule
    const strictSeries = (our.series && hp.series) && (our.series === hp.series);
    const strictGen = (our.gen === hp.gen);

    if (strictSeries && strictGen) return true;

    // Log failure detail
    if (m.ourProductName.includes('EliteBook')) {
        console.log(`❌ FAIL: ${m.ourProductName} != ${m.hpProductSlug} (Series: ${our.series}/${hp.series}, Gen: ${our.gen}/${hp.gen})`);
    }

    return false;
});

console.log(`\nVerified ${validMatches.length} / ${matches.length} clean matches.`);
fs.writeFileSync('hp_verified_images.json', JSON.stringify(validMatches, null, 2));
