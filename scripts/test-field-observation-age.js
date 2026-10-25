'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
// Isolate pure adapter logic from eBird/Vercel state imports. This test never accesses
// an API key, network or private deployment data, and works in checkout-only CI.
const source=fs.readFileSync(path.join(__dirname,'../api/local-action.js'),'utf8');
const mod={exports:{}};
const compile=vm.runInThisContext('(function(require,module,exports,process){'+source+'\\n})'.replace('\\n','\n'),{filename:'api/local-action.js'});
compile((name)=>{
 if(name==='../lib/ebird')return {getNearbyHotspots(){throw Error('network fetch forbidden in unit test')},getNotableNearby(){throw Error('network fetch forbidden in unit test')}};
 throw Error('Unexpected import in pure test: '+name);
},mod,mod.exports,{env:{}});
const {observationAge,buildAction}=mod.exports._test;
const now=Date.UTC(2026,9,25,12);
assert.deepEqual(observationAge('2026-10-24 07:15',now),{observedOn:'2026-10-24',ageDays:1,ageBand:'last three calendar dates'});
assert.equal(observationAge('2026-10-19',now).ageBand,'three to seven days old');
assert.equal(observationAge('2026-02-30',now).ageBand,'date unavailable');
assert.equal(observationAge('2026-10-26',now).ageDays,null);
assert.equal(observationAge('garbled',now).observedOn,null);
const today=new Date().toISOString().slice(0,10);
const one={locId:'L1',locName:'Sample published hotspot',lat:43.6,lng:-83.9,comName:'Mallard',speciesCode:'mallar3',obsDt:today+' 08:15',howMany:4};
const h={locId:'L1',locName:'Sample published hotspot',lat:43.6,lng:-83.9};
const summary=buildAction(43.6,-83.9,[one],[h],[],3);
assert.equal(summary.topPlaces[0].observationAge.observedOn,today);
assert.equal(summary.topPlaces[0].accessVerified,false);
assert.match(summary.topPlaces[0].sourceConfidence,/eBird community/);
assert.match(summary.evidenceInterpretation,/not predicted bird presence/);
assert.equal(summary.decisionChoices.strongestCurrentEvidence.accessVerified,false);
console.log('Birding event-date, evidence provenance and access checks passed.');
