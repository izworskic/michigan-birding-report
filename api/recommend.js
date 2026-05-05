/**
 * api/recommend.js: Claude Haiku birding recommendations
 * Given current conditions, recommends where to bird and what to look for
 */

const { getNotableSightings, getRecentObservations } = require('../lib/ebird');
const { Redis } = require('@upstash/redis');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const CACHE_TTL = 3600; // 1 hour

let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    });
  }
  return redis;
}

module.exports = async (req, res) => {
  try {
    if (!ANTHROPIC_KEY) {
      return res.status(200).json({
        recommendation: getStaticRecommendation(),
        source: 'static',
      });
    }

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const cacheKey = `birding:recommend:${dateStr}`;

    // Check cache
    try {
      const r = getRedis();
      const cached = await r.get(cacheKey);
      if (cached) {
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.status(200).json({ ...data, source: 'cached' });
      }
    } catch (e) { /* continue */ }

    // Gather context
    const [notable, stateObs] = await Promise.all([
      getNotableSightings('US-MI', { back: 3, maxResults: 20 }).catch(() => []),
      getRecentObservations('US-MI', { back: 3, maxResults: 50 }).catch(() => []),
    ]);

    const notableList = notable.slice(0, 12).map(s =>
      `${s.comName} at ${s.locName} (${s.obsDt})`
    ).join('\n');

    const month = today.toLocaleDateString('en-US', { month: 'long' });
    const day = today.getDate();
    const speciesCount = stateObs.length;

    const prompt = `You are a Michigan birding expert writing a brief weekend birding forecast. Today is ${month} ${day}. ${speciesCount} species have been reported across Michigan in the past 3 days.

Recent notable sightings:
${notableList || 'No notable sightings in the past 3 days.'}

Write a concise, actionable birding recommendation for this weekend in Michigan. Include:
1. A one-sentence summary of current conditions
2. Top 2-3 specific locations to visit and why
3. 3-5 target species to look for right now
4. One practical tip

Keep it under 200 words. Write in a warm, knowledgeable tone. No bullet points or headers. Write in flowing paragraphs.`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      return res.status(200).json({
        recommendation: getStaticRecommendation(),
        source: 'static-fallback',
      });
    }

    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text || '';

    const result = {
      recommendation: text,
      date: dateStr,
      notableCount: notable.length,
      speciesCount,
    };

    // Cache
    try {
      const r = getRedis();
      await r.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });
    } catch (e) { /* continue */ }

    res.status(200).json({ ...result, source: 'haiku' });
  } catch (err) {
    console.error('Recommend API error:', err);
    res.status(200).json({
      recommendation: getStaticRecommendation(),
      source: 'static-error',
      error: err.message,
    });
  }
};

function getStaticRecommendation() {
  const month = new Date().getMonth();
  const recs = {
    0: 'January in Michigan means winter birding at its finest. Check the Saginaw Bay shoreline for Snowy Owls and scan open water for lingering waterfowl. Feeders are active with Black-capped Chickadees, White-breasted Nuthatches, and Downy Woodpeckers.',
    1: 'February brings the first hints of spring migration. Great Horned Owls are nesting now. Check the Shiawassee NWR for early waterfowl movement and scan agricultural fields for Horned Larks and Snow Buntings.',
    2: 'March migration is underway. Waterfowl are flooding into Saginaw Bay and the Shiawassee flats. Look for Tundra Swans, Northern Pintails, and the first Tree Swallows. Red-winged Blackbirds are staking territories in every marsh.',
    3: 'April is heating up. Shorebirds are moving through flooded fields. Warblers are arriving in southern Michigan. Check Tawas Point and Magee Marsh for early migrants. Sandhill Cranes are displaying in open fields statewide.',
    4: 'May is the month Michigan birders live for. Warbler waves are peaking mid-month. Hit Tawas Point, Whitefish Point, or any lakefront park at dawn. Target Blackburnian, Magnolia, and Cape May Warblers. Check the Mio area for Kirtland\'s Warbler tours.',
    5: 'June means breeding season. Kirtland\'s Warblers are singing on territory near Mio and Grayling. Common Loons are on northern lakes. Marsh birds are active at Nayanquing Point and Fish Point. Listen for Whip-poor-wills at dusk.',
    6: 'July shorebird migration begins surprisingly early. Check Saginaw Bay mudflats for returning Least and Semipalmated Sandpipers. Breeding warblers are still singing in the UP. Black Terns are nesting at Fish Point.',
    7: 'August shorebird migration is in full swing. Quanicassee and Nayanquing Point are productive for plovers and sandpipers. Early fall warblers are beginning to trickle through. Watch for migrating nighthawks at dusk.',
    8: 'September brings the hawk migration. Broad-winged Hawks kettle over ridgelines in mid-month. Sparrows are flooding through hedgerows. Check Tawas Point for fall warblers and Lake Erie Metropark for raptors.',
    9: 'October is peak raptor migration. Sharp-shinned and Cooper\'s Hawks stream through daily. Sparrow diversity peaks. Late warblers linger at Tawas Point. Waterfowl are beginning to stage on the Great Lakes.',
    10: 'November means waterfowl. Tens of thousands of ducks, geese, and swans concentrate on Saginaw Bay and Lake St. Clair. Scan for rare gulls at any Great Lakes pier. Late Sandhill Cranes push through.',
    11: 'December winter birding starts strong. Christmas Bird Counts run statewide. Check Saginaw Bay for Snowy Owls and winter finch irruptions in the UP. Feeders attract Pine Siskins, Common Redpolls, and Evening Grosbeaks in flight years.',
  };
  return recs[month] || recs[3];
}
