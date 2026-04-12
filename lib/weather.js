/**
 * lib/weather.js — NWS weather data for birding predictions
 * Wind direction, pressure trends, fronts = migration drivers
 */

const { Redis } = require('@upstash/redis');
const CACHE_TTL = 1800; // 30 minutes

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

// Michigan NWS grid points for key birding regions
const MI_GRIDS = {
  'saginaw-bay': { office: 'DTX', gridX: 65, gridY: 72, label: 'Saginaw Bay' },
  'tawas':       { office: 'APX', gridX: 112, gridY: 52, label: 'Tawas Point' },
  'southeast':   { office: 'DTX', gridX: 65, gridY: 55, label: 'SE Michigan' },
  'southwest':   { office: 'GRR', gridX: 35, gridY: 35, label: 'SW Michigan' },
  'northwest':   { office: 'APX', gridX: 55, gridY: 65, label: 'NW Lower' },
  'upper-east':  { office: 'APX', gridX: 130, gridY: 95, label: 'Eastern UP' },
  'upper-west':  { office: 'MQT', gridX: 55, gridY: 55, label: 'Western UP' },
};

async function getWeather(regionKey) {
  const grid = MI_GRIDS[regionKey] || MI_GRIDS['saginaw-bay'];
  const cacheKey = `birding:wx:${regionKey}`;

  try {
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch (e) { /* continue */ }

  try {
    const url = `https://api.weather.gov/gridpoints/${grid.office}/${grid.gridX},${grid.gridY}/forecast`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MichiganBirdingReport/1.0 (birding.chrisizworski.com)' },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const periods = data.properties?.periods || [];

    // Extract birding-relevant conditions
    const current = periods[0] || {};
    const tonight = periods.find(p => p.name?.toLowerCase().includes('tonight') || p.name?.toLowerCase().includes('night')) || periods[1] || {};
    const tomorrow = periods.find(p => p.name?.toLowerCase().includes('tomorrow') || p.number === 3) || periods[2] || {};

    const result = {
      region: grid.label,
      current: {
        name: current.name,
        temp: current.temperature,
        tempUnit: current.temperatureUnit,
        wind: current.windSpeed,
        windDir: current.windDirection,
        shortForecast: current.shortForecast,
        detailed: current.detailedForecast,
      },
      tonight: {
        name: tonight.name,
        temp: tonight.temperature,
        wind: tonight.windSpeed,
        windDir: tonight.windDirection,
        shortForecast: tonight.shortForecast,
      },
      tomorrow: {
        name: tomorrow.name,
        temp: tomorrow.temperature,
        wind: tomorrow.windSpeed,
        windDir: tomorrow.windDirection,
        shortForecast: tomorrow.shortForecast,
      },
      birdingConditions: assessBirdingConditions(current, tonight),
      updated: new Date().toISOString(),
    };

    try {
      const r = getRedis();
      await r.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });
    } catch (e) { /* continue */ }

    return result;
  } catch (e) {
    console.error('Weather error:', e.message);
    return null;
  }
}

function assessBirdingConditions(current, tonight) {
  const conditions = [];
  const windDir = (current.windDirection || '').toUpperCase();
  const windSpd = current.windSpeed || '';
  const forecast = (current.shortForecast || '').toLowerCase();
  const month = new Date().getMonth() + 1;

  // Wind analysis for migration
  const southWinds = ['S', 'SSW', 'SSE', 'SW', 'SE'].includes(windDir);
  const northWinds = ['N', 'NNW', 'NNE', 'NW', 'NE'].includes(windDir);
  const lightWind = windSpd.includes('5') || windSpd.includes('to 10');

  if (month >= 3 && month <= 5) { // Spring migration
    if (southWinds) {
      conditions.push({ type: 'positive', text: 'South winds favoring northbound migration tonight. Expect new arrivals tomorrow morning.' });
    }
    if (northWinds) {
      conditions.push({ type: 'caution', text: 'North winds may slow migration. Birds already here may concentrate at stopover sites.' });
    }
    if (forecast.includes('rain') || forecast.includes('storm')) {
      conditions.push({ type: 'alert', text: 'Rain or storms can ground migrating birds, creating fallout conditions. Check lakeshores and parks at dawn.' });
    }
    if (southWinds && lightWind && !forecast.includes('rain')) {
      conditions.push({ type: 'positive', text: 'Light south winds with clear skies: ideal migration conditions. Could be a big night.' });
    }
  } else if (month >= 8 && month <= 11) { // Fall migration
    if (northWinds) {
      conditions.push({ type: 'positive', text: 'North winds pushing southbound migrants through. Check hawk watch sites and shoreline traps.' });
    }
    if (southWinds) {
      conditions.push({ type: 'caution', text: 'South winds slowing fall migration. Migrants may hold at current locations.' });
    }
    if (forecast.includes('cold front')) {
      conditions.push({ type: 'alert', text: 'Cold front passage triggers major fall migration pushes. Get out early tomorrow.' });
    }
  } else if (month >= 6 && month <= 7) { // Breeding
    conditions.push({ type: 'info', text: 'Breeding season: dawn chorus is strongest before 8am. Shorebird return migration begins in July.' });
  } else { // Winter
    if (forecast.includes('snow') || forecast.includes('ice')) {
      conditions.push({ type: 'info', text: 'Winter weather concentrates birds at feeders and open water. Check heated birdbaths and unfrozen streams.' });
    }
    conditions.push({ type: 'info', text: 'Winter birding: scan for owls at dusk, check conifer groves for winter finches, watch open water for lingering waterfowl.' });
  }

  if (!conditions.length) {
    conditions.push({ type: 'info', text: 'Conditions are moderate for birding. Early morning is always best.' });
  }

  return conditions;
}

module.exports = { getWeather, MI_GRIDS };
