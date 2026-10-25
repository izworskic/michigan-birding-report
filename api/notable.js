/**
 * api/notable.js: Notable/rare bird sightings across Michigan
 * Returns recent notable sightings with images
 */

const { getNotableSightings } = require('../lib/ebird');

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

    // Keep observations fast. Browser lazy-loads verified, licensed reference
    // photos through /api/species-photo as cards enter the viewport.
    const enriched = unique.map(s => ({
      speciesCode:s.speciesCode,comName:s.comName,sciName:s.sciName,
      lat:s.lat,lng:s.lng,locName:s.locName,locId:s.locId,
      obsDt:s.obsDt,howMany:s.howMany,obsReviewed:s.obsReviewed,obsValid:s.obsValid,
      locationPrivate:s.locationPrivate,subnational2Code:s.subnational2Code,
      image:null
    }));

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
