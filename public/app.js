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
  function specUrl(s){return `/species/${s.speciesCode}?name=${encodeURIComponent(s.comName)}&sci=${encodeURIComponent(s.sciName||'')}`;}

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

  const dailyCard = document.getElementById('latestDailyCard');
  if(dailyCard){
    fetch('/api/latest-daily')
      .then(r=>r.json())
      .then(d=>{
        if(d.url) dailyCard.href = d.url;
        const titleEl = document.getElementById('latestDailyTitle');
        const metaEl = document.getElementById('latestDailyMeta');
        if(titleEl && d.title) titleEl.textContent = d.title;
        if(metaEl) {
          const when = d.date ? new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : 'Updated every morning';
          metaEl.textContent = when + ' from Michigan Birding Daily';
        }
      })
      .catch(()=>{});
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
  if(cf) cf.innerHTML='<a href="/counties">All 83 counties</a> ' + Object.entries(counties).map(([f,n])=>`<a href="/county/${f}">${n}</a>`).join('');

})();
