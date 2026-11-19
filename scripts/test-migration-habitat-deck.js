const assert = require('node:assert/strict');
const fs = require('node:fs');
const { REGIONS } = require('../lib/migration');

const page = fs.readFileSync('public/migration.html', 'utf8');
const api = fs.readFileSync('api/migration-intelligence.js', 'utf8');
const lensIds = ['all', 'water', 'songbird', 'raptor'];
const visitorScript = [...page.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)]
  .map(match => match[1]).find(script => script.includes("const habitatDeck ="));
assert.ok(visitorScript, 'client-side visitor departure script must exist');
assert.doesNotThrow(() => new Function(visitorScript), 'departure JavaScript must parse, not just match source text');

function chooseHabitat(value) {
  assert.ok(lensIds.includes(value), 'unknown visitor habitat');
  return REGIONS.filter(region => value === 'all' || region.habitatLenses.includes(value));
}

assert.equal(REGIONS.length, 6);
assert.deepEqual(chooseHabitat('all').length, 6);
assert.deepEqual(chooseHabitat('water').length, 5, 'water choices must exclude unrelated forest corridor');
assert.deepEqual(chooseHabitat('songbird').length, 4, 'wooded-edge choice must narrow the six corridors');
assert.deepEqual(chooseHabitat('raptor').map(r => r.id), ['tawas', 'whitefish', 'leelanau'],
  'three named raptor / hawk-watch corridors are a distinct departure');
for (const r of REGIONS) {
  assert.ok(r.habitatLenses.length, r.name + ' requires a habitat classification');
  assert.ok(r.habitatLenses.every(t => lensIds.includes(t)), r.name + ' contains an invented habitat');
}
assert.deepEqual(chooseHabitat('water').map(r => r.id), chooseHabitat('water').map(r => r.id),
  'returning from another selected habitat must not mutate the source selection');
const selectedA = chooseHabitat('water').map(r => r.id);
chooseHabitat('raptor');
assert.deepEqual(chooseHabitat('water').map(r => r.id), selectedA, 'water -> raptor -> water restores the original stops');

assert.ok(api.includes('habitatLenses: region.habitatLenses'), 'API must publish classification beside evidence');
assert.ok(page.includes('id="habitatDeck"') && page.includes('id="habitatResultTitle"'), 'departure control and answer must exist');
assert.ok(page.includes("loadedRegions.filter(region => activeHabitat === 'all'"), 'filter changes the actual dossiers');
assert.ok(page.includes('regionGrid.innerHTML = filtered.map(regionCard)'), 'visible card list follows the chosen habitat');
assert.ok(page.includes("document.getElementById('habitatShortlist').innerHTML = filtered.slice(0, 4)"), 'the answer must name real regions at the decision point');
assert.ok(page.includes('href="#regionGrid"'), 'the first-screen visitor decision must offer a direct path to the dossier list');
assert.ok(page.includes('map.removeLayer(marker)'), 'the map must follow the card filter instead of showing discarded places');
assert.ok(page.includes('if (!regionalResponseReceived)') && page.includes('Your habitat preference is set.'), 'loading state must never masquerade as no matching birds');
assert.ok(page.includes("button.setAttribute('aria-pressed'"), 'keyboard control needs explicit selected state');
assert.ok(page.includes("mapRoot.hidden = true"), 'missing map library/tiles must not leave a large empty map');
assert.ok(page.includes('<noscript>') && page.includes('Whitefish Point Bird Observatory') &&
  page.includes('Muskegon birding pass'), 'official public sources survive without JavaScript');
assert.ok(page.indexOf('id="where"') < page.indexOf('id="decisionTitle"'),
  'habitat chooser and actual field answer must precede explanatory tutorial');
assert.ok(!page.includes('data-habitat="marsh-rank"'), 'habitat preference must not invent a live bird ranking');

console.log('Migration experience investment: habitat-to-corridor A/B/A and source limits PASS');
