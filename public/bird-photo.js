(function(global){
  'use strict';
  // Species portraits are reference images, never pictures of an eBird sighting.
  const cache=new Map(), queue=[];
  let active=false, observer=null;
  function enc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function slot(s){
    return '<span class="bird-photo-slot" data-code="'+enc(s.speciesCode)+'" data-name="'+enc(s.comName||s.name)+'" data-sci="'+enc(s.sciName)+'" aria-label="Reference photo for '+enc(s.comName||s.name)+'">'+
      '<span class="bird-photo-empty">Looking up photo</span></span>';
  }
  function paint(el,data){
    if(!el.isConnected)return;
    el.replaceChildren();
    const photo=data&&data.photo;
    if(!photo || !photo.url || !/^https:\/\//.test(photo.url)){
      const missing=document.createElement('span');missing.className='bird-photo-empty';
      missing.textContent='Photo unavailable';el.appendChild(missing);return;
    }
    const img=document.createElement('img');
    img.className='bird-photo-img';img.loading='lazy';img.decoding='async';
    img.alt='Reference photograph of '+(el.dataset.name||'bird');
    img.src=photo.url;
    img.onerror=()=>{img.remove();const fail=document.createElement('span');fail.className='bird-photo-empty';fail.textContent='Photo unavailable';el.prepend(fail);};
    el.appendChild(img);
    const credit=document.createElement('a');credit.className='bird-photo-credit';
    const provenance=String(photo.sourceUrl||'');
    if(/^https:\/\/www\.inaturalist\.org\/(?:photos|observations)\/\d+/.test(provenance)){
      credit.href=provenance;credit.target='_blank';credit.rel='noopener noreferrer';
    }
    credit.textContent='Photo: '+(photo.attribution||'iNaturalist')+' · '+(photo.license||'License unknown');
    credit.title=credit.textContent+' · '+(photo.sourceUrl||'iNaturalist');
    el.appendChild(credit);
  }
  async function drain(){
    if(active||!queue.length)return;
    active=true;
    const el=queue.shift();
    const key=[el.dataset.code,el.dataset.name,el.dataset.sci].join('|');
    try{
      if(!cache.has(key)){
        const q=new URLSearchParams({code:el.dataset.code||'',name:el.dataset.name||'',sci:el.dataset.sci||''});
        const response=await fetch('/api/species-photo?'+q.toString());
        if(!response.ok)throw new Error('HTTP '+response.status);
        cache.set(key,await response.json());
      }
      paint(el,cache.get(key));
    }catch(e){paint(el,null);}
    // iNaturalist asks for about one API request per second. Cache is shared
    // per species and the browser serializes new reference-photo lookups.
    setTimeout(()=>{active=false;drain();},1250);
  }
  function schedule(el){
    if(el.dataset.queued)return;el.dataset.queued='1';
    const key=[el.dataset.code,el.dataset.name,el.dataset.sci].join('|');
    if(cache.has(key)){paint(el,cache.get(key));return;}
    queue.push(el);drain();
  }
  function hydrate(root){
    const elements=Array.from((root||document).querySelectorAll('.bird-photo-slot'));
    if('IntersectionObserver' in global){
      if(!observer)observer=new IntersectionObserver(items=>items.forEach(item=>{
        if(item.isIntersecting){observer.unobserve(item.target);schedule(item.target);}
      }),{rootMargin:'350px 0px'});
      elements.forEach(e=>observer.observe(e));
    }else elements.forEach(schedule);
  }
  global.BirdPhotos={slot,hydrate};
})(window);
