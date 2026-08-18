/**
 * Michigan migration decision logic.
 * Keeps live-data interpretation deterministic and source-bounded:
 * NWS weather = movement setup; eBird = recent observations; BirdCast = radar truth.
 */

const REGIONS = [
  {
    id: 'saginaw-bay',
    name: 'Saginaw Bay',
    countyCode: 'US-MI-017',
    countyFips: '017',
    weatherKey: 'saginaw-bay',
    lat: 43.65,
    lng: -83.85,
    focus: 'Bay City State Park, Nayanquing Point, Fish Point',
    why: 'Shallow-bay marshes and shoreline habitat concentrate waterfowl, shorebirds, sparrows, and songbirds.',
    birdcast: 'https://dashboard.birdcast.info/region/US-MI-017',
  },
  {
    id: 'tawas',
    name: 'Tawas Point',
    countyCode: 'US-MI-069',
    countyFips: '069',
    weatherKey: 'tawas',
    lat: 44.258,
    lng: -83.445,
    focus: 'Tawas Point State Park and nearby Lake Huron shoreline',
    why: 'A projecting peninsula on Lake Huron can concentrate migrants along shoreline habitat during both spring and fall.',
    birdcast: 'https://dashboard.birdcast.info/region/US-MI-069',
  },
  {
    id: 'whitefish',
    name: 'Whitefish Point',
    countyCode: 'US-MI-033',
    countyFips: '033',
    weatherKey: 'upper-east',
    lat: 46.771,
    lng: -84.958,
    focus: 'Whitefish Point and eastern Upper Peninsula shoreline',
    why: 'The Lake Superior point is a major migration funnel for raptors, waterbirds, and passerines.',
    birdcast: 'https://dashboard.birdcast.info/region/US-MI-033',
  },
  {
    id: 'western-lake-erie',
    name: 'Western Lake Erie',
    countyCode: 'US-MI-115',
    countyFips: '115',
    weatherKey: 'southeast',
    lat: 42.06,
    lng: -83.2,
    focus: 'Pointe Mouillee and Monroe County marshes',
    why: 'Western Lake Erie marshes are high-value stopover habitat for shorebirds, waterfowl, and migrant songbirds.',
    birdcast: 'https://dashboard.birdcast.info/region/US-MI-115',
  },
  {
    id: 'muskegon',
    name: 'Muskegon',
    countyCode: 'US-MI-121',
    countyFips: '121',
    weatherKey: 'southwest',
    lat: 43.234,
    lng: -86.248,
    focus: 'Lake Michigan shoreline and Muskegon-area wetlands',
    why: 'Lake Michigan shoreline, open water, and large wetland complexes create multiple migration habitats in one stop.',
    birdcast: 'https://dashboard.birdcast.info/region/US-MI-121',
  },
  {
    id: 'leelanau',
    name: 'Leelanau / Traverse Bay',
    countyCode: 'US-MI-089',
    countyFips: '089',
    weatherKey: 'northwest',
    lat: 44.95,
    lng: -85.8,
    focus: 'Leelanau Peninsula, Sleeping Bear shoreline, and Grand Traverse Bay',
    why: 'Peninsula and shoreline geography can concentrate migrants moving through northwest Lower Michigan.',
    birdcast: 'https://dashboard.birdcast.info/region/US-MI-089',
  },
];

const SPRING_TAILWINDS = new Set(['S', 'SSW', 'SSE', 'SW', 'SE']);
const FALL_TAILWINDS = new Set(['N', 'NNW', 'NNE', 'NW', 'NE']);

