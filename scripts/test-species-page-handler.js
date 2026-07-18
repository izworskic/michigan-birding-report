'use strict';

const assert = require('node:assert/strict');

let taxonomyMode = 'found';
const ebirdPath = require.resolve('../lib/ebird');
require.cache[ebirdPath] = {
  id: ebirdPath,
  filename: ebirdPath,
  loaded: true,
  exports: {
    getTaxonomy: async ({ species }) => {
      if (taxonomyMode === 'error') throw new Error('Upstream unavailable');
      if (taxonomyMode === 'missing') return [];
      return [{
        speciesCode: species,
        comName: 'American Avocet',
        sciName: 'Recurvirostra americana',
      }];
    },
  },
};

const handler = require('../api/species-page');

function createResponse() {
  return {
    headers: {},
    statusCode: null,
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

async function run() {
  const success = createResponse();
  await handler({ query: { code: 'ameavo', name: 'Untrusted Name' } }, success);
  assert.equal(success.statusCode, 200);
  assert.equal(success.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(success.headers['cache-control'], /s-maxage=86400/);
  assert.match(success.body, /<h1>American Avocet<\/h1>/);
  assert.doesNotMatch(success.body, /Untrusted Name/);

  taxonomyMode = 'missing';
  const missing = createResponse();
  await handler({ query: { code: 'notabird' } }, missing);
  assert.equal(missing.statusCode, 404);
  assert.match(missing.body, /<meta name="robots" content="noindex, follow">/);

  taxonomyMode = 'error';
  const unavailable = createResponse();
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await handler({ query: { code: 'ameavo' } }, unavailable);
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.headers['cache-control'], 'no-store');

  console.log('Species page handler checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
