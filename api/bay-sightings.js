const { getRecentObservations } = require('../lib/ebird');
const { getBestImage } = require('../lib/media');

const BAY_COUNTIES = ['US-MI-017', 'US-MI-011', 'US-MI-157', 'US-MI-063', 'US-MI-145', 'US-MI-111', 'US-MI-069'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const back = parseInt(req.query.back) || 14;

    // Fetch recent observations from all 7 counties in parallel
    const results = await Promise.all(
      BAY_COUNTIES.map(county =>
        getRecentObservations(county, { back, maxResults: 100 }).catch(() => [])
      )
    );

    const allObs = results.flat();

    // Deduplicate by species, keeping the most recent observation per species
    // Retain dated public checklist records, not individual bird coordinates.
    // The consumer now joins locId only to a curated eBird hotspot centroid.
    const speciesMap = new Map();
    const publicReports = [];

    for (const o of allObs) {
      if (o.locId) {
        publicReports.push({
          speciesCode: o.speciesCode,
          comName: o.comName,
          sciName: o.sciName,
          locName: o.locName,
          locId: o.locId,
          obsDt: o.obsDt,
          howMany: o.howMany || null,
        });
      }

      // Track unique species (most recent sighting)
      if (!speciesMap.has(o.speciesCode)) {
        speciesMap.set(o.speciesCode, {
          speciesCode: o.speciesCode,
          comName: o.comName,
          sciName: o.sciName,
          locName: o.locName,
          obsDt: o.obsDt,
          howMany: o.howMany || null,
          taxonOrder: o.taxonOrder || 0,
        });
      }
    }

    // Sort species by taxonomic order for grouping
    const speciesList = Array.from(speciesMap.values())
      .sort((a, b) => (a.taxonOrder || 0) - (b.taxonOrder || 0));

    // Fetch images for top 20 species
    const topForImages = speciesList.slice(0, 20);
    const images = await Promise.all(
      topForImages.map(s => getBestImage(s.comName).catch(() => null))
    );
    topForImages.forEach((s, i) => { s.image = images[i]; });

    res.status(200).json({
      speciesCount: speciesList.length,
      observationCount: publicReports.length,
      counties: BAY_COUNTIES.length,
      back,
      observationSemantics: 'county-public-ebird-reports-without-precise-coordinates',
      sourceConfidence: 'Community checklist evidence; observer effort, reporting lag and location precision vary',
      species: speciesList,
      observations: publicReports, // Dated community checklist records without individual coordinates
    });

  } catch (err) {
    console.error('Bay sightings error:', err);
    res.status(500).json({ error: err.message });
  }
};
