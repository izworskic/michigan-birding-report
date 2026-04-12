/**
 * app.js — Michigan Birding Report client-side
 * Fetches data from API routes and renders UI
 */

(function () {
  'use strict';

  const API = '';

  // ---- Helpers ----
  function formatDate(dtStr) {
    if (!dtStr) return '';
    const d = new Date(dtStr.replace(' ', 'T'));
    const now = new Date();
    const diff = now - d;
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  // ---- Notable Sightings ----
  let currentRegion = 'US-MI';
  let allNotable = [];

  async function loadNotable() {
    const grid = document.getElementById('notableGrid');
    try {
      const res = await fetch(`${API}/api/notable?region=US-MI&back=7`);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const data = await res.json();
      allNotable = data.sightings || [];

      document.getElementById('statNotable').textContent = allNotable.length;
      renderNotable(allNotable);
    } catch (err) {
      grid.innerHTML = `<div class="error-state">
        <p>Unable to load sightings. eBird API may be temporarily unavailable.</p>
        <p style="font-size:0.75rem;opacity:0.6">${err.message}</p>
      </div>`;
    }
  }

  function renderNotable(sightings) {
    const grid = document.getElementById('notableGrid');
    if (!sightings.length) {
      grid.innerHTML = '<div class="loading-state"><p>No notable sightings found for this region.</p></div>';
      return;
    }

    grid.innerHTML = sightings.map((s, i) => {
      const imgSrc = s.image?.url || '';
      const imgHtml = imgSrc
        ? `<img class="sighting-img" src="${imgSrc}" alt="${s.comName}" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="placeholder-img"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2C8 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-4-8-8-8z"/><circle cx="12" cy="10" r="3"/></svg></div>`;

      return `<a href="/species/${s.speciesCode}?name=${encodeURIComponent(s.comName)}&sci=${encodeURIComponent(s.sciName)}" class="sighting-card" style="animation-delay:${i * 0.05}s;text-decoration:none;color:inherit">
        ${imgHtml}
        <div class="sighting-body">
          <div class="sighting-name">${s.comName}</div>
          <div class="sighting-sci">${s.sciName}</div>
          <div class="sighting-meta">
            <span class="meta-tag">Notable</span>
            <span>📍 ${truncate(s.locName, 30)}</span>
            <span>🕐 ${formatDate(s.obsDt)}</span>
            ${s.howMany ? `<span>×${s.howMany}</span>` : ''}
          </div>
        </div>
      </a>`;
    }).join('');
  }

  // ---- Region filters ----
  function initFilters() {
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRegion = btn.dataset.region;
        filterNotable();
      });
    });
  }

  // County FIPS to region mapping (simplified)
  const COUNTY_REGIONS = {};
  const UP_COUNTIES = ['003','013','033','041','043','053','061','071','083','095','097','103','109','131','153'];
  const NLP_COUNTIES = ['001','007','009','019','029','031','039','047','055','069','079','085','089','101','107','113','119','129','135','137','141','143','157','165'];
  UP_COUNTIES.forEach(c => COUNTY_REGIONS['US-MI-' + c] = 'UP');
  NLP_COUNTIES.forEach(c => COUNTY_REGIONS['US-MI-' + c] = 'NLP');
  // Everything else in MI is SLP

  function getRegionForCounty(code) {
    if (!code) return 'SLP';
    if (COUNTY_REGIONS[code]) return COUNTY_REGIONS[code];
    if (code.startsWith('US-MI-')) return 'SLP';
    return 'US-MI';
  }

  function filterNotable() {
    if (currentRegion === 'US-MI') {
      renderNotable(allNotable);
    } else {
      const filtered = allNotable.filter(s =>
        getRegionForCounty(s.subnational2Code) === currentRegion
      );
      renderNotable(filtered);
    }
  }

  // ---- Saginaw Bay Hub ----
  async function loadBayPreview() {
    const container = document.getElementById('bayHotspots');
    try {
      const res = await fetch(`${API}/api/hotspot?mode=saginaw-bay&back=14`);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const data = await res.json();

      const species = data.species || [];
      document.getElementById('statSpecies').textContent = data.speciesCount || species.length || '—';

      if (!species.length) {
        container.innerHTML = '<div class="loading-state"><p>No recent sightings in the Saginaw Bay region.</p></div>';
        return;
      }

      // Show top species as cards with images
      const topSpecies = species.slice(0, 8);
      container.innerHTML = topSpecies.map(sp => {
        const imgSrc = sp.image?.url || '';
        const hasImg = imgSrc && !imgSrc.includes('placeholder');
        return `<div class="bay-hotspot-card">
          ${hasImg ? `<img src="${imgSrc}" alt="${sp.comName}" style="width:100%;height:100px;object-fit:cover;border-radius:2px;margin-bottom:0.5rem" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="bay-hotspot-name">${sp.comName}</div>
          <div class="bay-hotspot-species">${truncate(sp.locName, 35)}</div>
          <div class="bay-hotspot-recent">${formatDate(sp.obsDt)}${sp.howMany ? ' · ' + sp.howMany + ' reported' : ''}</div>
        </div>`;
      }).join('');

    } catch (err) {
      container.innerHTML = `<div class="error-state" style="padding:1rem">
        <p style="font-size:0.85rem">Bay data temporarily unavailable</p>
      </div>`;
    }
  }

  // ---- Seasonal Calendar ----
  function renderCalendar() {
    const events = [
      { months: 'Mar - Apr', event: 'Waterfowl Migration', desc: 'Tundra Swans, ducks, and geese stage on Saginaw Bay and Lake St. Clair.' },
      { months: 'Apr - May', event: 'Shorebird Passage', desc: 'Plovers, sandpipers, and yellowlegs move through coastal mudflats and flooded fields.' },
      { months: 'May 1 - 25', event: 'Warbler Wave', desc: 'Peak neotropical migrants. 30+ warbler species pass through Michigan in three weeks.' },
      { months: 'May - Jun', event: "Kirtland's Warbler Season", desc: 'Breeding males singing on territory in the Mio and Grayling jack pine barrens.' },
      { months: 'Jun - Jul', event: 'Breeding Season', desc: 'Resident species nesting. Common Loons on northern lakes, Piping Plovers on Lake Michigan beaches.' },
      { months: 'Jul - Sep', event: 'Southbound Shorebirds', desc: 'Early fall migrants return. Saginaw Bay and Pointe Mouillee host large concentrations.' },
      { months: 'Sep - Oct', event: 'Hawk Migration', desc: 'Broad-winged Hawks kettle over ridgelines. Sharp-shins and Cooper\'s follow through October.' },
      { months: 'Oct - Nov', event: 'Sparrow & Waterfowl Influx', desc: 'Late migrants and early winter arrivals. White-crowned Sparrows, Tundra Swans returning.' },
      { months: 'Nov - Mar', event: 'Winter Specialties', desc: 'Snowy Owl irruptions, winter finch invasions, Great Gray Owl sightings in the UP.' },
    ];

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = events.map(e => `
      <div class="calendar-item">
        <div class="calendar-months">${e.months}</div>
        <div class="calendar-event">${e.event}</div>
        <div class="calendar-desc">${e.desc}</div>
      </div>
    `).join('');
  }

  // ---- Migration Season Note ----
  function renderMigrationNote() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const note = document.getElementById('migrationNote');

    if ((month >= 3 && month <= 6) || (month >= 8 && month <= 11)) {
      note.textContent = 'BirdCast live data is currently active. Check dashboards after sunset for real-time migration radar.';
    } else {
      note.textContent = 'BirdCast live feeds are active March 1 through June 15 and August 1 through November 15. Historical data is available year-round.';
    }
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    loadForecast();
    loadNotable();
    loadBayPreview();
    renderCalendar();
    renderMigrationNote();
  });

  // ---- Weekend Forecast ----
  async function loadForecast() {
    const card = document.getElementById('forecastCard');
    try {
      const res = await fetch(`${API}/api/recommend`);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const data = await res.json();

      const text = data.recommendation || 'No forecast available.';
      const paragraphs = text.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');

      card.innerHTML = `
        ${paragraphs}
        <div class="forecast-meta">
          ${data.speciesCount ? `${data.speciesCount} species reported statewide` : ''}
          ${data.notableCount ? ` · ${data.notableCount} notable sightings` : ''}
          ${data.source ? ` · Source: ${data.source}` : ''}
        </div>
      `;
    } catch (err) {
      card.innerHTML = `<p>April in Michigan means migration is underway. Check Tawas Point and Saginaw Bay for early warblers, shorebirds, and waterfowl staging. Sandhill Cranes are displaying statewide.</p>
        <div class="forecast-meta">Forecast temporarily unavailable</div>`;
    }
  }

})();
