'use strict';

const { getNearbyHotspots, getNotableNearby } = require('../lib/ebird');

const EBIRD_BASE = 'https://api.ebird.org/v2';
const EBIRD_KEY = process.env.EBIRD_API_KEY;

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max, fallback) {
  const n = finite(value);
  return n == null ? fallback : Math.min(max, Math.max(min, n));
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const R = 3958.7613;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function evidenceBand(count, maxCount) {
  if (!maxCount || maxCount < 1) return { rank: 0, label: 'limited current evidence' };
  const ratio = count / maxCount;
  if (ratio >= 0.8) return { rank: 3, label: 'top current evidence' };
  if (ratio >= 0.6) return { rank: 2, label: 'strong current evidence' };
  return { rank: 1, label: 'some current evidence' };
}

function summarizeChoice(place, extra = {}) {
  if (!place) return null;
  return {
    locId: place.locId,
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    distanceMi: place.distanceMi,
    recentSpeciesCount: place.recentSpeciesCount,
    notableCount: place.notableCount,
    evidenceBand: place.evidenceBand,
    latest: place.latest,
    targetSpecies: place.targetSpecies,
    ebirdUrl: place.ebirdUrl,
    ...extra,
  };
}

function pickDecisionChoices(rankedPlaces) {
  if (!Array.isArray(rankedPlaces) || !rankedPlaces.length) {
    return {
      strongestCurrentEvidence: null,
      closerStrongOption: null,
      rule: 'A closer option is only shown when it remains in the strong current-evidence band and is meaningfully closer than the strongest-evidence hotspot.',
    };
  }

  const strongest = [...rankedPlaces].sort((a, b) =>
    b.recentSpeciesCount - a.recentSpeciesCount ||
    b.notableCount - a.notableCount ||
    (a.distanceMi ?? 999) - (b.distanceMi ?? 999) ||
    String(b.latest || '').localeCompare(String(a.latest || ''))
  )[0];

  let closer = null;
  if (Number.isFinite(strongest?.distanceMi)) {
    const minSavings = Math.max(2, strongest.distanceMi * 0.15);
    closer = rankedPlaces
      .filter(place =>
        place.locId !== strongest.locId &&
        place.evidenceRank >= 2 &&
        Number.isFinite(place.distanceMi) &&
        strongest.distanceMi - place.distanceMi >= minSavings
      )
      .sort((a, b) =>
        (a.distanceMi ?? 999) - (b.distanceMi ?? 999) ||
        b.recentSpeciesCount - a.recentSpeciesCount ||
        b.notableCount - a.notableCount ||
        String(b.latest || '').localeCompare(String(a.latest || ''))
      )[0] || null;
  }

  const distanceSavedMi = closer && Number.isFinite(strongest.distanceMi)
    ? Math.round((strongest.distanceMi - closer.distanceMi) * 10) / 10
    : null;

  return {
    strongestCurrentEvidence: summarizeChoice(strongest),
    closerStrongOption: summarizeChoice(closer, {
      distanceSavedMi,
      speciesTradeoff: strongest && closer ? strongest.recentSpeciesCount - closer.recentSpeciesCount : null,
    }),
    rule: 'A closer option is only shown when it remains in the strong current-evidence band and is meaningfully closer than the strongest-evidence hotspot.',
  };
}

async function getRecentNearby(lat, lng, { distKm = 40, back = 3, maxResults = 300 } = {}) {
  if (!EBIRD_KEY) throw new Error('EBIRD_API_KEY is not configured');
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    dist: String(distKm),
    back: String(back),
    maxResults: String(maxResults),
    hotspot: 'true',
    cat: 'species',
  });
  const response = await fetch(`${EBIRD_BASE}/data/obs/geo/recent?${params}`, {
    headers: { 'x-ebirdapitoken': EBIRD_KEY },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`eBird recent-nearby API ${response.status}`);
  return response.json();
}

function normalizeHotspot(h) {
  return {
    locId: h.locId || null,
    name: h.locName || 'eBird hotspot',
    lat: finite(h.lat),
    lon: finite(h.lng),
    latestObsDt: h.latestObsDt || null,
    allTimeSpecies: finite(h.numSpeciesAllTime),
  };
}

