(function () {
  'use strict';

  // ---- Helpers ----
  function fmtDate(dt) {
    if (!dt) return '';
    const d = new Date(dt.replace(' ', 'T'));
    if (isNaN(d)) return dt;
    const now = new Date();
    const days = Math.floor((now - d) / 86400000);
    if (days === 0 && d.getDate() === now.getDate())
      return 'Today ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (days <= 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : s || ''; }
  function specUrl(s) {
    return `/species/${s.speciesCode}?name=${encodeURIComponent(s.comName)}&sci=${encodeURIComponent(s.sciName || '')}`;
  }

  // ---- Regions ----
  const UP = '003,013,033,041,043,053,061,071,083,095,097,103,109,131,153'.split(',');
  const NLP = '001,007,009,019,029,031,039,047,055,069,079,085,089,101,107,113,119,129,135,137,141,143,157,165'.split(',');
  const RM = {};
  UP.forEach(c => RM['US-MI-' + c] = 'UP');
  NLP.forEach(c => RM['US-MI-' + c] = 'NLP');
  function regionOf(c) { return RM[c] || (c?.startsWith('US-MI-') ? 'SLP' : 'US-MI'); }

  // ---- State ----
  let region = 'US-MI';
  let notable = [];
  let map, markers = [];

  // ---- Search ----
  window.heroSearchGo = function () {
    const v = document.getElementById('heroSearch')?.value?.trim();
    if (v) location.href = `/predictions?name=${encodeURIComponent(v)}`;
  };
  document.getElementById('heroSearch')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') heroSearchGo();
  });

  // ---- Conditions strip ----
  async function loadConditions() {
    const el = document.getElementById('condStrip');
    try {
      const r = await fetch('/api/predict?mode=forecast&region=saginaw-bay');
      const d = await r.json();
      const parts = [];
      if (d.weather) {
        parts.push(`<strong>${d.weather.temp}°</strong> ${d.weather.wind} · ${d.weather.forecast}`);
      }
      (d.birdingConditions || []).forEach(c => {
        const cls = c.type === 'positive' ? 'good' : c.type === 'alert' ? 'alert' : c.type === 'caution' ? 'warn' : 'info';
        parts.push(`<span class="cond-pill ${cls}">${trunc(c.text, 65)}</span>`);
      });
      if (parts.length) el.innerHTML = parts.join(' ');
      else el.style.display = 'none';
    } catch { el.style.display = 'none'; }
  }

  // ---- Map ----
  function initMap() {
    map = L.map('stateMap', { scrollWheelZoom: false }).setView([44.3, -84.7], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO', maxZoom: 14
    }).addTo(map);
  }

  function plotMap(list) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    const icon = L.divIcon({
      className: '',
      html: '<div style="width:14px;height:14px;background:#1a5c2a;border:2.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.25)"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7]
    });
    list.forEach(s => {
      if (!s.lat || !s.lng) return;
      markers.push(
        L.marker([s.lat, s.lng], { icon })
          .bindPopup(`<div style="min-width:150px"><b>${s.comName}</b><br><span style="font-size:0.8rem;color:#555">${trunc(s.locName, 30)}</span><br><span style="font-size:0.75rem;color:#888">${fmtDate(s.obsDt)}${s.howMany ? ' · ' + s.howMany : ''}</span><br><a href="${specUrl(s)}" style="font-size:0.75rem;color:#1a5c2a">Species profile →</a></div>`)
          .addTo(map)
      );
    });
    document.getElementById('markerCount').textContent = markers.length;
  }

  // ---- Feed ----
  async function loadNotable() {
    const feed = document.getElementById('feed');
    try {
      const r = await fetch('/api/notable?region=US-MI&back=7');
      const d = await r.json();
      notable = d.sightings || [];
      document.getElementById('kpiNotable').textContent = notable.length;
      render(notable);
      plotMap(notable);
    } catch {
      feed.innerHTML = '<div class="error-state"><p>Unable to load sightings.</p></div>';
    }
  }

  function render(list) {
    const feed = document.getElementById('feed');
    if (!list.length) {
      feed.innerHTML = '<p style="color:var(--text-mid);padding:1rem">No notable sightings for this region this week.</p>';
      return;
    }
    feed.innerHTML = list.map(s => {
      const img = s.image?.url || '';
      return `<a href="${specUrl(s)}" class="feed-card">
        ${img ? `<img class="feed-img" src="${img}" alt="${s.comName}" loading="lazy" onerror="this.style.display='none'">` : '<div class="feed-img" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem">🐦</div>'}
        <div class="feed-info">
          <div class="feed-name">${s.comName}</div>
          <div class="feed-loc">📍 ${trunc(s.locName, 35)}</div>
          <div class="feed-when">${fmtDate(s.obsDt)}${s.howMany ? ' · ' + s.howMany + ' reported' : ''} <span class="feed-badge">Notable</span></div>
        </div>
      </a>`;
    }).join('');
  }

  // ---- Filters ----
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      region = btn.dataset.region;
      const filtered = region === 'US-MI' ? notable : notable.filter(s => regionOf(s.subnational2Code) === region);
      render(filtered);
      plotMap(filtered);
    });
  });

  // ---- Bay KPI ----
  async function loadBayKPI() {
    try {
      const r = await fetch('/api/hotspot?mode=saginaw-bay&back=14');
      const d = await r.json();
      document.getElementById('kpiBay').textContent = d.speciesCount || '—';
    } catch { }
  }

  // ---- Migration KPI ----
  function migrationKPI() {
    const m = new Date().getMonth() + 1;
    const el = document.getElementById('kpiMigration');
    const lbl = document.getElementById('kpiMigLabel');
    if ((m >= 3 && m <= 6) || (m >= 8 && m <= 11)) {
      el.textContent = 'ACTIVE';
      el.style.color = '#2e7d32';
      lbl.textContent = 'Migration Season';
    } else {
      el.textContent = 'OFF';
      el.style.color = 'var(--text-light)';
      lbl.textContent = 'Migration Season';
    }
  }

  // ---- Forecast ----
  async function loadForecast() {
    const el = document.getElementById('forecastCard');
    try {
      const r = await fetch('/api/recommend');
      const d = await r.json();
      const text = d.recommendation || '';
      const paras = text.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
      el.innerHTML = paras + `<div class="forecast-meta">
        <a href="/predictions" style="color:var(--forest);font-weight:500">Full predictions + Ask about any bird →</a>
      </div>`;
    } catch {
      el.innerHTML = '<p>Visit the <a href="/predictions" style="color:var(--forest)">Predictions page</a> for weather-driven forecasts.</p>';
    }
  }

  // ---- Calendar ----
  function renderCal() {
    const m = new Date().getMonth() + 1;
    const items = [
      { mo: 'Mar-Apr', ev: 'Waterfowl', n: [3, 4] },
      { mo: 'Apr-May', ev: 'Shorebirds', n: [4, 5] },
      { mo: 'May', ev: 'Warbler Wave', n: [5] },
      { mo: 'May-Jun', ev: "Kirtland's", n: [5, 6] },
      { mo: 'Jun-Jul', ev: 'Breeding', n: [6, 7] },
      { mo: 'Jul-Sep', ev: 'Fall Shore', n: [7, 8, 9] },
      { mo: 'Sep-Oct', ev: 'Hawks', n: [9, 10] },
      { mo: 'Oct-Nov', ev: 'Duck Staging', n: [10, 11] },
      { mo: 'Dec-Feb', ev: 'Winter', n: [12, 1, 2] },
    ];
    document.getElementById('calRow').innerHTML = items.map(i => {
      const now = i.n.includes(m);
      return `<div class="cal-chip ${now ? 'now' : ''}">
        <div class="cm">${i.mo}${now ? ' ★' : ''}</div>
        <div class="ce">${i.ev}</div>
      </div>`;
    }).join('');
  }

  // ---- County links ----
  function renderCounties() {
    const counties = { '017': 'Bay', '145': 'Saginaw', '069': 'Iosco', '063': 'Huron', '011': 'Arenac', '111': 'Midland', '157': 'Tuscola', '081': 'Kent', '161': 'Washtenaw', '163': 'Wayne', '125': 'Oakland', '099': 'Macomb', '049': 'Genesee', '077': 'Kalamazoo', '139': 'Ottawa', '065': 'Ingham', '115': 'Monroe', '021': 'Berrien', '033': 'Chippewa', '103': 'Marquette', '055': 'Grand Traverse', '089': 'Leelanau', '121': 'Muskegon', '047': 'Emmet' };
    document.getElementById('countyLinks').innerHTML = Object.entries(counties)
      .map(([f, n]) => `<a href="/county/${f}">${n}</a>`).join('');
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadConditions();
    loadNotable();
    loadBayKPI();
    migrationKPI();
    loadForecast();
    renderCal();
    renderCounties();
  });
})();
