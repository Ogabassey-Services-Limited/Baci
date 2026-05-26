async function extractSchema() {
  const url = 'https://ogabassey.com';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const html = await res.text();
    const jsonLdMatches = [
      ...html.matchAll(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      ),
    ];
    console.log(`Found ${jsonLdMatches.length} JSON-LD blocks.`);

    jsonLdMatches.forEach((m, idx) => {
      console.log(`\n---------------- BLOCK #${idx + 1} ----------------`);
      console.log(m[1].trim());
    });
  } catch (err: any) {
    console.error(err.message);
  }
}
extractSchema().catch(console.error);
