/**
 * lib/media.js — Bird species image aggregator
 * Layer 1: Curated Wikimedia Commons mapping (static, fast)
 * Layer 2: iNaturalist API (recent photos with CC license)
 * Layer 3: Nuthatch API fallback
 */

const { Redis } = require('@upstash/redis');
const NUTHATCH_KEY = process.env.NUTHATCH_API_KEY || '3865a414-0dfa-4a69-84d9-1565f1962986';
const IMG_CACHE_TTL = 86400; // 24 hours

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
 * Curated Wikimedia Commons images for top Michigan species.
 * Format: speciesCode -> { url, attribution, license }
 * These are hand-picked high-quality CC images.
 */
const SPECIES_IMAGES = {
  // Warblers
  kirwar: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Kirtland%27s_Warbler_%28Setophaga_kirtlandii%29.jpg/800px-Kirtland%27s_Warbler_%28Setophaga_kirtlandii%29.jpg', attribution: 'Joel Trick/USFWS', license: 'Public Domain' },
  yelwar: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Setophaga_petechia_-Canopy_Lodge%2C_El_Valle_de_Ant%C3%B3n%2C_Cocl%C3%A9%2C_Panama-8.jpg/800px-Setophaga_petechia_-Canopy_Lodge%2C_El_Valle_de_Ant%C3%B3n%2C_Cocl%C3%A9%2C_Panama-8.jpg', attribution: 'Michael Woodruff', license: 'CC BY-SA 2.0' },
  btbwar: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Blackburnian_Warbler_-_Setophaga_fusca.jpg/800px-Blackburnian_Warbler_-_Setophaga_fusca.jpg', attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  bkbwar: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Mniotilta_varia1.jpg/800px-Mniotilta_varia1.jpg', attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  magwar: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Setophaga_magnolia_-Chiquimula%2C_Guatemala-8.jpg/800px-Setophaga_magnolia_-Chiquimula%2C_Guatemala-8.jpg', attribution: 'Francesco Veronesi', license: 'CC BY-SA 2.0' },
  prowar: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Prothonotary_warbler.jpg/800px-Prothonotary_warbler.jpg', attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  comyel: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Geothlypis_trichas_-_Common_Yellowthroat%2C_Chesterfield_County%2C_South_Carolina.jpg/800px-Geothlypis_trichas_-_Common_Yellowthroat%2C_Chesterfield_County%2C_South_Carolina.jpg', attribution: 'Andy Reago & Chrissy McClarren', license: 'CC BY 2.0' },

  // Raptors
  baleag: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/About_to_Launch_%2826075320352%29.jpg/800px-About_to_Launch_%2826075320352%29.jpg', attribution: 'Andy Morffew', license: 'CC BY 2.0' },
  rethaw: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Red-tailed_Hawk_%28Buteo_jamaicensis%29_in_flight.jpg/800px-Red-tailed_Hawk_%28Buteo_jamaicensis%29_in_flight.jpg', attribution: 'Jason Crotty', license: 'CC BY 2.0' },
  merlin: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Merlin_%28Falco_columbarius%29.jpg/800px-Merlin_%28Falco_columbarius%29.jpg', attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  snoowl1: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Snowy_Owl_-_Bubo_scandiacus.jpg/800px-Snowy_Owl_-_Bubo_scandiacus.jpg', attribution: 'Bert de Tilly', license: 'CC BY-SA 4.0' },
  grhowl: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Great_Horned_Owl_-_Bubo_virginianus.jpg/800px-Great_Horned_Owl_-_Bubo_virginianus.jpg', attribution: 'Mdf', license: 'CC BY-SA 3.0' },

  // Waterfowl
  mallar3: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Anas_platyrhynchos_male_female_quadrat.jpg/800px-Anas_platyrhynchos_male_female_quadrat.jpg', attribution: 'Richard Bartz', license: 'CC BY-SA 2.5' },
  wooduc: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Wood_Duck_%28Aix_sponsa%29%2C_Parc_du_Rouge-Clo%C3%AEtre%2C_Brussels.jpg/800px-Wood_Duck_%28Aix_sponsa%29%2C_Parc_du_Rouge-Clo%C3%AEtre%2C_Brussels.jpg', attribution: 'Frank Vassen', license: 'CC BY 2.0' },
  cangoo: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Canada_goose_on_Seedskadee_NWR_%2827826185489%29.jpg/800px-Canada_goose_on_Seedskadee_NWR_%2827826185489%29.jpg', attribution: 'USFWS', license: 'CC BY 2.0' },
  tundra_swan: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Tundra_Swan_RWD3.jpg/800px-Tundra_Swan_RWD3.jpg', attribution: 'DickDaniels', license: 'CC BY-SA 3.0' },

  // Shorebirds
  sander: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Sanderling_%28Calidris_alba%29.jpg/800px-Sanderling_%28Calidris_alba%29.jpg', attribution: 'Estormiz', license: 'Public Domain' },
  piping_plover: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Charadrius_melodus_-Cape_May%2C_New_Jersey%2C_USA-8.jpg/800px-Charadrius_melodus_-Cape_May%2C_New_Jersey%2C_USA-8.jpg', attribution: 'William Majoros', license: 'CC BY-SA 2.0' },

  // Songbirds
  amerob: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Turdus-migratorius-002.jpg/800px-Turdus-migratorius-002.jpg', attribution: 'CC BY-SA 3.0', license: 'CC BY-SA 3.0' },
  norcar: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Male_Northern_Cardinal.jpg/800px-Male_Northern_Cardinal.jpg', attribution: 'Dick Daniels', license: 'CC BY-SA 3.0' },
  eastbl: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Eastern_Bluebird-27527-2.jpg/800px-Eastern_Bluebird-27527-2.jpg', attribution: 'Sandysphotos2009', license: 'CC BY 2.0' },
  bkcchi: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Poecile-atricapilla-001.jpg/800px-Poecile-atricapilla-001.jpg', attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  whbnut: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Sitta-carolinensis-001.jpg/800px-Sitta-carolinensis-001.jpg', attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  balori: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Baltimore_Oriole-_dorsal_02.jpg/800px-Baltimore_Oriole-_dorsal_02.jpg', attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  scatan: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Scarlet_Tanager_%28Piranga_olivacea%29_male.jpg/800px-Scarlet_Tanager_%28Piranga_olivacea%29_male.jpg', attribution: 'Mdf', license: 'CC BY-SA 3.0' },
  indbun: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Passerina_cyanea_-Michigan%2C_USA_-male-8.jpg/800px-Passerina_cyanea_-Michigan%2C_USA_-male-8.jpg', attribution: 'GrrlScientist', license: 'CC BY 2.0' },

  // Woodpeckers
  pilwoo: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Pileated_Woodpecker_Sax-Zim_Bog_MN_IMG_8596.jpg/800px-Pileated_Woodpecker_Sax-Zim_Bog_MN_IMG_8596.jpg', attribution: 'Fyn Kynd', license: 'CC BY 2.0' },
  dowwoo: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Dryobates_pubescens_male_Palo_Alto.jpg/800px-Dryobates_pubescens_male_Palo_Alto.jpg', attribution: 'Becky Matsubara', license: 'CC BY 2.0' },

  // Great Lakes specials
  comloo: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Gavia_immer_-Minocqua%2C_Wisconsin%2C_USA_-swimming-8.jpg/800px-Gavia_immer_-Minocqua%2C_Wisconsin%2C_USA_-swimming-8.jpg', attribution: 'John Oswald', license: 'CC BY-SA 2.0' },
  sahill: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Antigone_canadensis_-Sandhill_Crane.jpg/800px-Antigone_canadensis_-Sandhill_Crane.jpg', attribution: 'Mdf', license: 'CC BY-SA 3.0' },
};

