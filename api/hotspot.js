/**
 * api/hotspot.js — Sightings at specific hotspots
 * Supports individual hotspot or Saginaw Bay aggregate
 */

const { getRecentObservations, SAGINAW_BAY_HOTSPOTS } = require('../lib/ebird');
const { getBestImage } = require('../lib/media');

module.exports = async (req, res) => {
  try {
    const locId = req.query.locId;
    const mode = req.query.mode || 'single'; // 'single' or 'saginaw-bay'
    const back = parseInt(req.query.back) || 7;

    let allObs = [];

    if (mode === 'saginaw-bay') {
      // Aggregate observations from all Saginaw Bay hotspots
      const promises = SAGINAW_BAY_HOTSPOTS.map(h =>
        getRecentObservations(h.locId, { back, maxResults: 50, hotspot: true })
          .then(obs => obs.map(o => ({ ...o, hotspotName: h.name })))
          .catch(() => [])
      );
      const results = await Promise.all(promises);
      allObs = results.flat();
    } else if (locId) {
      allObs = await getRecentObservations(locId, { back, maxResults: 100 });
    } else {
      return res.status(400).json({ error: 'Provide locId or mode=saginaw-bay' });
    }

    // Deduplicate by species, keep most recent
    const seen = new Map();
    for (const o of allObs) {
      const key = o.speciesCode;
      if (!seen.has(key) || new Date(o.obsDt) > new Date(seen.get(key).obsDt)) {
        seen.set(key, o);
      }
    }

    const unique = Array.from(seen.values())
      .sort((a, b) => new Date(b.obsDt) - new Date(a.obsDt))
      .slice(0, 50);

    // Attach images to top species
    const enriched = await Promise.all(
      unique.map(async (o) => {
        const img = await getBestImage(o.speciesCode, o.comName);
        return {
          speciesCode: o.speciesCode,
          comName: o.comName,
          sciName: o.sciName,
          locName: o.locName,
          hotspotName: o.hotspotName || null,
          obsDt: o.obsDt,
          howMany: o.howMany || null,
          image: img,
        };
      })
    );

    res.status(200).json({
      mode,
      locId: locId || 'saginaw-bay-aggregate',
      hotspots: mode === 'saginaw-bay' ? SAGINAW_BAY_HOTSPOTS : undefined,
      speciesCount: enriched.length,
      totalObservations: allObs.length,
      updated: new Date().toISOString(),
      species: enriched,
    });
  } catch (err) {
    console.error('Hotspot API error:', err);
    res.status(500).json({ error: err.message });
  }
};
