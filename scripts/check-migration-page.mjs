import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/migration.html', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/migration-intelligence.js', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../lib/migration.js', import.meta.url), 'utf8');

const checks = [
  ['canonical migration URL', /rel="canonical" href="https:\/\/michiganbirdingreport\.com\/migration"/.test(html)],
  ['search title owns Michigan migration today', /Michigan Bird Migration Today/.test(html)],
  ['tonight decision flow', /Tonight’s Michigan pulse/.test(html)],
  ['tomorrow morning decision', /Where should I bird in Michigan\?/.test(html)],
  ['migration map', /id="migrationMap"/.test(html)],
  ['live API', /\/api\/migration-intelligence/.test(html)],
  ['official BirdCast dashboard', /dashboard\.birdcast\.info\/region\/US-MI/.test(html)],
  ['no legacy birdcast.org links', !/https:\/\/birdcast\.org/.test(html)],
  ['BirdCast truth boundary', /BirdCast is the flight truth/.test(html)],
  ['NWS source boundary', /National Weather Service/.test(html)],
  ['eBird source boundary', />eBird</.test(html)],
  ['species handoff', /\/species\/\$\{encodeURIComponent/.test(html)],
  ['county handoff', /countyPage/.test(api)],
  ['six focal regions', /REGIONS\.map/.test(api) && /Whitefish Point/.test(logic) && /Tawas Point/.test(logic)],
  ['spring and fall windows', /March 1–June 15/.test(logic) && /August 1–November 15/.test(logic)],
  ['no browser geolocation', !/navigator\.geolocation/.test(html)],
  ['radar not scraped', /birdcastIngested:\s*false/.test(api)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${name}`);
if (failed.length) {
  console.error(`Migration page checks failed: ${failed.map(([n]) => n).join(', ')}`);
  process.exit(1);
}
console.log(`Migration page checks: PASS (${checks.length}/${checks.length})`);
