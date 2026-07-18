import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [api, page] = await Promise.all([
  readFile(new URL('../api/species-profile.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/species.html', import.meta.url), 'utf8'),
]);

assert.match(api, /resolveSpeciesIdentity\(req\.query, getTaxonomy\)/);
assert.match(api, /SpeciesIdentityError/);
assert.match(page, /updateDocumentMetadata\(d\)/);
assert.match(page, /in Michigan: Michigan Birding Report/);
assert.match(page, /link\[rel="canonical"\]/);
assert.match(page, /application\/ld\+json/);
assert.match(page, /summary_large_image/);

const scripts = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const inlineScript = scripts.at(-1)?.[1];
assert.ok(inlineScript, 'Expected the species page inline script');
new Function(inlineScript);

console.log('Species SEO checks passed.');
