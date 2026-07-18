'use strict';

const assert = require('node:assert/strict');
const { SpeciesIdentityError, resolveSpeciesIdentity } = require('../lib/species-identity');

async function expectStatus(promise, statusCode) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof SpeciesIdentityError);
    assert.equal(error.statusCode, statusCode);
    return true;
  });
}

async function run() {
  let taxonomyCalls = 0;
  const taxonomy = async ({ species }) => {
    taxonomyCalls += 1;
    assert.equal(species, 'ameavo');
    return [{ speciesCode: 'ameavo', comName: 'American Avocet', sciName: 'Recurvirostra americana' }];
  };

  assert.deepEqual(
    await resolveSpeciesIdentity({ code: 'AMEAVO' }, taxonomy),
    { code: 'ameavo', name: 'American Avocet', sciName: 'Recurvirostra americana' }
  );
  assert.equal(taxonomyCalls, 1);

  assert.deepEqual(
    await resolveSpeciesIdentity(
      { code: ['amerob'], name: ['American Robin'], sci: ['Turdus migratorius'] },
      async () => { throw new Error('Named links must not require taxonomy'); }
    ),
    { code: 'amerob', name: 'American Robin', sciName: 'Turdus migratorius' }
  );

  await expectStatus(resolveSpeciesIdentity({ code: '../bad' }, taxonomy), 400);
  await expectStatus(resolveSpeciesIdentity({ code: 'unknown' }, async () => []), 404);

  console.log('Species identity checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
