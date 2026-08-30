import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const person = 'https://chrisizworski.com/#person';
const profile = 'https://chrisizworski.com/chris-izworski/';
const localPerson = 'https://michiganbirdingreport.com/chris-izworski#person';

const home = readFileSync('public/index.html', 'utf8');
assert.ok(home.includes(`<link rel="author" href="${profile}">`), 'homepage must expose the canonical Chris Izworski profile');
assert.ok(home.includes(person), 'homepage must use the canonical Person @id');

for (const path of [
  'public/chris-izworski.html',
  'public/chris-izworski-michigan-birding-field-notes.html',
  'public/chris-izworski-saginaw-bay-birding.html',
]) {
  const html = readFileSync(path, 'utf8');
  assert.ok(html.includes(person), `${path} must reference the canonical Person entity`);
  assert.ok(!html.includes(localPerson), `${path} must not mint a second local Person entity`);
}

const author = readFileSync('public/chris-izworski.html', 'utf8');
assert.ok(author.includes(`"url": "${profile}"`), 'author Person node must resolve to the canonical profile');

console.log('Creator entity checks passed.');
