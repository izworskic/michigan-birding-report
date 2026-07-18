'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getSpeciesMetadata,
  renderSpeciesErrorPage,
  renderSpeciesPage,
} = require('../lib/species-page');

const template = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'species.html'),
  'utf8'
);

const identity = {
  code: 'ameavo',
  name: 'American Avocet',
  sciName: 'Recurvirostra americana',
};

const html = renderSpeciesPage(template, identity);
const metadata = getSpeciesMetadata(identity);

assert.match(html, /<title>American Avocet in Michigan: Michigan Birding Report<\/title>/);
assert.ok(html.includes(`content="${metadata.description}"`));
assert.match(html, /<link rel="canonical" href="https:\/\/michiganbirdingreport\.com\/species\/ameavo">/);
assert.match(html, /<h1>American Avocet<\/h1>/);
assert.match(html, /<p class="species-sci">Recurvirostra americana<\/p>/);
assert.match(html, /window\.__SPECIES_IDENTITY__=\{"code":"ameavo","name":"American Avocet","sciName":"Recurvirostra americana"\}/);
assert.match(html, /"@type":"BreadcrumbList"/);
assert.doesNotMatch(html, /<title>Species Profile: Michigan Birding Report<\/title>/);
assert.doesNotMatch(html, />Loading species profile\.\.\.<\/p>/);

const hostileHtml = renderSpeciesPage(template, {
  code: 'safe123',
  name: '</title><script>alert(1)</script>',
  sciName: 'Birdus & "unsafe"',
});
assert.doesNotMatch(hostileHtml, /<script>alert\(1\)<\/script>/);
assert.match(hostileHtml, /&lt;\/title&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(hostileHtml, /\\u003c\/title\\u003e\\u003cscript\\u003ealert\(1\)\\u003c\/script\\u003e/);

const errorHtml = renderSpeciesErrorPage(404, 'Species not found', 'Try another bird.');
assert.match(errorHtml, /<meta name="robots" content="noindex, follow">/);
assert.match(errorHtml, /<title>Species not found: Michigan Birding Report<\/title>/);

console.log('Species page rendering checks passed.');
