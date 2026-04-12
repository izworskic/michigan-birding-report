/**
 * api/sounds.js — Bird sounds from Xeno-canto API v3
 * Returns song/call recordings for a given species
 */

const { Redis } = require('@upstash/redis');

const XC_KEY = process.env.XENOCANTO_API_KEY || '0f4687bd8bc5990130ba747b2bae175d7febe290';
const CACHE_TTL = 86400 * 7; // 7 days for sounds

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
    const species = req.query.species; // scientific name e.g. "Setophaga kirtlandii"
    const type = req.query.type || 'song'; // song, call, alarm
    const maxResults = Math.min(parseInt(req.query.max) || 3, 10);

    if (!species) {
      return res.status(400).json({ error: 'species parameter required (scientific name)' });
    }

    const cacheKey = `birding:xc:${species}:${type}`;

    try {
      const r = getRedis();
      const cached = await r.get(cacheKey);
      if (cached) {
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.status(200).json(data);
      }
    } catch (e) { /* continue */ }

    const query = `sp:"${species}" type:${type} q:A`;
    const url = `https://xeno-canto.org/api/3/recordings?query=${encodeURIComponent(query)}&key=${XC_KEY}`;

    const xcRes = await fetch(url);
    if (!xcRes.ok) {
      throw new Error(`Xeno-canto API ${xcRes.status}`);
    }

    const xcData = await xcRes.json();
    const recordings = (xcData.recordings || []).slice(0, maxResults).map(r => ({
      id: r.id,
      type: r.type,
      duration: r.length,
      country: r.cnt,
      location: r.loc,
      date: r.date,
      audioUrl: r.file,
      recordist: r.rec,
      license: r.lic,
      quality: r.q,
      sono: r.sono?.small || null,
    }));

    const result = {
      species,
      type,
      count: recordings.length,
      totalAvailable: parseInt(xcData.numRecordings) || 0,
      recordings,
    };

    try {
      const r = getRedis();
      await r.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });
    } catch (e) { /* continue */ }

    res.status(200).json(result);
  } catch (err) {
    console.error('Sounds API error:', err);
    res.status(500).json({ error: err.message });
  }
};
