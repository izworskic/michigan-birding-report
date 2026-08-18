/**
 * /api/migration-intelligence
 *
 * Composes existing first-party birding infrastructure into a Michigan
 * migration decision layer. BirdCast is linked as the authoritative radar
 * confirmation source; this endpoint does not scrape or reproduce BirdCast.
 */

const { getWeather } = require('../lib/weather');
const { getRecentObservations, getNotableSightings } = require('../lib/ebird');
const {
  REGIONS,
  getMigrationSeason,
  classifyFlightSetup,
  summarizeObservations,
  morningRecommendation,
  expectedGroups,
  summarizeState,
} = require('../lib/migration');

async function buildRegion(region, season) {
  const [weatherResult, observationsResult] = await Promise.allSettled([
    getWeather(region.weatherKey),
    getRecentObservations(region.countyCode, { back: 3, maxResults: 100 }),
  ]);

  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
  const observations = observationsResult.status === 'fulfilled' ? observationsResult.value : [];
  const observationSummary = summarizeObservations(observations);
  const flight = classifyFlightSetup(weather, season);
  const morning = morningRecommendation(flight, observationSummary);

  return {
    id: region.id,
    name: region.name,
    countyCode: region.countyCode,
    countyFips: region.countyFips,
    weatherKey: region.weatherKey,
    lat: region.lat,
    lng: region.lng,
    focus: region.focus,
    why: region.why,
    birdcast: region.birdcast,
    countyPage: `/county/${region.countyFips}`,
    weather: weather ? {
      current: weather.current,
      tonight: weather.tonight,
      tomorrow: weather.tomorrow,
      updated: weather.updated,
    } : null,
    flight,
    morning,
    observations: observationSummary,
  };
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }

  try {
    const now = new Date();
    const season = getMigrationSeason(now);

    const [regions, notableResult] = await Promise.all([
      Promise.all(REGIONS.map(region => buildRegion(region, season))),
      getNotableSightings('US-MI', { back: 3, maxResults: 12 }).catch(() => []),
    ]);

    const notable = (notableResult || []).slice(0, 8).map(obs => ({
      speciesCode: obs.speciesCode,
      name: obs.comName,
      location: obs.locName || 'Michigan',
      observed: obs.obsDt || null,
      count: obs.howMany || null,
      lat: obs.lat || null,
      lng: obs.lng || null,
    }));

    const payload = {
      generatedAt: now.toISOString(),
      season,
      pulse: summarizeState(regions, season),
      expectedGroups: expectedGroups(now),
      regions,
      notable,
      sources: {
        weather: {
          name: 'National Weather Service',
          role: 'Regional wind and precipitation context',
          url: 'https://www.weather.gov/',
        },
        observations: {
          name: 'eBird',
          role: 'Recent Michigan observations and notable sightings',
          url: 'https://ebird.org/',
        },
        radar: {
          name: 'BirdCast',
          role: 'Authoritative migration radar and forecast confirmation',
          url: 'https://dashboard.birdcast.info/region/US-MI',
        },
      },
      trust: {
        statement: 'Weather and eBird are screening signals, not proof that a migration flight occurred. Confirm nocturnal movement with BirdCast radar before treating the setup as observed migration.',
        birdcastIngested: false,
      },
    };

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Migration intelligence error:', err);
    return res.status(500).json({
      error: 'Migration intelligence is temporarily unavailable',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};
