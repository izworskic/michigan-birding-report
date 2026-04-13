(function () {
  'use strict';

  // ---- Helpers ----
  function formatDate(dtStr) {
    if (!dtStr) return '';
    const d = new Date(dtStr.replace(' ', 'T'));
    if (isNaN(d)) return dtStr;
    const now = new Date();
    const diffMs = now - d;
    const diffHrs = diffMs / 3600000;
    const diffDays = Math.floor(diffHrs / 24);
    
    // Today: show time
    if (diffDays === 0 && d.getDate() === now.getDate()) {
      return 'Today ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    // Yesterday
    if (diffDays <= 1 && d.getDate() === now.getDate() - 1) {
      return 'Yesterday ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    // Within a week: "3 days ago"
    if (diffDays < 7) return diffDays + ' days ago';
    // Older: "Apr 5"
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : s || ''; }

  function speciesUrl(s) {
    return `/species/${s.speciesCode}?name=${encodeURIComponent(s.comName)}&sci=${encodeURIComponent(s.sciName || '')}`;
  }

  // ---- Region mapping ----
  const UP = ['003','013','033','041','043','053','061','071','083','095','097','103','109','131','153'];
  const NLP = ['001','007','009','019','029','031','039','047','055','069','079','085','089','101','107','113','119','129','135','137','141','143','157','165'];
  const COUNTY_MAP = {};
  UP.forEach(c => COUNTY_MAP['US-MI-' + c] = 'UP');
  NLP.forEach(c => COUNTY_MAP['US-MI-' + c] = 'NLP');
  function regionOf(code) { return COUNTY_MAP[code] || (code?.startsWith('US-MI-') ? 'SLP' : 'US-MI'); }

  // ---- State ----
  let currentRegion = 'US-MI';
  let allNotable = [];
  let stateMap = null;
  let markers = [];

  // ---- Hero search ----
  window.heroSearchGo = function () {
    const v = document.getElementById('heroSearch').value.trim();
    if (v) window.location.href = `/predictions?name=${encodeURIComponent(v)}#birdAnswer`;
  };
  document.getElementById('heroSearch')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') heroSearchGo();
  });

  // ---- Conditions bar ----
  async function loadConditions() {
    const bar = document.getElementById('conditionsBar');
    try {
      const res = await fetch('/api/predict?mode=forecast&region=saginaw-bay');
      if (!res.ok) throw new Error();
      const d = await res.json();
      const parts = [];
      if (d.weather) {
        parts.push(`<span class="cond-item"><strong>${d.weather.temp}°</strong> ${d.weather.wind}</span>`);
        parts.push(`<span class="cond-item">${d.weather.forecast}</span>`);
      }
      const bc = d.birdingConditions || [];
      bc.forEach(c => {
        const dot = c.type === 'positive' ? 'green' : c.type === 'alert' ? 'red' : 'yellow';
        parts.push(`<span class="cond-item"><span class="cond-dot ${dot}"></span> ${truncate(c.text, 70)}</span>`);
      });
      if (parts.length) bar.innerHTML = parts.join('');
    } catch { bar.style.display = 'none'; }
  }

  // ---- Statewide map ----
  function initStateMap() {
    stateMap = L.map('stateMap', { scrollWheelZoom: false, zoomControl: true }).setView([44.3, -84.7], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 14,
    }).addTo(stateMap);
  }

  function plotMarkers(sightings) {
    markers.forEach(m => stateMap.removeLayer(m));
    markers = [];
    const icon = L.divIcon({
      className: '',
      html: '<div style="width:14px;height:14px;background:#1a5c2a;border:2.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
    sightings.forEach(s => {
      if (!s.lat || !s.lng) return;
      const m = L.marker([s.lat, s.lng], { icon })
        .bindPopup(`<div style="font-family:var(--font-body);min-width:160px">
          <b style="font-size:0.95rem">${s.comName}</b><br>
          <span style="font-size:0.8rem;color:#555">${truncate(s.locName, 35)}</span><br>
          <span style="font-size:0.75rem;color:#888">${formatDate(s.obsDt)}${s.howMany ? ' · ' + s.howMany : ''}</span><br>
          <a href="${speciesUrl(s)}" style="font-size:0.75rem">View species profile →</a>
        </div>`)
        .addTo(stateMap);
      markers.push(m);
    });
  }

  // ---- Notable sightings ----
  async function loadNotable() {
    const grid = document.getElementById('notableGrid');
    try {
      const res = await fetch('/api/notable?region=US-MI&back=7');
      if (!res.ok) throw new Error('API ' + res.status);
      const data = await res.json();
      allNotable = data.sightings || [];
      document.getElementById('statNotable').textContent = allNotable.length;
      renderNotable(allNotable);
      plotMarkers(allNotable);
      populateRegionCards();
    } catch (err) {
      grid.innerHTML = `<div class="error-state"><p>Unable to load sightings.</p></div>`;
    }
  }

  function renderNotable(list) {
    const grid = document.getElementById('notableGrid');
    if (!list.length) {
      grid.innerHTML = '<div class="loading-state"><p>No notable sightings for this region this week.</p></div>';
      return;
    }
    grid.innerHTML = list.map((s, i) => {
      const img = s.image?.url || '';
      const imgEl = img
        ? `<img class="sighting-img" src="${img}" alt="${s.comName}" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="placeholder-img"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="10" r="3"/><path d="M12 2C8 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-4-8-8-8z"/></svg></div>`;
      return `<a href="${speciesUrl(s)}" class="sighting-card" style="animation-delay:${i * 0.04}s;text-decoration:none;color:inherit">
        ${imgEl}
        <div class="sighting-body">
          <div class="sighting-name">${s.comName}</div>
          <div class="sighting-sci">${s.sciName}</div>
          <div class="sighting-meta">
            <span class="meta-tag">Notable</span>
            <span>📍 ${truncate(s.locName, 28)}</span>
            <span>🕐 ${formatDate(s.obsDt)}</span>
            ${s.howMany ? `<span>×${s.howMany}</span>` : ''}
          </div>
        </div>
      </a>`;
    }).join('');
  }

  // ---- Filters ----
  function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRegion = btn.dataset.region;
        filterNotable();
      });
    });
  }

  function filterNotable() {
    const filtered = currentRegion === 'US-MI' ? allNotable :
      allNotable.filter(s => regionOf(s.subnational2Code) === currentRegion);
    renderNotable(filtered);
    plotMarkers(filtered);
  }

  window.selectRegion = function (region) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const t = document.querySelector(`.filter-btn[data-region="${region}"]`);
    if (t) t.classList.add('active');
    currentRegion = region;
    filterNotable();
    document.getElementById('mapSection')?.scrollIntoView({ behavior: 'smooth' });
  };

  // ---- Region cards ----
  function populateRegionCards() {
    const data = { UP: [], NLP: [], SLP: [] };
    allNotable.forEach(s => { const r = regionOf(s.subnational2Code); if (data[r]) data[r].push(s); });
    const ids = { UP: 'upRecent', NLP: 'nlpRecent', SLP: 'slpRecent' };
    for (const [region, sightings] of Object.entries(data)) {
      const el = document.getElementById(ids[region]);
      if (!el) continue;
      if (sightings.length) {
        const names = sightings.slice(0, 4).map(s => s.comName);
        el.innerHTML = `<div style="font-size:0.8rem;color:var(--forest);font-weight:600">${sightings.length} notable this week</div>
          <div style="font-size:0.75rem;color:var(--text-mid);margin-top:0.15rem">${names.join(', ')}${sightings.length > 4 ? '...' : ''}</div>`;
      } else {
        el.innerHTML = '<span style="font-size:0.75rem;color:var(--text-light)">No notable sightings this week</span>';
      }
    }
  }

  // ---- Saginaw Bay preview ----
  async function loadBayPreview() {
    const container = document.getElementById('bayHotspots');
    try {
      const res = await fetch('/api/hotspot?mode=saginaw-bay&back=14');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const species = data.species || [];
      document.getElementById('statSpecies').textContent = data.speciesCount || species.length || '—';
      if (!species.length) { container.innerHTML = '<p style="color:var(--text-light)">No recent sightings.</p>'; return; }
      container.innerHTML = species.slice(0, 8).map(sp => {
        const img = sp.image?.url || '';
        const hasImg = img && !img.includes('placeholder');
        return `<a href="${speciesUrl(sp)}" class="bay-hotspot-card" style="display:block;text-decoration:none;color:inherit">
          ${hasImg ? `<img src="${img}" alt="${sp.comName}" style="width:100%;height:90px;object-fit:cover;border-radius:3px;margin-bottom:0.4rem" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="bay-hotspot-name">${sp.comName}</div>
          <div class="bay-hotspot-species">${truncate(sp.locName, 32)}</div>
          <div class="bay-hotspot-recent">${formatDate(sp.obsDt)}${sp.howMany ? ' · ' + sp.howMany : ''}</div>
        </a>`;
      }).join('');
    } catch { container.innerHTML = '<p style="color:var(--text-light)">Bay data temporarily unavailable.</p>'; }
  }

  // ---- Forecast ----
  async function loadForecast() {
    const card = document.getElementById('forecastCard');
    try {
      const res = await fetch('/api/recommend');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const text = data.recommendation || 'No forecast available.';
      const paras = text.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
      card.innerHTML = `${paras}<div class="forecast-meta">
        ${data.speciesCount ? data.speciesCount + ' species reported statewide' : ''}
        ${data.notableCount ? ' · ' + data.notableCount + ' notable' : ''}
        <span style="float:right"><a href="/predictions" style="color:var(--forest)">Full predictions →</a></span>
      </div>`;
    } catch {
      card.innerHTML = '<p>Check the <a href="/predictions">Predictions page</a> for weather-driven birding forecasts.</p>';
    }
  }

  // ---- Calendar ----
  function renderCalendar() {
    const m = new Date().getMonth() + 1;
    const events = [
      { months: 'Mar - Apr', event: 'Waterfowl Migration', desc: 'Tundra Swans, ducks, and geese stage on Saginaw Bay and Lake St. Clair.', active: m >= 3 && m <= 4 },
      { months: 'Apr - May', event: 'Shorebird Passage', desc: 'Plovers, sandpipers, and yellowlegs move through coastal mudflats.', active: m >= 4 && m <= 5 },
      { months: 'May 1-25', event: 'Warbler Wave', desc: '30+ warbler species pass through Michigan in three weeks. The main event.', active: m === 5 },
      { months: 'May - Jun', event: "Kirtland's Warbler Season", desc: 'Breeding males on territory in the Mio and Grayling jack pine barrens.', active: m >= 5 && m <= 6 },
      { months: 'Jun - Jul', event: 'Breeding Season', desc: 'Common Loons on northern lakes, Piping Plovers on Lake Michigan beaches.', active: m >= 6 && m <= 7 },
      { months: 'Jul - Sep', event: 'Southbound Shorebirds', desc: 'Saginaw Bay and Pointe Mouillee host large concentrations of returning shorebirds.', active: m >= 7 && m <= 9 },
      { months: 'Sep - Oct', event: 'Hawk Migration', desc: "Broad-winged Hawks kettle mid-September. Sharp-shins and Cooper's through October.", active: m >= 9 && m <= 10 },
      { months: 'Oct - Nov', event: 'Waterfowl Staging', desc: 'Tens of thousands of ducks and geese on the Great Lakes. Rare gull season.', active: m >= 10 && m <= 11 },
      { months: 'Nov - Mar', event: 'Winter Specialties', desc: 'Snowy Owl irruptions, winter finch invasions, Great Gray Owls in the UP.', active: m >= 11 || m <= 3 },
    ];
    document.getElementById('calendarGrid').innerHTML = events.map(e =>
      `<div class="calendar-item" style="${e.active ? 'border-left-color:var(--forest);border-left-width:4px;background:var(--forest-light)' : ''}">
        <div class="calendar-months">${e.months}${e.active ? ' ← NOW' : ''}</div>
        <div class="calendar-event">${e.event}</div>
        <div class="calendar-desc">${e.desc}</div>
      </div>`
    ).join('');
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initStateMap();
    loadConditions();
    loadNotable();
    loadBayPreview();
    loadForecast();
    renderCalendar();
  });
})();
