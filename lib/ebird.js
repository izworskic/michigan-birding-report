/**
 * lib/ebird.js — eBird API v2 wrapper with Upstash Redis caching
 * Endpoints: observations, hotspots, taxonomy, statistics
 */

const { Redis } = require('@upstash/redis');

const EBIRD_BASE = 'https://api.ebird.org/v2';
const EBIRD_KEY = process.env.EBIRD_API_KEY || 'dkulfatt5iu3';
const CACHE_TTL = 900; // 15 minutes for real-time data
const CACHE_TTL_LONG = 86400; // 24 hours for taxonomy/hotspot lists

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

async function ebirdFetch(path, params = {}, cacheTTL = CACHE_TTL) {
  const qs = new URLSearchParams(params).toString();
  const url = `${EBIRD_BASE}${path}${qs ? '?' + qs : ''}`;
  const cacheKey = `birding:ebird:${path}:${qs}`;

  try {
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch (e) {
    console.warn('Redis read error:', e.message);
  }

  const res = await fetch(url, {
    headers: { 'x-ebirdapitoken': EBIRD_KEY },
  });

  if (!res.ok) {
    throw new Error(`eBird API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();

  try {
    const r = getRedis();
    await r.set(cacheKey, JSON.stringify(data), { ex: cacheTTL });
  } catch (e) {
    console.warn('Redis write error:', e.message);
  }

  return data;
}

// --- Observation endpoints ---

/** Recent observations in a region (e.g. 'US-MI', 'US-MI-017') */
async function getRecentObservations(regionCode, options = {}) {
  const { back = 7, maxResults = 100, hotspot = false } = options;
  return ebirdFetch(`/data/obs/${regionCode}/recent`, {
    back, maxResults, hotspot, cat: 'species',
  });
}

/** Notable/rare sightings in a region */
async function getNotableSightings(regionCode, options = {}) {
  const { back = 14, maxResults = 50 } = options;
  return ebirdFetch(`/data/obs/${regionCode}/recent/notable`, {
    back, maxResults, detail: 'full',
  });
}

/** Notable sightings near a lat/lng */
async function getNotableNearby(lat, lng, options = {}) {
  const { dist = 50, back = 14 } = options;
  return ebirdFetch('/data/obs/geo/recent/notable', {
    lat, lng, dist, back, detail: 'full',
  });
}

/** Recent observations of a specific species in a region */
async function getSpeciesObservations(regionCode, speciesCode, options = {}) {
  const { back = 30 } = options;
  return ebirdFetch(`/data/obs/${regionCode}/recent/${speciesCode}`, { back });
}

/** Historic observations on a date */
async function getHistoricObservations(regionCode, year, month, day) {
  return ebirdFetch(
    `/data/obs/${regionCode}/historic/${year}/${month}/${day}`,
    { detail: 'full' },
    CACHE_TTL_LONG
  );
}

// --- Hotspot endpoints ---

/** All hotspots in a region */
async function getHotspots(regionCode, options = {}) {
  const { back, fmt = 'json' } = options;
  const params = { fmt };
  if (back) params.back = back;
  return ebirdFetch(`/ref/hotspot/${regionCode}`, params, CACHE_TTL_LONG);
}

/** Nearby hotspots by lat/lng */
async function getNearbyHotspots(lat, lng, options = {}) {
  const { dist = 25 } = options;
  return ebirdFetch('/ref/hotspot/geo', { lat, lng, dist, fmt: 'json' });
}

/** Single hotspot details */
async function getHotspotInfo(locId) {
  return ebirdFetch(`/ref/hotspot/info/${locId}`, {}, CACHE_TTL_LONG);
}

// --- Taxonomy ---

/** Full eBird taxonomy (cached long) */
async function getTaxonomy(options = {}) {
  const { species, cat = 'species' } = options;
  const params = { fmt: 'json', cat };
  if (species) params.species = species;
  return ebirdFetch('/ref/taxonomy/ebird', params, CACHE_TTL_LONG);
}

/** Species list ever recorded in a region */
async function getRegionSpecies(regionCode) {
  return ebirdFetch(`/product/spplist/${regionCode}`, {}, CACHE_TTL_LONG);
}

// --- Statistics ---

/** Daily stats for a region */
async function getRegionStats(regionCode, year, month, day) {
  return ebirdFetch(`/product/stats/${regionCode}/${year}/${month}/${day}`, {});
}

/** Top 100 contributors */
async function getTop100(regionCode, year, month, day) {
  return ebirdFetch(`/product/top100/${regionCode}/${year}/${month}/${day}`, {});
}

// --- Region info ---

/** List sub-regions (e.g. counties in MI) */
async function getSubRegions(regionType, parentRegion) {
  return ebirdFetch(`/ref/region/list/${regionType}/${parentRegion}`, {}, CACHE_TTL_LONG);
}

// --- Michigan-specific helpers ---

const MI_REGIONS = {
  UP: [
    'US-MI-003','US-MI-013','US-MI-033','US-MI-041','US-MI-043',
    'US-MI-053','US-MI-061','US-MI-071','US-MI-083','US-MI-095',
    'US-MI-097','US-MI-103','US-MI-109','US-MI-131','US-MI-153'
  ],
  NLP: [
    'US-MI-001','US-MI-007','US-MI-009','US-MI-019','US-MI-029',
    'US-MI-031','US-MI-039','US-MI-047','US-MI-055','US-MI-069',
    'US-MI-079','US-MI-085','US-MI-089','US-MI-101','US-MI-107',
    'US-MI-113','US-MI-119','US-MI-129','US-MI-135','US-MI-137',
    'US-MI-141','US-MI-143','US-MI-157','US-MI-165'
  ],
  SLP: [
    'US-MI-005','US-MI-011','US-MI-015','US-MI-017','US-MI-021',
    'US-MI-023','US-MI-025','US-MI-027','US-MI-035','US-MI-037',
    'US-MI-045','US-MI-049','US-MI-057','US-MI-059','US-MI-063',
    'US-MI-065','US-MI-067','US-MI-073','US-MI-075','US-MI-077',
    'US-MI-081','US-MI-087','US-MI-091','US-MI-093','US-MI-099',
    'US-MI-105','US-MI-111','US-MI-115','US-MI-117','US-MI-121',
    'US-MI-123','US-MI-125','US-MI-127','US-MI-133','US-MI-139',
    'US-MI-145','US-MI-147','US-MI-149','US-MI-151','US-MI-155',
    'US-MI-159','US-MI-161','US-MI-163'
  ],
};

// Saginaw Bay focal hotspots
const SAGINAW_BAY_HOTSPOTS = [
  { locId: 'L208963', name: 'Bay City State Recreation Area' },
  { locId: 'L282752', name: 'Tobico Marsh' },
  { locId: 'L148895', name: 'Nayanquing Point State Wildlife Area' },
  { locId: 'L148835', name: 'Fish Point State Wildlife Area' },
  { locId: 'L820964', name: 'Quanicassee State Wildlife Area' },
  { locId: 'L285440', name: 'Shiawassee National Wildlife Refuge' },
  { locId: 'L1101197', name: 'Tawas Point State Park' },
  { locId: 'L463424', name: 'Wigwam Bay State Wildlife Area' },
];

module.exports = {
  getRecentObservations,
  getNotableSightings,
  getNotableNearby,
  getSpeciesObservations,
  getHistoricObservations,
  getHotspots,
  getNearbyHotspots,
  getHotspotInfo,
  getTaxonomy,
  getRegionSpecies,
  getRegionStats,
  getTop100,
  getSubRegions,
  MI_REGIONS,
  SAGINAW_BAY_HOTSPOTS,
};
