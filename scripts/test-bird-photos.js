'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function mediaWith(fetchImpl){
  const sandbox={
    module:{exports:{}},fetch:fetchImpl,AbortSignal:{timeout:()=>({})},
    require:()=>({ToolState:class{async get(){return null;}async set(){}}}),
    setTimeout,console,
  };
  vm.runInNewContext(read('lib/media.js'),sandbox,{filename:'lib/media.js'});
  return sandbox.module.exports;
}
function response(data){return {ok:true,json:async()=>data};}
async function main(){
  let calls=[];
  const api=mediaWith(async url=>{
    calls.push(url);
    const q=new URL(url).searchParams.get('q');
    if(url.includes('/taxa?')){
      const latin=q==='haliaeetus leucocephalus'?'Haliaeetus leucocephalus':q==='anas platyrhynchos'?'Anas platyrhynchos':'Hirundo rustica';
      return response({results:[
        {id:99,name:'Wrongus birdus',rank:'species',iconic_taxon_name:'Aves',default_photo:{id:99,medium_url:'https://static.inaturalist.org/photos/99/medium.jpg',license_code:'cc-by'}},
        {id:42,name:latin,rank:'species',iconic_taxon_name:'Aves',
          default_photo:{id:42,medium_url:'https://static.inaturalist.org/photos/42/medium.jpg',
            license_code:latin==='Haliaeetus leucocephalus'?'cc-by':latin==='Anas platyrhynchos'?'cc-by-nc':'all rights reserved'}},
      ]});
    }
    return response({results:[{
      id:51,taxon:{name:'Anas platyrhynchos'},photos:[{id:51,url:'https://static.inaturalist.org/photos/51/square.jpg',license_code:'cc-by-sa',attribution:'Mallard photographer'}]
    }]});
  });
  const eagle=await api.getBestImage('baleag','Bald Eagle','Haliaeetus leucocephalus');
  assert.equal(eagle.inatId,42,'must not take first fuzzy result');
  assert.equal(eagle.license,'CC-BY');
  assert.equal(eagle.referenceOnly,true);
  const duck=await api.getBestImage('mallar3','Mallard','Anas platyrhynchos');
  assert.equal(duck.license,'CC-BY-SA','must replace noncommercial default with reusable photo');
  assert.match(duck.url,/medium\.jpg$/);
  assert.equal(duck.sourceUrl,'https://www.inaturalist.org/observations/51');
  const swallow=await api.getBestImage('barswa','Barn Swallow','Hirundo rustica');
  assert.equal(swallow.source,'placeholder','must not display all-rights-reserved or mismatched photos');
  const noName=await api.getBestImage('x',undefined);
  assert.equal(noName.source,'placeholder','missing name must not throw');
  assert.ok(calls.length<=6);

  const rendered=['public/index.html','public/saginaw-bay.html','public/county.html'];
  for(const page of rendered){
    const html=read(page);
    assert.match(html,/\/bird-photo\.js/);
    assert.match(html,/\/bird-photo\.css/);
    assert.match(html,/BirdPhotos\.hydrate/,{message:page+' must hydrate photo slots'});
    const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    for(const entry of scripts){
      if(entry[0].includes('type="application/ld+json"'))continue;
      new Function(entry[1]);
    }
  }
  for(const script of ['api/species-photo.js','api/bay-sightings.js','api/notable.js','public/bird-photo.js','public/app.js']){
    new Function(read(script));
  }
  assert.doesNotMatch(read('public/county.html'),/fetch\(`https:\/\/api\.inaturalist\.org\/v1\/taxa/);
  assert.doesNotMatch(read('api/bay-sightings.js'),/getBestImage\(/);
  assert.doesNotMatch(read('api/notable.js'),/getBestImage\(/);
  console.log('Verified bird photo taxonomy, licensing, references, hydration, and syntax checks passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
