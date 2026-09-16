'use strict';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.status(200).json({
    ok: true,
    ebirdApiKeyConfigured: Boolean(process.env.EBIRD_API_KEY),
    upstashRedisUrlConfigured: Boolean(process.env.UPSTASH_REDIS_URL),
    upstashRedisTokenConfigured: Boolean(process.env.UPSTASH_REDIS_TOKEN),
  });
};