function buildAction(lat, lng, observations, hotspots, notableSightings, back) {
  const hotspotMeta = new Map((hotspots || []).filter(h => h && h.locId).map(h => [h.locId, normalizeHotspot(h)]));
  const places = new Map();

  for (const o of observations || []) {
    if (!o || !o.locId || !o.comName) continue;
    const meta = hotspotMeta.get(o.locId) || {
      locId: o.locId,
      name: o.locName || 'eBird hotspot',
      lat: finite(o.lat),
      lon: finite(o.lng),
      latestObsDt: null,
      allTimeSpecies: null,
    };
    if (!places.has(o.locId)) {
      places.set(o.locId, {
        ...meta,
        species: new Map(),
        notable: new Map(),
        latest: o.obsDt || meta.latestObsDt || null,
      });
    }
    const place = places.get(o.locId);
    const key = o.speciesCode || o.comName;
    const current = place.species.get(key);
    if (!current || String(o.obsDt || '') > String(current.obsDt || '')) {
      place.species.set(key, {
        speciesCode: o.speciesCode || null,
        name: o.comName,
        sciName: o.sciName || null,
        obsDt: o.obsDt || null,
        count: finite(o.howMany),
      });
    }
    if (String(o.obsDt || '') > String(place.latest || '')) place.latest = o.obsDt || place.latest;
  }

  const notableBySpecies = new Map();
  for (const n of notableSightings || []) {
    if (!n || !n.comName || n.locationPrivate) continue;
    const speciesKey = n.speciesCode || n.comName;
    const current = notableBySpecies.get(speciesKey);
    if (!current || String(n.obsDt || '') > String(current.obsDt || '')) {
      notableBySpecies.set(speciesKey, {
        speciesCode: n.speciesCode || null,
        name: n.comName,
        sciName: n.sciName || null,
        location: n.locName || null,
        locId: n.locId || null,
        lat: finite(n.lat),
        lon: finite(n.lng),
        obsDt: n.obsDt || null,
        count: finite(n.howMany),
      });
    }
    if (n.locId && places.has(n.locId)) {
      const p = places.get(n.locId);
      p.notable.set(speciesKey, notableBySpecies.get(speciesKey));
    }
  }

  const preparedPlaces = [...places.values()].map(place => {
    const species = [...place.species.values()].sort((a, b) => String(b.obsDt || '').localeCompare(String(a.obsDt || '')));
    const notable = [...place.notable.values()].sort((a, b) => String(b.obsDt || '').localeCompare(String(a.obsDt || '')));
    const distanceMi = Number.isFinite(place.lat) && Number.isFinite(place.lon)
      ? haversineMiles(lat, lng, place.lat, place.lon)
      : null;
    return {
      locId: place.locId,
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      distanceMi: distanceMi == null ? null : Math.round(distanceMi * 10) / 10,
      recentSpeciesCount: species.length,
      notableCount: notable.length,
      latest: place.latest,
      allTimeSpecies: place.allTimeSpecies,
      targetSpecies: [...notable, ...species.filter(s => !notable.some(n => n.speciesCode && n.speciesCode === s.speciesCode))].slice(0, 6),
      notableSpecies: notable.slice(0, 4),
      ebirdUrl: place.locId ? `https://ebird.org/hotspot/${encodeURIComponent(place.locId)}` : 'https://ebird.org/hotspots',
    };
  });

  const maxRecentSpecies = preparedPlaces.reduce((max, p) => Math.max(max, p.recentSpeciesCount || 0), 0);
  const rankedAll = preparedPlaces.map(place => {
    const band = evidenceBand(place.recentSpeciesCount, maxRecentSpecies);
    const parts = [`${band.label}: ${place.recentSpeciesCount} distinct recent species records represented`];
    if (place.notableCount) parts.push(`${place.notableCount} notable species`);
    if (Number.isFinite(place.distanceMi)) parts.push(`${place.distanceMi.toFixed(1)} mi away`);
    return {
      ...place,
      evidenceBand: band.label,
      evidenceRank: band.rank,
      why: parts.join(' · '),
    };
  }).sort((a, b) =>
    b.evidenceRank - a.evidenceRank ||
    b.notableCount - a.notableCount ||
    (a.distanceMi ?? 999) - (b.distanceMi ?? 999) ||
    b.recentSpeciesCount - a.recentSpeciesCount ||
    String(b.latest || '').localeCompare(String(a.latest || ''))
  );

  const rankedPlaces = rankedAll.slice(0, 6);
  const decisionChoices = pickDecisionChoices(rankedAll);

  const notables = [...notableBySpecies.values()]
    .sort((a, b) => String(b.obsDt || '').localeCompare(String(a.obsDt || '')))
    .slice(0, 8);

  const uniqueSpecies = new Map();
  for (const o of observations || []) {
    if (!o || !o.comName) continue;
    const key = o.speciesCode || o.comName;
    const current = uniqueSpecies.get(key);
    if (!current || String(o.obsDt || '') > String(current.obsDt || '')) {
      uniqueSpecies.set(key, {
        speciesCode: o.speciesCode || null,
        name: o.comName,
        sciName: o.sciName || null,
        location: o.locName || null,
        obsDt: o.obsDt || null,
      });
    }
  }

  return {
    reportingWindowDays: back,
    observationSemantics: 'recent-species-records-at-ebird-hotspots',
    rankingRule: 'Group hotspots by recent species evidence relative to the strongest nearby hotspot; within comparable evidence, notable sightings and proximity outrank tiny recency differences.',
    decisionChoices,
    speciesCount: uniqueSpecies.size,
    hotspotRecordCount: (observations || []).length,
    nearbyHotspotCount: (hotspots || []).length,
    topPlaces: rankedPlaces,
    notableSightings: notables,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const lat = finite(req.query.lat);
    const lng = finite(req.query.lng ?? req.query.lon);
    if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: 'Valid lat and lng are required.' });
    }

    const distKm = clamp(req.query.distKm, 5, 50, 40);
    const back = Math.round(clamp(req.query.back, 1, 7, 3));

    const [observations, hotspots, notable] = await Promise.all([
      getRecentNearby(lat, lng, { distKm, back, maxResults: 300 }),
      getNearbyHotspots(lat, lng, { dist: distKm }),
      getNotableNearby(lat, lng, { dist: distKm, back }),
    ]);

    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      center: { lat, lng },
      radiusKm: distKm,
      radiusMi: Math.round(distKm * 0.621371 * 10) / 10,
      ...buildAction(lat, lng, observations, hotspots, notable, back),
      sources: {
        observations: 'eBird recent nearby observations',
        hotspots: 'eBird nearby hotspots',
        notable: 'eBird recent notable nearby observations',
      },
    });
  } catch (err) {
    console.error('Local action API error:', err);
    return res.status(502).json({ ok: false, error: 'Local birding action data are temporarily unavailable.' });
  }
};

module.exports._test = { buildAction, haversineMiles, evidenceBand, pickDecisionChoices };
