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

const { SPRING_FIELD_STOPS, reportIsRecent, springFieldStop } = require('../lib/spring-field-stops');
assert.strictEqual(Object.keys(SPRING_FIELD_STOPS).length, REGIONS.length, 'one public field stop per supported region');
const springNow = new Date('2027-05-12T16:00:00Z');
assert.strictEqual(reportIsRecent({ latestObservation: '2027-05-11 09:00' }, springNow), true);
assert.strictEqual(reportIsRecent({ latestObservation: '2027-05-01' }, springNow), false, 'old observations do not support a spring trip');
assert.strictEqual(reportIsRecent({ latestObservation: '2027-05-13' }, springNow), false, 'future reports cannot support a trip');
assert.strictEqual(reportIsRecent({ latestObservation: null }, springNow), false);
assert.strictEqual(reportIsRecent({ latestObservation: '2027-05-00' }, springNow), false, 'zero date is not a sighting');
assert.strictEqual(reportIsRecent({ latestObservation: '2027-02-30' }, new Date('2027-03-02T16:00:00Z')), false, 'impossible date must never normalize into recent evidence');
assert.strictEqual(reportIsRecent({ latestObservation: '2027-05-11junk' }, springNow), false, 'malformed sighting timestamp is not proof');
for (const region of REGIONS) {
  const stop = springFieldStop({ regionId: region.id, season: spring,
    flight: { key: 'favorable' }, observationsAvailable: true,
    observations: { speciesCount: 21, latestObservation: '2027-05-11 09:00' }, now: springNow });
  assert.ok(stop && stop.name && stop.habitat, 'every region gets a spring field stop');
  assert.ok(stop.officialUrl.startsWith('https://'), 'operator link must be sourced');
  assert.ok(stop.googleMapsUrl.startsWith('https://www.google.com/maps/search/?api=1&query='));
  assert.strictEqual(stop.verdict, 'Worth an early field check');
  assert.strictEqual(springFieldStop({ regionId: region.id, season: fall }), null, 'do not show spring copy in fall');
}
const offline = springFieldStop({ regionId: 'muskegon', season: spring,
  flight: { key: 'favorable' }, observationsAvailable: false,
  observations: { speciesCount: 50, latestObservation: '2027-05-11' }, now: springNow });
assert.strictEqual(offline.verdict, 'Check conditions before the drive', 'no confidence without successful eBird fetch');
assert.match(offline.access, /visitor pass/i, 'Muskegon pass must be explicit');
assert.match(offline.actionUrl, /apply-visitor-pass\/$/, 'Muskegon needs an official direct permit action');
assert.match(offline.actionLabel, /birdwatching pass/i);
const fs = require('fs');
const migrationPage = fs.readFileSync(require('path').join(__dirname, '../public/migration.html'), 'utf8');
assert.ok(migrationPage.includes('stop.actionUrl') && migrationPage.includes('stop.actionLabel'), 'the migration card must expose the direct pass action');
assert.match(SPRING_FIELD_STOPS['western-lake-erie'].access, /Roberts Road/, 'Pointe Mouillee requires access recheck');

console.log('Migration intelligence logic: PASS');
