/**
 * api/observations.js: Recent observations by region
 * Supports Michigan regions (UP, NLP, SLP) or county codes
 */

const { getRecentObservations, MI_REGIONS } = require('../lib/ebird');

module.exports = async (req, res) => {
  try {
    const region = req.query.region || 'US-MI';
    const back = parseInt(req.query.back) || 7;
    const maxResults = Math.min(parseInt(req.query.max) || 100, 200);

    // Handle macro-regions
    let regionCode = region;
    if (MI_REGIONS[region]) {
      // For macro-regions, query the state and filter by county
      regionCode = 'US-MI';
    }

    const observations = await getRecentObservations(regionCode, {
      back,
      maxResults: maxResults * 2, // over-fetch for filtering
    });

    let filtered = observations;

    // Filter by macro-region counties if needed
    if (MI_REGIONS[region]) {
      const countySet = new Set(MI_REGIONS[region]);
      filtered = observations.filter(o => countySet.has(o.subnational2Code));
    }

    // Deduplicate by species
    const seen = new Map();
    for (const o of filtered) {
      if (!seen.has(o.speciesCode)) {
        seen.set(o.speciesCode, o);
      }
    }

    const unique = Array.from(seen.values()).slice(0, maxResults);

    res.status(200).json({
      region,
      back,
      speciesCount: unique.length,
      updated: new Date().toISOString(),
      observations: unique,
    });
  } catch (err) {
    console.error('Observations API error:', err);
    res.status(500).json({ error: err.message });
  }
};
