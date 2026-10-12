'use strict';
// Private Postgres-backed state. No Redis service, credentials or network fallback.
const { getVercelOidcToken } = require('@vercel/oidc');
const { gzipSync, gunzipSync } = require('node:zlib');
const PREFIX = 'tool-state:gzip:v1:';
function stateReady(env = process.env) { return Boolean(env.TOOL_STATE_URL); }
function encode(value) {
  if (typeof value !== 'string') return value;
  if (Buffer.byteLength(value) <= 4096 && !value.startsWith(PREFIX)) return value;
  return PREFIX + gzipSync(Buffer.from(value)).toString('base64');
}
function decode(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  return gunzipSync(Buffer.from(value.slice(PREFIX.length), 'base64'), { maxOutputLength: 16 * 1024 * 1024 }).toString();
}
async function stateCommand(command, { env = process.env, fetchImpl = fetch, timeoutMs = 7000, getTokenImpl } = {}) {
  if (!stateReady(env)) throw new Error('Private tool state is not configured');
  // Read the current request token, not a build-time/module-level cached token.
  const token = await (getTokenImpl ? getTokenImpl() : env === process.env ? getVercelOidcToken() : env.VERCEL_OIDC_TOKEN);
  if (!token) throw new Error('Private tool state requires a Vercel deployment identity');
  const args = [...command];
  if (args[0] === 'SET') args[2] = encode(String(args[2]));
  const response = await fetchImpl(env.TOOL_STATE_URL, {
    method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) throw new Error('Private tool state failed (' + response.status + ')');
  if (args[0] === 'GET') return decode(json.result);
  if (args[0] === 'MGET') return (json.result || []).map(decode);
  return json.result;
}
function serialize(value) { return typeof value === 'string' ? value : JSON.stringify(value); }
function deserialize(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}
class ToolState {
  constructor(options = {}) { this.options = options; }
  command(args) { return stateCommand(args, this.options); }
  async get(key) { return deserialize(await this.command(['GET', key])); }
  async set(key, value, options = {}) {
    const args = ['SET', key, serialize(value)];
    if (options.ex != null) args.push('EX', options.ex);
    if (options.px != null) args.push('PX', options.px);
    if (options.nx) args.push('NX');
    return this.command(args);
  }
  async mget(...keys) { return (await this.command(['MGET', ...keys.flat()])).map(deserialize); }
  del(...keys) { return this.command(['DEL', ...keys.flat()]); }
  sadd(key, ...members) { return this.command(['SADD', key, ...members.flat().map(serialize)]); }
  srem(key, ...members) { return this.command(['SREM', key, ...members.flat().map(serialize)]); }
  async smembers(key) { return (await this.command(['SMEMBERS', key])).map(deserialize); }
  scard(key) { return this.command(['SCARD', key]); }
  sismember(key, member) { return this.command(['SISMEMBER', key, serialize(member)]); }
  incr(key) { return this.command(['INCR', key]); }
  lpush(key, ...values) { return this.command(['LPUSH', key, ...values.flat().map(serialize)]); }
  async lrange(key, start, end) { return (await this.command(['LRANGE', key, start, end])).map(deserialize); }
}
module.exports = { stateReady, stateCommand, ToolState, _codec: { encode, decode } };