function dateParts(date) {
  const d = date instanceof Date ? date : new Date(date);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function getMigrationSeason(date = new Date()) {
  const { month, day } = dateParts(date);
  const spring = (month > 3 && month < 6) || (month === 3 && day >= 1) || (month === 6 && day <= 15);
  const fall = (month > 8 && month < 11) || (month === 8 && day >= 1) || (month === 11 && day <= 15);

  if (spring) {
    return {
      active: true,
      key: 'spring',
      label: 'Spring migration',
      direction: 'northbound',
      birdcastWindow: 'March 1–June 15',
    };
  }
  if (fall) {
    return {
      active: true,
      key: 'fall',
      label: 'Fall migration',
      direction: 'southbound',
      birdcastWindow: 'August 1–November 15',
    };
  }
  return {
    active: false,
    key: 'offseason',
    label: 'Migration shoulder season',
    direction: null,
    birdcastWindow: 'March 1–June 15 and August 1–November 15',
  };
}

function normalizeWind(dir) {
  return String(dir || '').trim().toUpperCase();
}

function classifyFlightSetup(weather, season) {
  if (!weather || !season?.active) {
    return {
      key: season?.active ? 'unknown' : 'offseason',
      label: season?.active ? 'Weather signal unavailable' : 'Outside BirdCast live season',
      tone: 'neutral',
      explanation: season?.active
        ? 'Live NWS weather was unavailable. Use the BirdCast dashboard for radar confirmation.'
        : `BirdCast live migration data normally runs ${season?.birdcastWindow}.`,
    };
  }

  const tonight = weather.tonight || weather.current || {};
  const dir = normalizeWind(tonight.windDir);
  const forecast = String(tonight.shortForecast || '').toLowerCase();
  const precipitation = /(rain|showers|thunder|storm|drizzle)/.test(forecast);
  const favorable = season.key === 'spring' ? SPRING_TAILWINDS.has(dir) : FALL_TAILWINDS.has(dir);
  const opposing = season.key === 'spring' ? FALL_TAILWINDS.has(dir) : SPRING_TAILWINDS.has(dir);

  if (precipitation && favorable) {
    return {
      key: 'fallout-watch',
      label: 'Movement + grounding watch',
      tone: 'watch',
      explanation: `${dir || 'Variable'} winds support ${season.direction} movement, while precipitation may interrupt flight and concentrate birds at stopover habitat.`,
    };
  }
  if (precipitation) {
    return {
      key: 'grounding-watch',
      label: 'Grounding / concentration watch',
      tone: 'watch',
      explanation: 'Precipitation may interrupt nocturnal movement. Check shoreline, woods, and wetland stopovers near dawn.',
    };
  }
  if (favorable) {
    return {
      key: 'favorable',
      label: 'Favorable movement setup',
      tone: 'good',
      explanation: `${dir} winds are a supportive tailwind signal for ${season.direction} migration tonight.`,
    };
  }
  if (opposing) {
    return {
      key: 'holding',
      label: 'Holding-pattern setup',
      tone: 'mixed',
      explanation: `${dir} winds oppose the primary ${season.direction} direction. Birds already present may linger or movement may be more selective.`,
    };
  }
  return {
    key: 'mixed',
    label: 'Mixed movement setup',
    tone: 'mixed',
    explanation: `${dir || 'Variable'} winds do not provide a strong statewide directional signal. Local habitat and BirdCast radar matter more.`,
  };
}

function freshnessLabel(obsDt) {
  if (!obsDt) return 'recent';
  const when = new Date(String(obsDt).replace(' ', 'T'));
  if (Number.isNaN(when.getTime())) return String(obsDt);
  const hours = Math.max(0, (Date.now() - when.getTime()) / 3600000);
  if (hours < 18) return 'today';
  if (hours < 42) return 'since yesterday';
  return 'past 3 days';
}

function summarizeObservations(observations = []) {
  const bySpecies = new Map();
  for (const obs of observations) {
    if (!obs || !obs.speciesCode || !obs.comName) continue;
    const existing = bySpecies.get(obs.speciesCode);
    if (!existing || String(obs.obsDt || '') > String(existing.obsDt || '')) {
      bySpecies.set(obs.speciesCode, obs);
    }
  }
  const recent = [...bySpecies.values()]
    .sort((a, b) => String(b.obsDt || '').localeCompare(String(a.obsDt || '')))
    .slice(0, 6)
    .map(obs => ({
      speciesCode: obs.speciesCode,
      name: obs.comName,
      location: obs.locName || 'Recent county report',
      observed: obs.obsDt || null,
      count: obs.howMany || null,
    }));

  const latest = recent[0]?.observed || null;
  return {
    speciesCount: bySpecies.size,
    latestObservation: latest,
    freshness: freshnessLabel(latest),
    recentSpecies: recent,
  };
}

function morningRecommendation(flight, observations) {
  const richness = observations?.speciesCount || 0;
  if (flight.key === 'fallout-watch' || flight.key === 'grounding-watch') {
    return {
      label: 'High-interest dawn check',
      reason: 'Weather may concentrate migrants at stopover habitat; verify with BirdCast radar and recent eBird reports before driving.',
    };
  }
  if (flight.key === 'favorable' && richness >= 20) {
    return {
      label: 'Worth an early start',
      reason: `Supportive migration weather plus ${richness} recently reported species makes this a strong place to check after sunrise.`,
    };
  }
  if (flight.key === 'holding' && richness >= 20) {
    return {
      label: 'Check birds already on the ground',
      reason: `Movement weather is less supportive, but ${richness} recently reported species suggest useful local birding remains.`,
    };
  }
  if (richness >= 12) {
    return {
      label: 'Worth checking',
      reason: `${richness} species have recent county reports. Use local sightings and habitat as the deciding signal.`,
    };
  }
  return {
    label: 'Verify before making the drive',
    reason: 'Recent reporting is lighter or incomplete. Open the county page and BirdCast dashboard before committing.',
  };
}

function expectedGroups(date = new Date()) {
  const { month, day } = dateParts(date);
  if (month === 3) return ['Waterfowl', 'Sandhill cranes', 'Blackbirds', 'Early sparrows'];
  if (month === 4) return ['Kinglets', 'Sparrows', 'Early warblers', 'Shorebirds'];
  if (month === 5) return ['Warblers', 'Vireos', 'Thrushes', 'Flycatchers'];
  if (month === 6 && day <= 15) return ['Late warblers', 'Flycatchers', 'Thrushes', 'Breeding arrivals'];
  if (month === 8) return ['Shorebirds', 'Early warblers', 'Swallows', 'Common Nighthawks'];
  if (month === 9) return ['Warblers', 'Vireos', 'Thrushes', 'Raptors'];
  if (month === 10) return ['Sparrows', 'Kinglets', 'Waterfowl', 'Cranes and raptors'];
  if (month === 11 && day <= 15) return ['Waterfowl', 'Tundra swans', 'Snow buntings and longspurs', 'Late raptors'];
  return ['Resident birds', 'Seasonal waterfowl', 'Local specialties', 'Next-wave migrants'];
}

function summarizeState(regions = [], season = getMigrationSeason()) {
  const setups = regions.map(r => r.flight?.key).filter(Boolean);
  const favorable = setups.filter(k => k === 'favorable' || k === 'fallout-watch').length;
  const grounding = setups.filter(k => k === 'grounding-watch' || k === 'fallout-watch').length;
  const unknown = setups.filter(k => k === 'unknown').length;

  if (!season.active) {
    return {
      headline: 'Migration live season is paused',
      detail: `Use recent eBird observations year-round. BirdCast live feeds normally run ${season.birdcastWindow}.`,
      tone: 'neutral',
    };
  }
  if (unknown === setups.length && setups.length) {
    return {
      headline: 'Weather signal is temporarily incomplete',
      detail: 'Open BirdCast for radar truth and use recent eBird observations while NWS data refreshes.',
      tone: 'neutral',
    };
  }
  if (grounding >= 2) {
    return {
      headline: 'Watch for concentrated morning birding',
      detail: `${grounding} focal regions show precipitation-related grounding potential. Radar confirmation is essential.`,
      tone: 'watch',
    };
  }
  if (favorable >= 4) {
    return {
      headline: `Broad ${season.direction} movement setup tonight`,
      detail: `${favorable} of ${regions.length} focal regions show supportive directional weather. Check BirdCast after sunset, then recent eBird reports at dawn.`,
      tone: 'good',
    };
  }
  if (favorable >= 2) {
    return {
      headline: 'Patchy favorable migration setup tonight',
      detail: `${favorable} focal regions show supportive movement weather. Regional differences matter more than a statewide average.`,
      tone: 'mixed',
    };
  }
  return {
    headline: 'Mixed or holding migration setup tonight',
    detail: 'No broad favorable weather signal is showing across the focal regions. Birds already present may still make excellent morning birding.',
    tone: 'mixed',
  };
}

module.exports = {
  REGIONS,
  getMigrationSeason,
  classifyFlightSetup,
  summarizeObservations,
  morningRecommendation,
  expectedGroups,
  summarizeState,
};
