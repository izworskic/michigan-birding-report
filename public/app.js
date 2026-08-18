(function(){
  'use strict';

  // -- Helpers --
  function fmtDate(dt) {
    if (!dt) return '';
    const d = new Date(dt.replace(' ','T'));
    if (isNaN(d)) return '';
    const now = new Date();
    const days = Math.floor((now - d) / 86400000);
    if (days === 0 && d.getDate() === now.getDate())
      return 'Today ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    if (days <= 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }
  function trunc(s,n){return s&&s.length>n?s.slice(0,n)+'…':s||'';}
  function specUrl(s){return `/species/${s.speciesCode}`;}

  // -- Task-first front door --
  function installIntentRouter(){
    const cond=document.getElementById('cond');
    if(!cond || document.getElementById('birdIntentRouter')) return;

    const style=document.createElement('style');
    style.textContent=`
      .bird-front-door{max-width:1040px;margin:3.25rem auto 0;padding:1.15rem 1rem .9rem;text-align:center}
      .bird-front-door h1{font-family:var(--font-display);font-size:clamp(1.75rem,4vw,2.45rem);line-height:1.05;color:var(--forest-deep);margin:0 0 .25rem}
      .bird-front-door>p{font-size:.86rem;color:var(--text-mid);margin:0 auto .85rem;max-width:600px}
      .bird-intent-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.55rem;text-align:left}
      .bird-intent{display:block;padding:.75rem .8rem;background:var(--bg-card);border:1px solid var(--border-light);border-radius:6px;text-decoration:none;color:inherit;box-shadow:var(--shadow-sm);transition:transform .15s,box-shadow .15s,border-color .15s}
      .bird-intent:hover,.bird-intent:focus{transform:translateY(-1px);box-shadow:var(--shadow-md);border-color:var(--forest);outline:none}
      .bird-intent strong{display:block;font-family:var(--font-display);font-size:1rem;color:var(--forest-deep);margin-bottom:.08rem}
      .bird-intent span{display:block;font-size:.7rem;line-height:1.3;color:var(--text-mid)}
      .bird-live-kicker{font-size:.68rem;text-transform:uppercase;letter-spacing:.09em;font-weight:600;color:var(--forest);margin:.95rem 0 .35rem;text-align:left}
      @media(max-width:720px){.bird-intent-grid{grid-template-columns:1fr 1fr}.bird-front-door{padding-left:.65rem;padding-right:.65rem}.bird-intent{padding:.65rem}.bird-intent span{font-size:.68rem}}
    `;
    document.head.appendChild(style);

    const wrap=document.createElement('section');
    wrap.id='birdIntentRouter';
    wrap.className='bird-front-door';
    wrap.setAttribute('aria-labelledby','birdFrontDoorTitle');
    wrap.innerHTML=`
      <h1 id="birdFrontDoorTitle">Michigan Birding Report</h1>
      <p>Live Michigan sightings, migration, and a fast path to where you want to bird.</p>
      <div class="bird-intent-grid" aria-label="Choose what you want to do">
        <a class="bird-intent" href="/counties" data-bird-intent="near-me"><strong>Birds near me</strong><span>Pick your county and see recent birds and hotspots.</span></a>
        <a class="bird-intent" href="/predictions" data-bird-intent="today"><strong>Where should I bird today?</strong><span>Use weather, region, and recent activity to choose.</span></a>
        <a class="bird-intent" href="/migration" data-bird-intent="migration"><strong>Track migration</strong><span>Tonight's setup, tomorrow morning, and what is moving.</span></a>
        <a class="bird-intent" href="/species" data-bird-intent="species"><strong>Find a bird</strong><span>Species profiles, photos, sounds, and Michigan sightings.</span></a>
      </div>
      <div class="bird-live-kicker">Live notable sightings</div>`;
    cond.parentNode.insertBefore(wrap,cond);

    const search=document.getElementById('search');
    if(search) search.placeholder='Find a bird…';

    document.querySelectorAll('.site-bar nav a').forEach(a=>{
      if(a.getAttribute('href')==='/predictions') a.textContent='Today';
    });

    document.querySelectorAll('.quick-links .ql').forEach(card=>{
      const href=card.getAttribute('href');
      const h=card.querySelector('h3');
      const p=card.querySelector('p');
      if(href==='/predictions' && h && p){
        h.textContent='Where Should I Bird Today?';
        p.textContent='Choose a Michigan region and see the weather-driven birding setup.';
      }
      if(href==='/migration' && h && p){
        h.textContent='Migration Today';
        p.textContent='See tonight’s movement setup and where to check after sunrise.';
      }
    });
  }
  installIntentRouter();

  // -- Regions --
  const UP='003,013,033,041,043,053,061,071,083,095,097,103,109,131,153'.split(',');
  const NLP='001,007,009,019,029,031,039,047,055,069,079,085,089,101,107,113,119,129,135,137,141,143,157,165'.split(',');
  const RM={};
  UP.forEach(c=>RM['US-MI-'+c]='UP');
  NLP.forEach(c=>RM['US-MI-'+c]='NLP');
  function regionOf(c){return RM[c]||(c?.startsWith('US-MI-')?'SLP':'US-MI');}

  // -- State --
  let region='US-MI', all=[], map, markers=[];

  // -- Search --
  const searchEl = document.getElementById('search');
  if(searchEl){
    searchEl.addEventListener('keypress',e=>{
      if(e.key==='Enter'){
        const v=searchEl.value.trim();
        if(v) location.href=`/predictions?name=${encodeURIComponent(v)}`;
      }
    });
  }

  // -- Conditions --
  fetch('/api/predict?mode=forecast&region=saginaw-bay')
    .then(r=>r.json())
    .then(d=>{
      const el=document.getElementById('cond');
      const parts=[];
      if(d.weather) parts.push(`<strong>${d.weather.temp}°</strong> ${d.weather.wind} · ${d.weather.forecast}`);
      (d.birdingConditions||[]).forEach(c=>{
        const cls=c.type==='positive'?'g':c.type==='alert'?'r':'y';
        parts.push(`<span class="cpill ${cls}">${trunc(c.text,60)}</span>`);
      });
      if(parts.length) el.innerHTML=parts.join(' ');
      else el.style.display='none';
    })
    .catch(()=>{document.getElementById('cond').style.display='none';});

  // -- Map --
  map = L.map('map',{scrollWheelZoom:false,zoomControl:true}).setView([44.3,-84.7],6);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
    attribution:'© OSM © CARTO',maxZoom:14
  }).addTo(map);

  const dotIcon = L.divIcon({
    className:'',
    html:'<div style="width:14px;height:14px;background:#1a5c2a;border:2.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.25)"></div>',
    iconSize:[14,14],iconAnchor:[7,7]
  });

  function plotMap(list){
    markers.forEach(m=>map.removeLayer(m));
    markers=[];
    let ct=0;
    list.forEach(s=>{
      if(!s.lat||!s.lng)return;
      ct++;
      markers.push(
        L.marker([s.lat,s.lng],{icon:dotIcon})
          .bindPopup(`<div style="min-width:150px">
            <b>${s.comName}</b><br>
            <span style="font-size:0.8rem;color:#555">${trunc(s.locName,30)}</span><br>
            <span style="font-size:0.75rem;color:#888">${fmtDate(s.obsDt)}${s.howMany?' · '+s.howMany:''}</span><br>
            <a href="${specUrl(s)}" style="font-size:0.78rem;color:#1a5c2a;font-weight:500">View species profile →</a>
          </div>`)
          .addTo(map)
      );
    });
    document.getElementById('mapCount').textContent=ct+' sightings mapped this week';
  }

  // -- Feed --
  function renderFeed(list){
    const el=document.getElementById('feed');
    if(!list.length){
      el.innerHTML='<p style="color:var(--text-mid);padding:0.5rem">No notable sightings for this region.</p>';
      return;
    }
    el.innerHTML=list.map(s=>{
      const img=s.image?.url||'';
      return `<a href="${specUrl(s)}" class="f-card">
        ${img?`<img class="f-img" src="${img}" alt="${s.comName}" loading="lazy" onerror="this.style.display='none'">`:'<div class="f-img" style="display:flex;align-items:center;justify-content:center;font-size:1.3rem">🐦</div>'}
        <div class="f-body">
          <div class="f-name">${s.comName}</div>
          <div class="f-loc">📍 ${trunc(s.locName,35)}</div>
          <div class="f-when">${fmtDate(s.obsDt)}${s.howMany?' · '+s.howMany+' reported':''}</div>
        </div>
      </a>`;
    }).join('');
  }

  // -- Load --
  fetch('/api/notable?region=US-MI&back=7')
    .then(r=>r.json())
    .then(d=>{
      all=d.sightings||[];
      renderFeed(all);
      plotMap(all);
    })
    .catch(()=>{
      document.getElementById('feed').innerHTML='<p style="color:var(--text-mid)">Unable to load sightings.</p>';
    });

  // -- Filters --
  document.querySelectorAll('.filter-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      region=btn.dataset.r;
      const filtered=region==='US-MI'?all:all.filter(s=>regionOf(s.subnational2Code)===region);
      renderFeed(filtered);
      plotMap(filtered);
      const label=region==='US-MI'?'All Michigan':region==='UP'?'Upper Peninsula':region==='NLP'?'Northern Lower':'Southern Lower';
      document.getElementById('feedTitle').textContent='Notable Sightings: '+label;
    });
  });

  // -- County footer --
  const counties={'017':'Bay','145':'Saginaw','069':'Iosco','063':'Huron','011':'Arenac','111':'Midland','157':'Tuscola','081':'Kent','161':'Washtenaw','163':'Wayne','125':'Oakland','099':'Macomb','049':'Genesee','077':'Kalamazoo','139':'Ottawa','065':'Ingham','115':'Monroe','021':'Berrien','033':'Chippewa','103':'Marquette','055':'Grand Traverse','089':'Leelanau','121':'Muskegon','047':'Emmet'};
  const cf=document.getElementById('cfooter');
  if(cf) cf.innerHTML=Object.entries(counties).map(([f,n])=>`<a href="/county/${f}">${n}</a>`).join('');

})();
