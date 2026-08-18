import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/migration.html', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/migration-intelligence.js', import.meta.url), 'utf8');

const combined = `${html}\n${api}`;
const dimensions = [
  ['Answers the decision question', 5, [/Tonight’s Michigan pulse/, /Where should I bird in Michigan\?/, /What could be moving through Michigan now\?/]],
  ['Map', 5, [/id="migrationMap"/, /L\.map\('migrationMap'/]],
  ['Fresh data', 5, [/\/api\/migration-intelligence/, /eBird sightings/, /NWS weather/]],
  ['Actionable', 5, [/Open county birding/, /BirdCast county radar/, /Verify before you go/]],
  ['Linked depth', 5, [/\/species\//, /countyPage:\s*`\/county\//, /\/predictions/]],
  ['SEO target', 5, [/Michigan Bird Migration Today/, /canonical/, /spring and fall migration/i]],
];

let total = 0;
for (const [name, points, patterns] of dimensions) {
  const pass = patterns.every(p => p.test(combined));
  const earned = pass ? points : 0;
  total += earned;
  console.log(`${pass ? '✓' : '✗'} ${name}: ${earned}/${points}`);
}

const baseline = 16;
console.log(`Migration baseline: ${baseline}/30 (loss ${30-baseline})`);
console.log(`Migration candidate: ${total}/30 (loss ${30-total})`);

if (total < 28) {
  console.error('MIGRATION INTELLIGENCE BENCHMARK: FAIL');
  process.exit(1);
}
console.log('MIGRATION INTELLIGENCE BENCHMARK: PASS');
