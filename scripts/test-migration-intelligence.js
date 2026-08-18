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

assert.strictEqual(getMigrationSeason(new Date('2026-06-16T02:30:00Z')).active, true, 'June 15 remains spring migration in Michigan before local midnight');
assert.strictEqual(getMigrationSeason(new Date('2026-06-16T04:30:00Z')).active, false, 'June 16 local date ends spring live window');
assert.strictEqual(getMigrationSeason(new Date('2026-11-16T04:30:00Z')).active, true, 'November 15 remains fall migration in Michigan before local midnight');
assert.strictEqual(getMigrationSeason(new Date('2026-11-16T05:30:00Z')).active, false, 'November 16 local date ends fall live window');

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
], new Date('2026-08-19T02:30:00Z'));
assert.strictEqual(obs.speciesCount, 2);
assert.strictEqual(obs.recentSpecies[0].location, 'B');
assert.strictEqual(obs.freshness, 'today', 'eBird local date stays today until Michigan midnight');

const yesterdayObs = summarizeObservations([
  { speciesCode:'amered', comName:'American Redstart', locName:'A', obsDt:'2026-08-18 08:00' },
], new Date('2026-08-19T05:30:00Z'));
assert.strictEqual(yesterdayObs.freshness, 'since yesterday', 'freshness flips after Michigan midnight');

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
