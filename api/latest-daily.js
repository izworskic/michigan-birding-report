const DAILY_SITE = 'https://daily.michiganbirdingreport.com';

function cleanTitle(s) {
  return String(s || '')
    .replace(/\s*\|\s*Michigan Birding Daily\s*$/i, '')
    .replace(/^Chris Izworski:\s*/i, '')
    .trim();
}

module.exports = async (req, res) => {
  try {
    const sitemap = await fetch(`${DAILY_SITE}/sitemap.xml`, {
      headers: { 'User-Agent': 'MichiganBirdingReport/1.0 (michiganbirdingreport.com)' },
    });
    if (!sitemap.ok) throw new Error(`Daily sitemap returned ${sitemap.status}`);

    const xml = await sitemap.text();
    const posts = [...xml.matchAll(/<loc>(https:\/\/daily\.michiganbirdingreport\.com\/post\/[^<]+)<\/loc>/g)]
      .map(m => m[1]);

    let url = posts[0] || `${DAILY_SITE}/`;
    let title = 'Latest Michigan Birding Daily report';
    let date = null;

    if (posts[0]) {
      try {
        const page = await fetch(posts[0], {
          headers: { 'User-Agent': 'MichiganBirdingReport/1.0 (michiganbirdingreport.com)' },
        });
        if (page.ok) {
          const html = await page.text();
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
          title = cleanTitle((h1Match?.[1] || titleMatch?.[1] || title).replace(/<[^>]+>/g, ''));
        }
      } catch (e) {
        // Fall back to a readable title when the article page is temporarily unavailable.
      }
      const slugDate = posts[0].match(/\/post\/(\d{4}-\d{2}-\d{2})-/)?.[1];
      date = slugDate || null;
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({
      title,
      url,
      date,
      source: 'Michigan Birding Daily',
    });
  } catch (err) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({
      title: 'Michigan Birding Daily',
      url: `${DAILY_SITE}/`,
      date: null,
      source: 'Michigan Birding Daily',
      fallback: true,
    });
  }
};
