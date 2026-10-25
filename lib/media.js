'use strict';

/**
 * Bird reference photographs (not photographs of the reported eBird event).
 * Strict scientific-name matching first; exact English name only without a
 * scientific name. No prefix-stripping or first fuzzy result.
 *
 * Only CC0, CC BY and CC BY-SA photographs are returned: this site displays ads,
 * so iNaturalist's default CC BY-NC photos must not be reused. Keep credit,
 * license and original photo/observation link with every image.
 * API cache + CDN and viewport-lazy clients avoid burst image requests.
 */
const { ToolState } = require('./tool-state.cjs');
const PHOTO_CACHE_TTL = 86400 * 180;
const MISSING_CACHE_TTL = 86400 * 7;
const OBS_PHOTO_TTL = 86400;
const ALLOWED = new Set(['cc0', 'cc-by', 'cc-by-sa']);
const inMemory = new Map();
let state;
function getState(){ if(!state)state=new ToolState(); return state; }
function norm(v){ return String(v||'').trim().toLowerCase().replace(/\s+/g,' '); }
function licenseOK(v){ return ALLOWED.has(norm(v)); }
function safeUrl(v){ return typeof v==='string' && /^https:\/\//i.test(v) ? v : null; }
function photoData(photo,taxon,observationId){
  if(!photo || !licenseOK(photo.license_code))return null;
  const url=safeUrl(photo.medium_url||photo.url);
  if(!url)return null;
  const license=norm(photo.license_code).toUpperCase();
  return {
    source:'iNaturalist',url,attribution:photo.attribution||'iNaturalist contributor',
    license,inatId:taxon.id,sciName:taxon.name,
    sourceUrl:observationId
      ? `https://www.inaturalist.org/observations/${observationId}`
      : `https://www.inaturalist.org/photos/${photo.id}`,
    referenceOnly:true
  };
}
async function apiJson(url){
  const res=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'MichiganBirdingReport/1.0 (species photo attribution)'},signal:AbortSignal.timeout(6500)});
  if(!res.ok)throw new Error('iNaturalist '+res.status);
  return res.json();
}
async function findPhoto(commonName,sciName){
  const latin=norm(sciName);
  const common=norm(commonName);
  if(!latin && !common)return null;
  const search=latin||common;
  const result=await apiJson('https://api.inaturalist.org/v1/taxa?q='+encodeURIComponent(search)+'&rank=species&per_page=10');
  const taxon=(result.results||[]).find(t=>
    t && t.rank==='species' && t.iconic_taxon_name==='Aves' &&
    (latin ? norm(t.name)===latin : norm(t.preferred_common_name)===common)
  );
  if(!taxon)return null;
  const featured=photoData(taxon.default_photo,taxon);
  if(featured)return featured;
  // A curated default photo often uses non-commercial licensing.
  // Look for a different, explicitly reusable field photograph instead.
  const obs=await apiJson('https://api.inaturalist.org/v1/observations?taxon_id='+
    encodeURIComponent(taxon.id)+'&quality_grade=research&photos=true&photo_license=cc0%2Ccc-by%2Ccc-by-sa&per_page=8&order=desc&order_by=created_at');
  for(const o of obs.results||[]){
    if(norm(o.taxon?.name)!==norm(taxon.name))continue;
    for(const p of o.photos||[]){
      const candidate=photoData(p,taxon,o.id);
      if(candidate)return candidate;
    }
  }
  return null;
}
async function getINatTaxonPhoto(commonName,sciName){
  const key=norm(sciName)||norm(commonName);
  if(!key)return null;
  const cacheKey='birding:img:licensed-v2:'+key.replace(/[^a-z0-9]+/g,'_').slice(0,120);
  if(inMemory.has(cacheKey))return inMemory.get(cacheKey);
  try {
    const value=await getState().get(cacheKey);
    if(value){
      const data=typeof value==='string'?JSON.parse(value):value;
      if(data && (data.status==='none'||(data.url&&licenseOK(data.license)))){
        const photo=data.status==='none'?null:data;
        inMemory.set(cacheKey,photo);
        return photo;
      }
    }
  }catch(e){ /* state may be unavailable locally */ }
  try {
    const photo=await findPhoto(commonName,sciName);
    inMemory.set(cacheKey,photo);
    if(inMemory.size>200)inMemory.delete(inMemory.keys().next().value);
    try{await getState().set(cacheKey,JSON.stringify(photo||{status:'none'}),{ex:photo?PHOTO_CACHE_TTL:MISSING_CACHE_TTL});}
    catch(e){ /* CDN can cache even if state is unavailable */ }
    return photo;
  }catch(e){ return null; }
}
async function getBestImage(speciesCode,commonName,sciName){
  if(typeof commonName!=='string'||!commonName.trim()){
    return {source:'placeholder',url:'/placeholder-bird.svg',referenceOnly:true};
  }
  const photo=await getINatTaxonPhoto(commonName,sciName);
  return photo?photo:{source:'placeholder',url:'/placeholder-bird.svg',referenceOnly:true};
}

/**
 * Fetch recent bird photos from iNaturalist for a species in Michigan.
 * These are observation photos showing the bird in local habitat.
 */
async function getINatPhotos(taxonName, options = {}) {
  const { perPage = 6 } = options;
  const cacheKey = `birding:inat:obs:${taxonName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  try {
    const r = getState();
    const cached = await r.get(cacheKey);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (Array.isArray(data)) return data;
    }
  } catch (e) { /* continue */ }

  try {
    const url = `https://api.inaturalist.org/v1/observations?` +
      `taxon_name=${encodeURIComponent(taxonName)}` +
      `&place_id=31` + // Michigan
      `&quality_grade=research` +
      `&photos=true` +
      `&order=desc&order_by=observed_on` +
      `&per_page=${perPage}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const photos = (data.results || [])
      .filter(obs => obs.photos && obs.photos.length > 0)
      .map(obs => ({
        photoUrl: obs.photos[0].url.replace('square', 'medium'),
        observer: obs.user?.login || 'Unknown',
        date: obs.observed_on,
        location: obs.place_guess,
        license: obs.photos[0].license_code || 'unknown',
        inatUrl: `https://www.inaturalist.org/observations/${obs.id}`,
      }));

    try {
      const r = getState();
      await r.set(cacheKey, JSON.stringify(photos), { ex: OBS_PHOTO_TTL });
    } catch (e) { /* continue */ }

    return photos;
  } catch (e) {
    return [];
  }
}

module.exports = {
  getINatTaxonPhoto,
  getBestImage,
  getINatPhotos,
};
