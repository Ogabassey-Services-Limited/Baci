async function extractBlock1() {
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
    if (jsonLdMatches.length > 0) {
      console.log(`BLOCK #1 CONTENT:`);
      console.log(jsonLdMatches[0][1].trim());
    }
  } catch (err: any) {
    console.error(err.message);
  }
}
extractBlock1().catch(console.error);
