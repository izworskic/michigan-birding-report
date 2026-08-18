import fs from 'node:fs';
import assert from 'node:assert/strict';

const home = fs.readFileSync('public/app.js','utf8');
const counties = fs.readFileSync('public/counties/index.html','utf8');
const species = fs.readFileSync('public/species/index.html','utf8');

const intents = [...home.matchAll(/data-bird-intent="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(intents, ['near-me','today','migration','species'], 'homepage must expose exactly four task-first intents');

for (const text of ['Birds near me','Where should I bird today?','Track migration','Find a bird']) {
  assert.ok(home.includes(text), `homepage missing task label: ${text}`);
}
for (const href of ['/counties','/predictions','/migration','/species']) {
  assert.ok(home.includes(`href="${href}"`), `homepage missing route: ${href}`);
}
assert.ok(home.includes("a.textContent='Today'"), 'homepage nav should translate Predict into Today');
assert.ok(home.includes("Live notable sightings"), 'live sightings should remain immediately after task router');

assert.ok(counties.includes('<link rel="canonical" href="https://michiganbirdingreport.com/counties">'), 'county canonical changed');
assert.ok(counties.includes('id="countySearch"'), 'county finder missing');
assert.ok(counties.includes('All 83 counties'), 'crawlable county list must remain');
assert.equal((counties.match(/href="\/county\//g)||[]).length, 83, 'all 83 county links must remain crawlable');

assert.ok(species.includes('<link rel="canonical" href="https://michiganbirdingreport.com/species">'), 'species canonical changed');
assert.ok(species.includes('id="speciesQuery"'), 'species finder missing');
assert.ok(species.includes('Search any Michigan bird'), 'species task language missing');
assert.ok(species.includes('/predictions?name='), 'arbitrary species search must hand off to existing intelligence tool');
assert.equal((species.match(/href="\/species\//g)||[]).length, 15, 'existing highlighted species links must remain');

const routerCopy = [...home.matchAll(/<span>([^<]+)<\/span>/g)].slice(0,4).map(m=>m[1]);
assert.equal(routerCopy.length,4,'four concise intent descriptions required');
for (const copy of routerCopy) {
  assert.ok(copy.trim().split(/\s+/).length <= 14, `intent description too verbose: ${copy}`);
}

console.log('Bird persona routing: PASS');
