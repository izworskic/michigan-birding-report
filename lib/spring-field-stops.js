/**
 * Spring 2027 field stops for the six existing migration regions.
 * These are public-facing planning destinations, not verified entrances,
 * open-now claims, field bird counts or guarantees of sightings.
 * Operators remain the authority for permissions, hours and closures.
 */
const SPRING_FIELD_STOPS = Object.freeze({
  'saginaw-bay': Object.freeze({
    name: 'Bay City State Park and Tobico Marsh',
    habitat: 'Start on the signed park trails and look across the coastal marsh for waterfowl and arriving songbirds.',
    officialUrl: 'https://www.michigan.gov/recsearch/parks/baycity',
    officialLabel: 'Michigan DNR park information',
    mapQuery: 'Bay City State Park, Bay City, Michigan',
    access: 'Check park notices and Recreation Passport requirements before leaving.',
  }),
  tawas: Object.freeze({
    name: 'Tawas Point State Park',
    habitat: 'Walk the peninsula trails and listen along the wooded edge where migrants can pause beside Lake Huron.',
    officialUrl: 'https://www.michigan.gov/recsearch/parks/TawasPoint',
    officialLabel: 'Michigan DNR park information',
    mapQuery: 'Tawas Point State Park, East Tawas, Michigan',
    access: 'Check park notices, trail conditions and Recreation Passport requirements.',
  }),
  whitefish: Object.freeze({
    name: 'Whitefish Point Bird Observatory',
    habitat: 'Watch the lakeshore and the established hawk-watch area. Spring passage here can continue while snow remains.',
    officialUrl: 'https://wpbo.org/visit/',
    officialLabel: 'Whitefish Point Bird Observatory visit guide',
    mapQuery: 'Whitefish Point Bird Observatory, Paradise, Michigan',
    access: 'Review observatory visitor guidance and current trail conditions before traveling.',
  }),
  'western-lake-erie': Object.freeze({
    name: 'Pointe Mouillee State Game Area',
    habitat: 'Scan the western Lake Erie marsh landscape and check which units have lawful public approaches.',
    officialUrl: 'https://www.michigan.gov/dnr/things-to-do/hunting/where/wetland-wonders/pointe-mouillee-sga',
    officialLabel: 'Michigan DNR game area access and notices',
    mapQuery: 'Pointe Mouillee State Game Area, Rockwood, Michigan',
    access: 'Access is unit-specific. Check DNR restrictions and road closures, including Roberts Road, before traveling. A map search is not a parking or entry pin.',
  }),
  muskegon: Object.freeze({
    name: 'Muskegon County Resource Recovery Center',
    habitat: 'Look for spring waterbirds and shorebirds across the facility wetlands and open-water habitat.',
    officialUrl: 'https://mcresourcerecoverycenter.com/about-us/rec-birdwatching/',
    officialLabel: 'County birdwatching permits and visitor rules',
    actionUrl: 'https://mcresourcerecoverycenter.com/about-us/rec-birdwatching/apply-visitor-pass/',
    actionLabel: 'Apply for a birdwatching pass',
    mapQuery: 'Muskegon County Resource Recovery Center, Muskegon, Michigan',
    access: 'A visitor pass is required. Arrange it with the facility before entering, and follow restricted-area rules.',
  }),
  leelanau: Object.freeze({
    name: 'Sleeping Bear Dunes National Lakeshore',
    habitat: 'Check sheltered woods and Lake Michigan edges for arriving migrants, then compare recent local eBird reports.',
    officialUrl: 'https://www.nps.gov/slbe/learn/nature/birds.htm',
    officialLabel: 'National Park Service birding information',
    mapQuery: 'Sleeping Bear Dunes National Lakeshore, Empire, Michigan',
    access: 'Use an NPS-designated visitor area and check seasonal road, trail and entrance-fee information.',
  }),
});

function reportIsRecent(summary, now = new Date()) {
  const observed = String(summary?.latestObservation || '');
  const match = observed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const reportDate = Date.UTC(year, month - 1, day);
  const validDate = new Date(reportDate);
  if (validDate.getUTCFullYear() !== year || validDate.getUTCMonth() !== month - 1 || validDate.getUTCDate() !== day) return false;
  const clock = new Date(now);
  if (!Number.isFinite(clock.getTime()) || !Number.isFinite(reportDate)) return false;
  const today = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(clock);
  const fields = Object.fromEntries(today.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  const elapsed = (Date.UTC(fields.year, fields.month - 1, fields.day) - reportDate) / 86400000;
  return elapsed >= 0 && elapsed <= 3;
}

function springFieldStop({ regionId, season, flight, observations, observationsAvailable, now = new Date() }) {
  const stop = SPRING_FIELD_STOPS[regionId];
  if (!stop || season?.key !== 'spring') return null;
  const dataCurrent = Boolean(observationsAvailable && reportIsRecent(observations, now));
  const weatherCurrent = flight && !['unknown', 'offseason'].includes(flight.key);
  const supportive = ['favorable', 'fallout-watch', 'grounding-watch'].includes(flight?.key);
  const reported = Number(observations?.speciesCount) || 0;
  const betterSignal = dataCurrent && weatherCurrent && supportive && reported >= 12;

  return {
    ...stop,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(stop.mapQuery),
    reportStatus: dataCurrent ? 'Recent county sightings available' : 'No recent dated county report confirmed',
    verdict: betterSignal ? 'Worth an early field check' : 'Check conditions before the drive',
    reason: betterSignal
      ? 'Supportive movement or stopover weather and recent county reports make this habitat worth checking. Neither confirms that birds arrived overnight.'
      : 'The available signals are incomplete or mixed. Review the current eBird county reports, BirdCast and the site operator before committing to a trip.',
    basis: 'NWS setup and eBird county reports, not observed migration radar',
  };
}

module.exports = { SPRING_FIELD_STOPS, reportIsRecent, springFieldStop };