/** Get curated image for a species code */
function getCuratedImage(speciesCode) {
  return SPECIES_IMAGES[speciesCode] || null;
}

/**
 * Fetch recent bird photos from iNaturalist for a species in Michigan
 * Returns CC-licensed photos with direct URLs
 */
async function getINatPhotos(taxonName, options = {}) {
  const { perPage = 6 } = options;
  const cacheKey = `birding:inat:photos:${taxonName}`;

  try {
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch (e) { /* continue */ }

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
    await r.set(cacheKey, JSON.stringify(photos), { ex: IMG_CACHE_TTL });
  } catch (e) { /* continue */ }

  return photos;
}

/**
 * Fetch from Nuthatch API as fallback
 */
async function getNuthatchImage(commonName) {
  const cacheKey = `birding:nuthatch:${commonName}`;

  try {
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch (e) { /* continue */ }

  const res = await fetch(
    `https://nuthatch.lastelm.software/v2/birds?name=${encodeURIComponent(commonName)}&hasImg=true`,
    { headers: { 'api-key': NUTHATCH_KEY } }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const bird = data.entities?.[0];
  if (!bird || !bird.images?.length) return null;

  const result = {
    url: bird.images[0],
    sciName: bird.sciName,
    status: bird.status,
    region: bird.region?.join(', '),
  };

  try {
    const r = getRedis();
    await r.set(cacheKey, JSON.stringify(result), { ex: IMG_CACHE_TTL });
  } catch (e) { /* continue */ }

  return result;
}

/**
 * Get the best available image for a species
 * Priority: curated Wikimedia > Nuthatch > placeholder
 */
async function getBestImage(speciesCode, commonName) {
  // Try curated first (instant, no API call)
  const curated = getCuratedImage(speciesCode);
  if (curated) return { source: 'wikimedia', ...curated };

  // Try Nuthatch
  try {
    const nuthatch = await getNuthatchImage(commonName);
    if (nuthatch) return { source: 'nuthatch', ...nuthatch };
  } catch (e) { /* continue */ }

  // Placeholder
  return {
    source: 'placeholder',
    url: `/placeholder-bird.svg`,
    attribution: 'Michigan Birding Report',
    license: 'n/a',
  };
}

module.exports = {
  SPECIES_IMAGES,
  getCuratedImage,
  getINatPhotos,
  getNuthatchImage,
  getBestImage,
};
