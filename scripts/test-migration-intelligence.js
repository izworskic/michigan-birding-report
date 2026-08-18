const assert = require('assert');
const {
  REGIONS,
  getMigrationSeason,
  classifyFlightSetup,
  summarizeObservations,
  morningRecommendation,
  expectedGroups,
  summarizeState,
} = require('../lib/migration');

assert.strictEqual(REGIONS.length, 6, 'six focal migration regions');

const spring = getMigrationSeason(new Date('2026-05-10T12:00:00Z'));
assert.strictEqual(spring.active, true);
assert.strictEqual(spring.key, 'spring');
assert.strictEqual(spring.direction, 'northbound');

const fall = getMigrationSeason(new Date('2026-08-18T12:00:00Z'));
assert.strictEqual(fall.active, true);
assert.strictEqual(fall.key, 'fall');
assert.strictEqual(fall.direction, 'southbound');

assert.strictEqual(getMigrationSeason(new Date('2026-06-16T12:00:00Z')).active, false);
assert.strictEqual(getMigrationSeason(new Date('2026-11-16T12:00:00Z')).active, false);

const northFall = classifyFlightSetup({
  tonight: { windDir: 'NW', shortForecast: 'Mostly clear' }
}, fall);
assert.strictEqual(northFall.key, 'favorable');

const southFall = classifyFlightSetup({
  tonight: { windDir: 'S', shortForecast: 'Mostly clear' }
}, fall);
assert.strictEqual(southFall.key, 'holding');

const rainFall = classifyFlightSetup({
  tonight: { windDir: 'N', shortForecast: 'Rain showers likely' }
}, fall);
assert.strictEqual(rainFall.key, 'fallout-watch');

const obs = summarizeObservations([
  { speciesCode:'amered', comName:'American Redstart', locName:'A', obsDt:'2026-08-18 08:00' },
  { speciesCode:'amered', comName:'American Redstart', locName:'B', obsDt:'2026-08-18 09:00' },
  { speciesCode:'swathr', comName:"Swainson's Thrush", locName:'C', obsDt:'2026-08-17 09:00' },
]);
assert.strictEqual(obs.speciesCount, 2);
assert.strictEqual(obs.recentSpecies[0].location, 'B');

const morning = morningRecommendation(rainFall, obs);
assert.strictEqual(morning.label, 'High-interest dawn check');

const groups = expectedGroups(new Date('2026-10-03T12:00:00Z'));
assert(groups.includes('Sparrows'));
assert(groups.includes('Waterfowl'));

const pulse = summarizeState([
  { flight:{ key:'favorable' } },
  { flight:{ key:'favorable' } },
  { flight:{ key:'favorable' } },
  { flight:{ key:'favorable' } },
  { flight:{ key:'mixed' } },
  { flight:{ key:'holding' } },
], fall);
assert.match(pulse.headline, /Broad/);

console.log('Migration intelligence logic: PASS');
