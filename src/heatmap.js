/**
 * Pocket MC Fullscreen Heatmap
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
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());

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
    const markers = [];

    // Region Data: Install Locations (Choropleth)
    for (const [country, count] of Object.entries(stats.installLocationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      if (match) regionData[match.iso] = Number(count) || 0;
    }

    // Marker Data: Active Client Locations
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

    // Marker Data: Ever Installed Locations
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
                fill: '#ffffff', // White
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
      if (worldMapInstance.series.regions[0]) {
        worldMapInstance.series.regions[0].setValues(regionData);
      }
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

  // ── Boot ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    startAutoRefresh();
  });
})();
