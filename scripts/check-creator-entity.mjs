import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const person = 'https://chrisizworski.com/#person';
const homepageUrl = 'https://chrisizworski.com/';
const profile = 'https://chrisizworski.com/chris-izworski/';
const localPerson = 'https://michiganbirdingreport.com/chris-izworski#person';

const home = readFileSync('public/index.html', 'utf8');
assert.ok(home.includes(`<link rel="author" href="${profile}">`), 'homepage must expose the canonical Chris Izworski profile');
assert.ok(home.includes(`"@id":"${person}"`), 'homepage must use the canonical Person @id');
assert.ok(home.includes(`"url":"${homepageUrl}"`), 'canonical Person url must be the homepage');
assert.ok(home.includes(`"author":{"@id":"${person}"}`), 'homepage content must reference the canonical author');
assert.ok(home.includes(`"publisher":{"@id":"${person}"}`), 'homepage content must reference the canonical publisher');
assert.ok(home.includes(`Built by <a href="${profile}">Chris Izworski</a>`), 'visible creator credit must link to the canonical profile');

for (const path of [
  'public/chris-izworski.html',
  'public/chris-izworski-michigan-birding-field-notes.html',
  'public/chris-izworski-saginaw-bay-birding.html',
]) {
  const html = readFileSync(path, 'utf8');
  assert.ok(html.includes(person), `${path} must reference the canonical Person entity`);
  assert.ok(html.includes(`"url":"${homepageUrl}"`) || html.includes(`"url": "${homepageUrl}"`), `${path} canonical Person must resolve to the homepage`);
  assert.ok(!html.includes(localPerson), `${path} must not mint a second local Person entity`);
}

console.log('Creator entity checks passed.');
