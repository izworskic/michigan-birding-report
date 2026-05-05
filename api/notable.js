/**
 * api/notable.js: Notable/rare bird sightings across Michigan
 * Returns recent notable sightings with images
 */

const { getNotableSightings } = require('../lib/ebird');
const { getBestImage } = require('../lib/media');

module.exports = async (req, res) => {
  try {
    const region = req.query.region || 'US-MI';
    const back = parseInt(req.query.back) || 7;

    const sightings = await getNotableSightings(region, { back, maxResults: 60 });

    // Deduplicate by species (keep most recent)
    const seen = new Map();
    for (const s of sightings) {
      if (!seen.has(s.speciesCode)) {
        seen.set(s.speciesCode, s);
      }
    }

    const unique = Array.from(seen.values()).slice(0, 30);

    // Attach images
    const enriched = await Promise.all(
      unique.map(async (s) => {
        const img = await getBestImage(s.speciesCode, s.comName);
        return {
          speciesCode: s.speciesCode,
          comName: s.comName,
          sciName: s.sciName,
          locName: s.locName,
          obsDt: s.obsDt,
          howMany: s.howMany || null,
          lat: s.lat,
          lng: s.lng,
          obsValid: s.obsValid,
          obsReviewed: s.obsReviewed,
          locationPrivate: s.locationPrivate,
          subnational2Code: s.subnational2Code,
          image: img,
        };
      })
    );

    res.status(200).json({
      region,
      back,
      count: enriched.length,
      updated: new Date().toISOString(),
      sightings: enriched,
    });
  } catch (err) {
    console.error('Notable API error:', err);
    res.status(500).json({ error: err.message });
  }
};
