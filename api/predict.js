/**
 * api/predict.js — Weather-driven birding predictions + ask about any bird
 * 
 * Two modes:
 *   ?mode=forecast&region=saginaw-bay  → What to expect this weekend
 *   ?mode=bird&name=Scarlet Tanager    → What's this bird doing right now?
 */

const { Redis } = require('@upstash/redis');
const { getWeather } = require('../lib/weather');
const { getNotableSightings, getRecentObservations } = require('../lib/ebird');
const { getBestImage } = require('../lib/media');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const FORECAST_TTL = 3600;   // 1 hour for regional forecasts
const BIRD_TTL = 86400 * 30; // 30 days for individual bird predictions (per season)

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

function getSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}

module.exports = async (req, res) => {
  try {
    const mode = req.query.mode || 'forecast';

    if (mode === 'bird') {
      return handleBirdQuery(req, res);
    } else {
      return handleForecast(req, res);
    }
  } catch (err) {
    console.error('Predict API error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ============ REGIONAL FORECAST ============

async function handleForecast(req, res) {
  const region = req.query.region || 'saginaw-bay';
  const cacheKey = `birding:forecast:${region}:${new Date().toISOString().slice(0,13)}`; // hourly

  try {
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.status(200).json({ ...data, cached: true });
    }
  } catch (e) { /* continue */ }

  // Gather data
  const [weather, notable] = await Promise.all([
    getWeather(region).catch(() => null),
    getNotableSightings('US-MI', { back: 3, maxResults: 15 }).catch(() => []),
  ]);

  const today = new Date();
  const season = getSeason();

  if (!ANTHROPIC_KEY) {
    const result = buildStaticForecast(weather, notable, region, season);
    return res.status(200).json(result);
  }

  const weatherContext = weather ? `
Current weather at ${weather.region}: ${weather.current.temp}°${weather.current.tempUnit}, winds ${weather.current.windDir} ${weather.current.wind}. ${weather.current.shortForecast}.
Tonight: ${weather.tonight.temp}°${weather.tonight.tempUnit}, winds ${weather.tonight.windDir} ${weather.tonight.wind}. ${weather.tonight.shortForecast}.
Tomorrow: ${weather.tomorrow.shortForecast}, high ${weather.tomorrow.temp}°.` : 'Weather data unavailable.';

  const notableContext = notable.slice(0, 10).map(s =>
    `${s.comName} at ${s.locName} (${s.obsDt})`
  ).join('\n');

  const prompt = `You are a Michigan birding expert. Today is ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}. Season: ${season}.

${weatherContext}

Recent notable sightings in Michigan:
${notableContext || 'None in the past 3 days.'}

Write a weather-driven birding prediction for the ${weather?.region || 'Michigan'} area. Return JSON:

{
  "headline": "One punchy sentence summarizing conditions (e.g. 'South winds tonight set up a big migration morning')",
  "conditions": "2-3 sentences about how current weather affects bird activity. Be specific about wind direction, fronts, pressure.",
  "whatToExpect": "3-4 sentences about what birds to expect based on weather, season, and recent sightings. Name specific species.",
  "whereToBe": "2-3 sentences recommending specific locations and timing.",
  "migrationOutlook": "1-2 sentences about migration intensity tonight/this week."
}

Return ONLY valid JSON. No markdown.`;

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) throw new Error('Haiku API ' + aiRes.status);

    const aiData = await aiRes.json();
    const text = (aiData.content?.[0]?.text || '').replace(/```json\s*/g, '').replace(/```/g, '').trim();
    const prediction = JSON.parse(text);

    const result = {
      region: weather?.region || region,
      season,
      weather: weather ? {
        temp: weather.current.temp,
        wind: `${weather.current.windDir} ${weather.current.wind}`,
        forecast: weather.current.shortForecast,
        tonight: weather.tonight.shortForecast,
      } : null,
      birdingConditions: weather?.birdingConditions || [],
      prediction,
      notableCount: notable.length,
      source: 'haiku',
    };

    try {
      const r = getRedis();
      await r.set(cacheKey, JSON.stringify(result), { ex: FORECAST_TTL });
    } catch (e) { /* continue */ }

    res.status(200).json(result);
  } catch (e) {
    console.error('Forecast generation error:', e.message);
    res.status(200).json(buildStaticForecast(weather, notable, region, season));
  }
}

function buildStaticForecast(weather, notable, region, season) {
  return {
    region: weather?.region || region,
    season,
    weather: weather ? {
      temp: weather.current.temp,
      wind: `${weather.current.windDir} ${weather.current.wind}`,
      forecast: weather.current.shortForecast,
      tonight: weather.tonight.shortForecast,
    } : null,
    birdingConditions: weather?.birdingConditions || [],
    prediction: null,
    notableCount: notable?.length || 0,
    source: 'static',
  };
}

// ============ ASK ABOUT A BIRD ============

async function handleBirdQuery(req, res) {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'name parameter required' });

  const season = getSeason();
  const cacheKey = `birding:birdask:${name.toLowerCase().replace(/[^a-z]/g, '')}:${season}`;

  try {
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      // Always fetch fresh image
      const image = await getBestImage('', name);
      return res.status(200).json({ ...data, image, cached: true });
    }
  } catch (e) { /* continue */ }

  const image = await getBestImage('', name);

  if (!ANTHROPIC_KEY) {
    return res.status(200).json({
      name,
      season,
      image,
      prediction: `${name} in Michigan during ${season}: check eBird for recent sighting reports and seasonal frequency data.`,
      source: 'static',
    });
  }

  const today = new Date();
  const weather = await getWeather('saginaw-bay').catch(() => null);

  const prompt = `You are a Michigan birding expert. A birder asks: "What is ${name} doing right now in Michigan?"

Today is ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Season: ${season}.
${weather ? `Current weather: ${weather.current.temp}°F, winds ${weather.current.windDir} ${weather.current.wind}, ${weather.current.shortForecast}.` : ''}

Write a JSON response:
{
  "status": "One sentence: is this bird in Michigan right now? Migrating through? Breeding? Wintering? Gone?",
  "activity": "2-3 sentences: what is this species doing right now given the season and weather? Be specific.",
  "findIt": "2 sentences: where in Michigan to look and what time of day. Name real places.",
  "lookFor": "1-2 sentences: key field marks or behaviors to watch for right now.",
  "likelihood": "low/medium/high — how likely is a Michigan birder to see this species today?"
}

Return ONLY valid JSON.`;

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) throw new Error('Haiku ' + aiRes.status);

    const aiData = await aiRes.json();
    const text = (aiData.content?.[0]?.text || '').replace(/```json\s*/g, '').replace(/```/g, '').trim();
    const prediction = JSON.parse(text);

    const result = {
      name,
      season,
      prediction,
      source: 'haiku',
    };

    try {
      const r = getRedis();
      await r.set(cacheKey, JSON.stringify(result), { ex: BIRD_TTL });
    } catch (e) { /* continue */ }

    res.status(200).json({ ...result, image });
  } catch (e) {
    console.error('Bird query error:', e.message);
    res.status(200).json({
      name, season, image,
      prediction: { status: `Check eBird for current ${name} reports in Michigan.` },
      source: 'static',
    });
  }
}
