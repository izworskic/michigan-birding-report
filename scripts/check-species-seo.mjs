import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [api, pageApi, renderer, page, vercel] = await Promise.all([
  readFile(new URL('../api/species-profile.js', import.meta.url), 'utf8'),
  readFile(new URL('../api/species-page.js', import.meta.url), 'utf8'),
  readFile(new URL('../lib/species-page.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/species.html', import.meta.url), 'utf8'),
  readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
]);

assert.match(api, /resolveSpeciesIdentity\(req\.query, getTaxonomy\)/);
assert.match(api, /SpeciesIdentityError/);
assert.match(page, /updateDocumentMetadata\(d\)/);
assert.match(page, /in Michigan: Michigan Birding Report/);
assert.match(page, /link\[rel="canonical"\]/);
assert.match(page, /application\/ld\+json/);
assert.match(page, /summary_large_image/);
assert.match(page, /window\.__SPECIES_IDENTITY__/);
assert.match(pageApi, /resolveSpeciesIdentity\(\{ code: req\.query\?\.code \}, getTaxonomy\)/);
assert.match(pageApi, /s-maxage=86400/);
assert.match(renderer, /BreadcrumbList/);
assert.match(renderer, /<h1>\$\{escapedName\}<\/h1>/);

const vercelConfig = JSON.parse(vercel);
const speciesRewrite = vercelConfig.rewrites.find((rewrite) => rewrite.source === '/species/:code');
assert.deepEqual(speciesRewrite, {
  source: '/species/:code',
  destination: '/api/species-page?code=:code',
});
assert.equal(vercelConfig.functions['api/species-page.js'].includeFiles, 'public/species.html');

const staticSpeciesPages = [
  'amerob', 'baleag', 'balori', 'bkcchi', 'comloo', 'grbher3', 'indbun', 'kirwar',
  'norcar', 'pilwoo', 'rethaw', 'sancra', 'scatan', 'snoowl1', 'wooduc',
];
await Promise.all(staticSpeciesPages.map((code) =>
  readFile(new URL(`../public/species/${code}/index.html`, import.meta.url), 'utf8')
));

const scripts = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const inlineScript = scripts.at(-1)?.[1];
assert.ok(inlineScript, 'Expected the species page inline script');
new Function(inlineScript);

console.log('Species SEO checks passed.');
