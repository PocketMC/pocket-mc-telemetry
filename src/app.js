/**
 * Pocket MC Telemetry Dashboard
 * Live anonymous usage analytics
 */
(function () {
  'use strict';

  const TELEMETRY_PROXIES = [
    "https://pocket-mc-proxy.onrender.com/api/telemetry/stats",
    "https://pocket-mc-proxy-3fqm.onrender.com/api/telemetry/stats",
    "https://pocket-mc-proxy-20d5.onrender.com/api/telemetry/stats",
    "https://pocket-mc-proxy-n2qx.onrender.com/api/telemetry/stats",
  ];
  const REFRESH_INTERVAL = 30;

  const GLOBAL_METRIC_DEFAULTS = {
    totalInstalls: 0,
    installVersionDistribution: {},
    installLocationDistribution: {},
    globalUptimeHours: 0,
    totalServersCreated: 0,
    totalServersDeleted: 0,
  };

  const LIVE_METRIC_FIELDS = [
    'openClients',
    'activeUsers',
    'totalRunningServers',
  ];

  const LIVE_DISTRIBUTION_FIELDS = [
    'serverTypeDistribution',
    'versionDistribution',
    'locationDistribution',
  ];

  // ── Theme Configuration ──────────────────────────────────────────
  const theme = {
    textPrimary: '#f8fafc',
    textMuted: '#94a3b8',
    border: 'rgba(51, 65, 85, 0.3)',
    bgSurface: 'rgba(15, 23, 42, 0.85)',
    bgTooltip: 'rgba(15, 23, 42, 0.95)',
    font: '"Inter", sans-serif',
    paletteGreen:  '#34d399',
    paletteBlue:   '#38bdf8',
    palettePurple: '#a78bfa',
  };

  // Multi‑value palettes (cycled if more entries than palette length)
  const palettes = {
    green:  ['#10b981', '#059669', '#34d399', '#047857', '#6ee7b7', '#064e3b'],
    blue:   ['#0ea5e9', '#0284c7', '#38bdf8', '#0369a1', '#7dd3fc', '#0c4a6e'],
    purple: ['#8b5cf6', '#7c3aed', '#a78bfa', '#6d28d9', '#c4b5fd', '#4c1d95'],
  };

  // ── State ────────────────────────────────────────────────────────
  let worldMapInstance = null;


  let lastSuccess = null;
  let timerId = null;

  // ── Helpers ──────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
  const pct = (n, total) => (total ? ((n / total) * 100).toFixed(1) + '%' : '0%');

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function addDistribution(target, source) {
    Object.entries(source || {}).forEach(([key, value]) => {
      target[key] = toNumber(target[key]) + toNumber(value);
    });
  }

  function aggregateTelemetry(proxyResults, totalProxies) {
    const responses = proxyResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    if (!responses.length) {
      throw new Error('No telemetry proxies are online');
    }

    const firstSuccessfulResponse = responses[0];
    const aggregated = {
      ...GLOBAL_METRIC_DEFAULTS,
      ...firstSuccessfulResponse,
      _telemetry: {
        totalProxies,
        onlineProxies: responses.length,
        offlineProxies: totalProxies - responses.length,
      },
    };

    LIVE_METRIC_FIELDS.forEach((field) => {
      aggregated[field] = responses.reduce((sum, response) => sum + toNumber(response[field]), 0);
    });

    LIVE_DISTRIBUTION_FIELDS.forEach((field) => {
      aggregated[field] = {};
      responses.forEach((response) => addDistribution(aggregated[field], response[field]));
    });

    return aggregated;
  }

  async function fetchProxyStats(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function fetchAggregatedStats() {
    const proxyUrls = TELEMETRY_PROXIES.map((url) => url.trim()).filter(Boolean);

    if (!proxyUrls.length) {
      throw new Error('No telemetry proxy URLs configured');
    }

    const proxyResults = await Promise.allSettled(proxyUrls.map(fetchProxyStats));
    return aggregateTelemetry(proxyResults, proxyUrls.length);
  }

  function sortedEntries(obj) {
    return Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c])
    );
  }

  function renderTable(tbodyId, entries) {
    const tbody = $(tbodyId);
    if (!entries.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="empty-row">No data available</td></tr>`;
      return;
    }
    const total = entries.reduce((s, [, v]) => s + v, 0);
    tbody.innerHTML = entries
      .map(
        ([k, v]) => `
          <tr>
            <td class="cell-label">${escapeHtml(k)}</td>
            <td class="cell-num">${fmt(v)}</td>
            <td class="cell-num cell-muted">${pct(v, total)}</td>
          </tr>`
      )
      .join('');
  }

  function renderNewFeatures(stats, installVersion, clientVersion, serverType, installCountry) {
    // 2. Spotlight Auto-Insights inline
    const insightInstalls = $('insight-installs');
    const insightClients = $('insight-clients');
    const insightServers = $('insight-servers');

    const topServer = serverType.length ? serverType[0] : null;
    const topLoc = installCountry.length ? installCountry[0] : null;
    const topVer = clientVersion.length ? clientVersion[0] : null;

    if (insightServers && topServer) {
      insightServers.innerHTML = `<span class="spotlight-highlight">${escapeHtml(topServer[0])}</span> is dominating as the top server type.`;
    }
    if (insightInstalls && topLoc) {
      insightInstalls.innerHTML = `<span class="spotlight-highlight">${escapeHtml(topLoc[0])}</span> leads the world in installations today.`;
    }
    if (insightClients && topVer) {
      const totalClients = clientVersion.reduce((s, [, v]) => s + v, 0);
      insightClients.innerHTML = `<span class="spotlight-highlight">v${escapeHtml(topVer[0])}</span> makes up ${pct(topVer[1], totalClients)} of all live servers.`;
    }

    // Removed Uptime and Retention per user request
    
    // 6. Density Gauge
    const densityEl = $('kpi-serverDensity');
    if (densityEl) {
      const users = Number(stats.activeUsers) || 0;
      const servers = Number(stats.totalRunningServers) || 0;
      const density = servers > 0 ? (users / servers).toFixed(1) : 0;
      densityEl.textContent = density;
    }
  }
  function initMap(stats) {
    const mapBox = $('world-map');
    if (!mapBox) return;
    mapBox.classList.remove('skeleton'); // Remove loading state

    const regionData = {};
    const markers = [];

    // Region Data: Install Locations (Choropleth)
    for (const [country, count] of Object.entries(stats.installLocationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      // Ensure count is a Number, otherwise jsVectorMap's color scale interpolator fails and renders black
      if (match) regionData[match.iso] = Number(count) || 0;
    }

    // Marker Data: Active Client Locations (Live Dots - Blue)
    const activeCountries = new Set(Object.keys(stats.locationDistribution || {}));
    
    for (const [country, count] of Object.entries(stats.locationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      if (match) {
        markers.push({
          name: country,
          coords: match.coords,
          activeCount: count,
          style: { 
            initial: { 
              fill: '#10b981',
              stroke: 'none',
              strokeWidth: 0,
              r: 3
            } 
          }
        });
      }
    }

    // Marker Data: Ever Installed Locations (Installed Dots - Green)
    // Only place these if there isn't already a live active dot on the country
    for (const [country, count] of Object.entries(stats.installLocationDistribution || {})) {
      if (!activeCountries.has(country)) {
        const match = COUNTRY_MAP[country];
        if (match) {
          markers.push({
            name: country,
            coords: match.coords,
            isInstalledOnly: true,
            style: { 
              initial: { 
                fill: '#ffffff',
                stroke: 'none',
                strokeWidth: 0,
                r: 3
              } 
            }
          });
        }
      }
    }

    if (worldMapInstance) {
      // Dynamically update the map to preserve user's pan and zoom state
      if (worldMapInstance.series.regions[0]) {
        worldMapInstance.series.regions[0].setValues(regionData);
      }
      worldMapInstance.removeMarkers();
      worldMapInstance.addMarkers(markers);
      $('world-map')?.classList.remove('skeleton');
      return;
    }

    $('world-map')?.classList.remove('skeleton');
    // Initialize Map
    worldMapInstance = new jsVectorMap({
      selector: '#world-map',
      map: 'world',
      backgroundColor: 'transparent',
      zoomOnScroll: true,
      zoomButtons: false,
      draggable: true,
      bindTouchEvents: true,
      
      regionStyle: {
        initial: {
          fill: '#1a1a1a', // Dark Gray
          stroke: '#000000',
          strokeWidth: 0.5,
          fillOpacity: 1
        },
        hover: {
          fill: '#2a2a2a',
          cursor: 'pointer'
        }
      },
      
      markers: markers,
      markerStyle: {
        initial: {
          fill: '#0ea5e9',
          stroke: 'none',
          strokeWidth: 0,
          r: 3
        },
        hover: {
          fill: '#38bdf8',
          stroke: 'none',
          strokeWidth: 0,
          r: 4
        }
      },
      onRegionTooltipShow(event, tooltip, code) {
        const installs = regionData[code] || 0;
        const countryName = tooltip.text();
        const activeCount = (stats.locationDistribution || {})[countryName] || 0;
        tooltip.text(
          `<div style="font-weight:600;margin-bottom:2px;">${countryName}</div>
           <div style="color:#94a3b8">Active Users: <span style="color:#10b981;font-weight:600">${fmt(activeCount)}</span></div>
           <div style="color:#94a3b8">Installs: <span style="color:#ffffff;font-weight:600">${fmt(installs)}</span></div>`,
          true
        );
      },
      onMarkerTooltipShow(event, tooltip, index) {
        const marker = markers[index];
        const countryName = marker.name;
        const installs = (stats.installLocationDistribution || {})[countryName] || 0;
        const activeCount = (stats.locationDistribution || {})[countryName] || 0;

        tooltip.text(
          `<div style="font-weight:600;margin-bottom:2px;">${countryName}</div>
           <div style="color:#94a3b8">Active Users: <span style="color:#10b981;font-weight:600">${fmt(activeCount)}</span></div>
           <div style="color:#94a3b8">Installs: <span style="color:#ffffff;font-weight:600">${fmt(installs)}</span></div>`,
          true
        );
      },
      onRegionClick(event, code) {
        const installs = regionData[code] || 0;
        const entry = Object.entries(COUNTRY_MAP).find(([, val]) => val.iso === code);
        const name = entry ? entry[0] : code;
        showToast(name, `${fmt(installs)} Total Installs`, '#10b981');
      },
      onMarkerClick(event, index) {
        const marker = markers[index];
        if (marker.isInstalledOnly) {
          showToast(marker.name, 'No active players', '#10b981');
        } else {
          showToast(marker.name, `${fmt(marker.activeCount)} Active Players`, '#0ea5e9');
        }
      }
    });
  }

  // ── Custom Toast for Mobile Clicks ───────────────────────────────
  function showToast(title, message, color) {
    let toast = document.getElementById('map-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'map-toast';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#27272a;color:#e4e4e7;padding:12px 24px;border-radius:8px;z-index:9999;box-shadow:0 10px 25px -5px rgba(0,0,0,0.5);border:1px solid #3f3f46;text-align:center;font-size:14px;pointer-events:none;opacity:0;transition:opacity 0.2s ease, transform 0.2s ease;';
      document.body.appendChild(toast);
    }
    
    // Reset animation state
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 10px)';
    
    // Force reflow
    void toast.offsetWidth;
    
    toast.innerHTML = `<strong style="display:block;margin-bottom:4px;color:${color};font-size:15px;">${title}</strong>${message}`;
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';
    
    if (toast.timeout) clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 10px)';
    }, 2500);
  }


  // ── Main render ──────────────────────────────────────────────────
  function render(stats) {
    // ── SECTION 1: INSTALLS ──────────────────────────────────────
    const installVersion = sortedEntries(stats.installVersionDistribution);
    const installCountry = sortedEntries(stats.installLocationDistribution);
    
    const totalInstalls = Number(stats.totalInstalls) || 0;
    const countriesReached = installCountry.length;
    const avgInstalls = countriesReached > 0 ? (totalInstalls / countriesReached).toFixed(1) : 0;

    $('kpi-totalInstalls').textContent = fmt(stats.totalInstalls);
    $('kpi-installVersions').textContent = fmt(installVersion.length);
    $('kpi-installCountries').textContent = fmt(countriesReached);
    $('kpi-avgInstalls').textContent = avgInstalls;

    renderTable('tbl-installVersion', installVersion);
    renderTable('tbl-installCountry', installCountry);

    // ── SECTION 2: CLIENTS ───────────────────────────────────────
    const open = Number(stats.openClients) || 0;
    const active = Number(stats.activeUsers) || 0;
    const afk = Math.max(0, open - active);

    $('kpi-openClients').textContent = fmt(open);
    $('kpi-activeUsers').textContent = fmt(active);
    $('kpi-afkUsers').textContent = fmt(afk);

    const clientVersion = sortedEntries(stats.versionDistribution);
    const clientLocation = sortedEntries(stats.locationDistribution);

    renderTable('tbl-clientVersion', clientVersion);
    renderTable('tbl-clientLocation', clientLocation);

    // ── SECTION 3: SERVERS ───────────────────────────────────────
    $('kpi-totalServers').textContent = fmt(stats.totalRunningServers);
    $('kpi-totalServersCreated').textContent = fmt(stats.totalServersCreated);
    $('kpi-totalServersDeleted').textContent = fmt(stats.totalServersDeleted);
    $('kpi-uptime').textContent = fmt(Math.round(stats.globalUptimeHours)) + ' Hrs';

    const serverType = sortedEntries(stats.serverTypeDistribution);
    renderTable('tbl-serverType', serverType);
    
    // ── RENDER NEW FEATURES ──────────────────────────────────────
    renderNewFeatures(stats, installVersion, clientVersion, serverType, installCountry);

    initMap(stats);
  }



  // ── Skeleton Loader ──────────────────────────────────────────────
  function showSkeletons() {
    if (lastSuccess) return;

    const kpis = [
      'kpi-totalInstalls',
      'kpi-installVersions',
      'kpi-installCountries',
      'kpi-avgInstalls',
      'kpi-activeUsers',
      'kpi-afkUsers',
      'kpi-totalServers',
      'kpi-totalServersCreated',
      'kpi-totalServersDeleted',
      'kpi-uptime',
      'kpi-retention',
    ];

    kpis.forEach((id) => {
      const el = $(id);
      if (el) {
        el.innerHTML = '<div class="skeleton" style="height: 1.25em; width: 70%; display: inline-block;"></div>';
      }
    });

    const tables = [
      'tbl-installVersion',
      'tbl-installCountry',
      'tbl-clientVersion',
      'tbl-clientLocation',
      'tbl-serverType',
    ];

    tables.forEach((id) => {
      const el = $(id);
      if (el) {
        el.innerHTML = Array.from({ length: 3 }, () => `
          <tr>
            <td><div class="skeleton" style="height: 1.2em; width: 60%; display: inline-block;"></div></td>
            <td><div class="skeleton" style="height: 1.2em; width: 40%; display: inline-block;"></div></td>
            <td><div class="skeleton" style="height: 1.2em; width: 30%; display: inline-block;"></div></td>
          </tr>`
        ).join('');
      }
    });

    const mapBox = $('world-map');
    if (mapBox) {
      mapBox.innerHTML = '';
      mapBox.classList.add('skeleton');
    }
  }

  // ── Fetch loop ───────────────────────────────────────────────────
  let isFetching = false;

  async function fetchStats() {
    if (isFetching) return;
    isFetching = true;

    try {
      showSkeletons();
      const data = await fetchAggregatedStats();
      render(data);

      lastSuccess = new Date();
    } catch (err) {
      console.error('[telemetry] fetch failed', err);
      // Graceful degradation: we leave the existing UI untouched instead of mocking data
    } finally {
      isFetching = false;
    }
  }

  function triggerRefresh() {
    // Reset the auto-refresh interval whenever a manual refresh is triggered
    startAutoRefresh();
    fetchStats();
  }


  // ── Auto-refresh loop ──────────────────────────────────────
  function startAutoRefresh() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(fetchStats, REFRESH_INTERVAL * 1000);
  }

  // ── Boot ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    triggerRefresh();
    startAutoRefresh();
  });
})();