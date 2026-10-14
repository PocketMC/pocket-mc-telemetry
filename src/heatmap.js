/**
 * PocketMC Fullscreen Heatmap
 * Smooth, glowing aesthetic for live telemetry
 */
(function () {
  'use strict';

  const TELEMETRY_PROXIES = [
    "https://pocket-mc-proxy.onrender.com/api/telemetry/stats",
    "https://pocket-mc-proxy-3fqm.onrender.com/api/telemetry/stats",
    "",
  ];
  const REFRESH_INTERVAL = 30;

  const GLOBAL_METRIC_DEFAULTS = {
    installLocationDistribution: {},
  };

  let worldMapInstance = null;
  let timerId = null;

  // ── Helpers ──────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n == null ? '-' : Number(n).toLocaleString());
  const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c] || c));

  function getCountryIso(name) {
    if (!name) return '';
    const cleanName = String(name).trim();
    if (typeof COUNTRY_MAP !== 'undefined') {
      const entry = COUNTRY_MAP[cleanName];
      if (entry && entry.iso) return entry.iso.toLowerCase();
    }
    if (/^[A-Za-z]{2}$/.test(cleanName)) {
      return cleanName.toLowerCase();
    }
    return '';
  }

  function renderCountryFlag(name) {
    const iso = getCountryIso(name);
    if (!iso) return '';
    return `<img class="country-flag-img" src="https://flagcdn.com/20x15/${iso}.png" srcset="https://flagcdn.com/40x30/${iso}.png 2x" width="20" height="15" alt="${escapeHtml(name)} flag" loading="lazy" onerror="this.remove()" style="display:inline-block;vertical-align:middle;border-radius:2px;" />`;
  }

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

    const aggregated = {
      ...GLOBAL_METRIC_DEFAULTS,
      locationDistribution: {},
      installLocationDistribution: {}
    };

    responses.forEach((response) => {
      addDistribution(aggregated.locationDistribution, response.locationDistribution);
      addDistribution(aggregated.installLocationDistribution, response.installLocationDistribution);
    });

    return aggregated;
  }

  async function fetchProxyStats(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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
    if (!proxyUrls.length) throw new Error('No proxy URLs configured');

    const proxyResults = await Promise.allSettled(proxyUrls.map(fetchProxyStats));
    return aggregateTelemetry(proxyResults, proxyUrls.length);
  }

  // ── Global Activity Map ──────────────────────────────────────────
  function initMap(stats) {
    const mapBox = $('world-map');
    if (!mapBox) return;

    const regionData = {};
    const activeByIso = {};
    const isoToName = {};

    // Build reverse ISO lookup table
    if (typeof COUNTRY_MAP !== 'undefined') {
      for (const [country, info] of Object.entries(COUNTRY_MAP)) {
        if (info && info.iso && !isoToName[info.iso]) {
          isoToName[info.iso] = country;
        }
      }
    }

    // Aggregate install count by ISO code
    for (const [country, count] of Object.entries(stats.installLocationDistribution || {})) {
      if (typeof COUNTRY_MAP !== 'undefined') {
        const match = COUNTRY_MAP[country];
        if (match && match.iso) {
          regionData[match.iso] = (regionData[match.iso] || 0) + (Number(count) || 0);
        }
      }
    }

    // Aggregate active users by ISO code
    for (const [country, count] of Object.entries(stats.locationDistribution || {})) {
      if (typeof COUNTRY_MAP !== 'undefined') {
        const match = COUNTRY_MAP[country];
        if (match && match.iso) {
          activeByIso[match.iso] = (activeByIso[match.iso] || 0) + (Number(count) || 0);
        }
      }
    }

    const markers = [];
    const plottedIsos = new Set();

    // 1. Live Active Markers (Blue/Cyan) : Countries with real-time active users
    for (const [country, count] of Object.entries(stats.locationDistribution || {})) {
      if (typeof COUNTRY_MAP !== 'undefined') {
        const match = COUNTRY_MAP[country];
        if (match && match.iso && match.coords && !plottedIsos.has(match.iso)) {
          plottedIsos.add(match.iso);
          const totalActive = activeByIso[match.iso] || Number(count) || 0;
          markers.push({
            name: country,
            iso: match.iso,
            coords: match.coords,
            activeCount: totalActive,
            isLive: true,
            style: { 
              initial: { 
                fill: '#38bdf8',
                stroke: '#ffffff',
                strokeWidth: 1.5,
                r: 4.5
              },
              hover: {
                fill: '#7dd3fc',
                stroke: '#ffffff',
                strokeWidth: 2,
                r: 6
              }
            }
          });
        }
      }
    }

    // 2. Registered Install Markers (Emerald/Green) : Countries with installs but currently offline
    for (const [country, count] of Object.entries(stats.installLocationDistribution || {})) {
      if (typeof COUNTRY_MAP !== 'undefined') {
        const match = COUNTRY_MAP[country];
        if (match && match.iso && match.coords && !plottedIsos.has(match.iso)) {
          plottedIsos.add(match.iso);
          markers.push({
            name: country,
            iso: match.iso,
            coords: match.coords,
            isInstalledOnly: true,
            style: { 
              initial: { 
                fill: '#22c55e',
                stroke: '#141414',
                strokeWidth: 1,
                r: 3.5
              },
              hover: {
                fill: '#4ade80',
                stroke: '#ffffff',
                strokeWidth: 1.5,
                r: 5
              }
            }
          });
        }
      }
    }

    if (worldMapInstance) {
      worldMapInstance.removeMarkers();
      worldMapInstance.addMarkers(markers);
      return;
    }

    // Initialize Map
    worldMapInstance = new jsVectorMap({
      selector: '#world-map',
      map: 'world',
      backgroundColor: 'transparent',
      zoomOnScroll: true,
      zoomButtons: false,
      draggable: true,
      bindTouchEvents: true,

      regionLabelStyle: {
        initial: {
          fontFamily: 'inherit',
          fontWeight: 500,
          fontSize: 10,
          fill: '#64748b',
          cursor: 'default'
        }
      },
      onViewportChange: function(scale) {
        if (scale > 2.0) {
          mapBox.classList.add('map-zoomed-in');
        } else {
          mapBox.classList.remove('map-zoomed-in');
        }
      },
      regionStyle: {
        initial: {
          fill: '#18181b',
          stroke: '#27272a',
          strokeWidth: 0.5,
          fillOpacity: 1
        },
        hover: {
          fill: '#27272a',
          cursor: 'pointer'
        }
      },

      markers: markers,
      markerStyle: {
        initial: {
          fill: '#38bdf8',
          stroke: '#ffffff',
          strokeWidth: 1.5,
          r: 4
        },
        hover: {
          fill: '#7dd3fc',
          r: 5.5,
          cursor: 'pointer'
        }
      },
      onRegionTooltipShow(event, tooltip, code) {
        const countryName = isoToName[code] || tooltip.text() || code;
        const installs = regionData[code] || (stats.installLocationDistribution || {})[countryName] || 0;
        const activeCount = activeByIso[code] || (stats.locationDistribution || {})[countryName] || 0;
        const flagHtml = renderCountryFlag(countryName);
        tooltip.text(
          `<div style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:4px;">
            ${flagHtml} <span>${escapeHtml(countryName)}</span>
           </div>
           <div style="font-size:12px;color:#94a3b8;">Active Users: <strong style="color:#38bdf8;">${fmt(activeCount)}</strong></div>
           <div style="font-size:12px;color:#94a3b8;">Total Installs: <strong style="color:#22c55e;">${fmt(installs)}</strong></div>`,
          true
        );
      },
      onMarkerTooltipShow(event, tooltip, index) {
        const marker = markers[index];
        if (!marker) return;
        const countryName = marker.name;
        const iso = marker.iso;
        const installs = (iso && regionData[iso]) || (stats.installLocationDistribution || {})[countryName] || 0;
        const activeCount = (iso && activeByIso[iso]) || (stats.locationDistribution || {})[countryName] || marker.activeCount || 0;
        const flagHtml = renderCountryFlag(countryName);

        tooltip.text(
          `<div style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:4px;">
            ${flagHtml} <span>${escapeHtml(countryName)}</span>
           </div>
           <div style="font-size:12px;color:#94a3b8;">Active Users: <strong style="color:#38bdf8;">${fmt(activeCount)}</strong></div>
           <div style="font-size:12px;color:#94a3b8;">Total Installs: <strong style="color:#22c55e;">${fmt(installs)}</strong></div>`,
          true
        );
      },
    });
  }

  // ── Fetch loop ───────────────────────────────────────────────────
  let isFetching = false;

  async function fetchStats() {
    if (isFetching) return;
    isFetching = true;

    try {
      const data = await fetchAggregatedStats();
      initMap(data);
    } catch (err) {
      console.error('[telemetry] fetch failed', err);
    } finally {
      isFetching = false;
    }
  }

  // ── Auto-refresh loop ──────────────────────────────────────
  function startAutoRefresh() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(fetchStats, REFRESH_INTERVAL * 1000);
  }

  // ── Window Resize ────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    if (worldMapInstance && typeof worldMapInstance.updateSize === 'function') {
      worldMapInstance.updateSize();
    }
  });

  // ── Boot ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    startAutoRefresh();
  });
})();
