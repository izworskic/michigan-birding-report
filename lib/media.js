/**
 * lib/media.js: Bird species image system
 * 
 * PRIMARY: iNaturalist taxa API default_photo
 *   - Real field photographs selected by the community
 *   - Works for every species
 *   - URLs load reliably
 *   - Cached 365 days in Redis
 *
 * All other sources (Wikimedia, Nuthatch) dropped due to
 * reliability issues (403 blocks, stock images).
 */

const { Redis } = require('@upstash/redis');
const PHOTO_CACHE_TTL = 86400 * 365; // 1 year
const OBS_PHOTO_TTL = 86400; // 24 hours for recent observation photos

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

/**
 * Get the species' default photo from iNaturalist taxa endpoint.
 * These are curated, high-quality field photographs.
 * One call per species, cached for a year.
 */
async function getINatTaxonPhoto(commonName) {
  const key = commonName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cacheKey = `birding:img:${key}`;

  try {
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (data && data.url) return data;
    }
  } catch (e) { /* continue */ }

  try {
    const res = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(commonName)}&rank=species&per_page=1`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const taxon = data.results?.[0];
    if (!taxon?.default_photo?.medium_url) return null;

    const photo = taxon.default_photo;
    const result = {
      url: photo.medium_url,
      attribution: photo.attribution || 'iNaturalist',
      license: photo.license_code || 'CC',
      sciName: taxon.name,
      inatId: taxon.id,
    };

    try {
      const r = getRedis();
      await r.set(cacheKey, JSON.stringify(result), { ex: PHOTO_CACHE_TTL });
    } catch (e) { /* continue */ }

    return result;
  } catch (e) {
    return null;
  }
}

/**
 * Get the best available image for a species.
 * Uses iNaturalist taxa photos exclusively: real field photography.
 */
async function getBestImage(speciesCode, commonName) {
  // Try iNaturalist (real field photos, always reliable)
  try {
    const inat = await getINatTaxonPhoto(commonName);
    if (inat) return { source: 'inaturalist', ...inat };
  } catch (e) { /* continue */ }

  // If common name failed, try without "Northern/Eastern/Western" prefix
  const simplified = commonName.replace(/^(Northern|Eastern|Western|American|Common)\s+/i, '');
  if (simplified !== commonName) {
    try {
      const inat = await getINatTaxonPhoto(simplified);
      if (inat) return { source: 'inaturalist', ...inat };
    } catch (e) { /* continue */ }
  }

  return {
    source: 'placeholder',
    url: '/placeholder-bird.svg',
    attribution: 'Michigan Birding Report',
    license: 'n/a',
  };
}

/**
 * Fetch recent bird photos from iNaturalist for a species in Michigan.
 * These are observation photos showing the bird in local habitat.
 */
async function getINatPhotos(taxonName, options = {}) {
  const { perPage = 6 } = options;
  const cacheKey = `birding:inat:obs:${taxonName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  try {
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (Array.isArray(data)) return data;
    }
  } catch (e) { /* continue */ }

  try {
    const url = `https://api.inaturalist.org/v1/observations?` +
      `taxon_name=${encodeURIComponent(taxonName)}` +
      `&place_id=31` + // Michigan
      `&quality_grade=research` +
      `&photos=true` +
      `&order=desc&order_by=observed_on` +
      `&per_page=${perPage}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const photos = (data.results || [])
      .filter(obs => obs.photos && obs.photos.length > 0)
      .map(obs => ({
        photoUrl: obs.photos[0].url.replace('square', 'medium'),
        observer: obs.user?.login || 'Unknown',
        date: obs.observed_on,
        location: obs.place_guess,
        license: obs.photos[0].license_code || 'unknown',
        inatUrl: `https://www.inaturalist.org/observations/${obs.id}`,
      }));

    try {
      const r = getRedis();
      await r.set(cacheKey, JSON.stringify(photos), { ex: OBS_PHOTO_TTL });
    } catch (e) { /* continue */ }

    return photos;
  } catch (e) {
    return [];
  }
}

module.exports = {
  getINatTaxonPhoto,
  getBestImage,
  getINatPhotos,
};
