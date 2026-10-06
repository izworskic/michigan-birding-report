import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const personId = 'https://chrisizworski.com/#person';
const profile = 'https://chrisizworski.com/chris-izworski/';
const homepage = 'https://chrisizworski.com/';
const expectedCanonicals = new Map([
  ['public/index.html', 'https://michiganbirdingreport.com'],
  ['public/chris-izworski.html', 'https://michiganbirdingreport.com/chris-izworski'],
  ['public/chris-izworski-michigan-birding-field-notes.html', 'https://michiganbirdingreport.com/chris-izworski-michigan-birding-field-notes'],
  ['public/chris-izworski-saginaw-bay-birding.html', 'https://michiganbirdingreport.com/chris-izworski-saginaw-bay-birding'],
]);

function walk(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
  } else if (value && typeof value === 'object') {
    visit(value);
    for (const child of Object.values(value)) walk(child, visit);
  }
}

for (const [path, expectedCanonical] of expectedCanonicals) {
  const html = readFileSync(path, 'utf8');
  assert.ok(html.includes(`<link rel="author" href="${profile}">`), `${path} author metadata must link to the canonical profile`);
  assert.ok(html.includes(`<link rel="canonical" href="${expectedCanonical}"`), `${path} canonical URL must remain unchanged`);
  const body = html.split(/<\/head>/i)[1] ?? '';
  assert.match(body, /<a\b[^>]*href="https:\/\/chrisizworski\.com\/chris-izworski\//i, `${path} must retain a visible link to the canonical profile`);

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const schemas = blocks.map(([, source]) => JSON.parse(source));
  const definitions = [];
  const publisherNodes = [];
  for (const schema of schemas) {
    walk(schema, object => {
      const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
      if (object['@id'] === personId && types.includes('Person')) definitions.push(object);
      if (types.some(type => ['WebSite', 'WebPage', 'ProfilePage', 'Article'].includes(type))) publisherNodes.push(object);
    });
  }
  assert.equal(definitions.length, 1, `${path} must define one full canonical Person`);
  assert.equal(definitions[0].name, 'Chris Izworski', `${path} Person name must be complete`);
  assert.equal(definitions[0].url, homepage, `${path} Person URL must be the homepage`);
  assert.ok(publisherNodes.length > 0, `${path} must have page-level structured data`);
  for (const node of publisherNodes) {
    assert.equal(node.author?.['@id'], personId, `${path} ${node['@type']} author must reference the canonical Person`);
    assert.equal(node.publisher?.['@id'], personId, `${path} ${node['@type']} publisher must reference the canonical Person`);
  }
}

console.log('Creator entity checks passed for homepage and all author pages.');
