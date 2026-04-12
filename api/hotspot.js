/**
 * api/hotspot.js — Sightings at Saginaw Bay region or specific locations
 * Uses county-level queries for reliable data coverage
 */

const { getRecentObservations, SAGINAW_BAY_HOTSPOTS } = require('../lib/ebird');
const { getBestImage } = require('../lib/media');

// Saginaw Bay watershed counties
const SAGINAW_BAY_COUNTIES = [
  'US-MI-017', // Bay
  'US-MI-011', // Arenac
  'US-MI-157', // Tuscola
  'US-MI-063', // Huron
  'US-MI-145', // Saginaw
  'US-MI-111', // Midland
  'US-MI-069', // Iosco (Tawas Point)
];

module.exports = async (req, res) => {
  try {
    const locId = req.query.locId;
    const mode = req.query.mode || 'single';
    const back = parseInt(req.query.back) || 14;

    let allObs = [];

    if (mode === 'saginaw-bay') {
      const promises = SAGINAW_BAY_COUNTIES.map(county =>
        getRecentObservations(county, { back, maxResults: 200 })
          .then(obs => obs.map(o => ({ ...o, countyCode: county })))
          .catch(() => [])
      );
      const results = await Promise.all(promises);
      allObs = results.flat();
    } else if (locId) {
      allObs = await getRecentObservations(locId, { back, maxResults: 200 });
    } else {
      return res.status(400).json({ error: 'Provide locId or mode=saginaw-bay' });
    }

    // Deduplicate by species, keep most recent observation
    const seen = new Map();
    for (const o of allObs) {
      const key = o.speciesCode;
      if (!seen.has(key) || new Date(o.obsDt) > new Date(seen.get(key).obsDt)) {
        seen.set(key, o);
      }
    }

    const unique = Array.from(seen.values())
      .sort((a, b) => new Date(b.obsDt) - new Date(a.obsDt))
      .slice(0, 80);

    // Attach images
    const enriched = await Promise.all(
      unique.map(async (o) => {
        const img = await getBestImage(o.speciesCode, o.comName);
        return {
          speciesCode: o.speciesCode,
          comName: o.comName,
          sciName: o.sciName,
          locName: o.locName,
          obsDt: o.obsDt,
          howMany: o.howMany || null,
          countyCode: o.countyCode || o.subnational2Code || null,
          image: img,
        };
      })
    );

    res.status(200).json({
      mode,
      locId: locId || 'saginaw-bay-counties',
      counties: mode === 'saginaw-bay' ? SAGINAW_BAY_COUNTIES : undefined,
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
