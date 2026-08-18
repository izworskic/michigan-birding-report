import fs from 'node:fs';

const home = fs.readFileSync('public/app.js','utf8');
const counties = fs.readFileSync('public/counties/index.html','utf8');
const species = fs.readFileSync('public/species/index.html','utf8');

const checks = [
  ['task-first homepage', 30, ['Birds near me','Where should I bird today?','Track migration','Find a bird'].every(x=>home.includes(x))],
  ['concise front door', 15, (home.match(/data-bird-intent=/g)||[]).length===4 && home.includes('Live notable sightings')],
  ['county discovery', 15, counties.includes('id="countySearch"') && (counties.match(/href="\/county\//g)||[]).length===83],
  ['species discovery', 15, species.includes('id="speciesQuery"') && species.includes('/predictions?name=')],
  ['concrete navigation', 10, home.includes("a.textContent='Today'") && home.includes('Where Should I Bird Today?')],
  ['search ownership preserved', 10, counties.includes('https://michiganbirdingreport.com/counties') && species.includes('https://michiganbirdingreport.com/species')],
  ['mobile/accessibility', 5, home.includes('@media(max-width:720px)') && home.includes('aria-label="Choose what you want to do"')],
];

const score = checks.reduce((n,[,w,pass])=>n+(pass?w:0),0);
const loss = 100-score;
const baseline = 58;
const target = 95;

console.log(`Bird persona routing benchmark: ${score}/100 (baseline ${baseline}, loss ${loss})`);
for (const [name,weight,pass] of checks) console.log(`${pass?'PASS':'FAIL'} ${String(weight).padStart(2)} ${name}`);
if (score < target) process.exit(1);
