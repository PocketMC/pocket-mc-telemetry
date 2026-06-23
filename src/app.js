/**
 * Pocket MC Telemetry Dashboard
 * Live anonymous usage analytics
 */
(function () {
  'use strict';

  const API_URL = 'https://pocket-mc-proxy.onrender.com/api/telemetry/stats';
  const REFRESH_INTERVAL = 30;

  // ── Theme Configuration ──────────────────────────────────────────
  const theme = {
    textPrimary: '#e4e4e7',
    textMuted: '#71717a',
    border: '#27272a',
    bgSurface: '#18181b',
    bgTooltip: '#09090b',
    font: '"Inter", sans-serif',
    paletteGreen:  '#22c55e',
    paletteBlue:   '#3b82f6',
    palettePurple: '#a855f7',
  };

  // Multi‑value palettes (cycled if more entries than palette length)
  const palettes = {
    green:  ['#22c55e','#16a34a','#15803d','#166534','#14532d','#052e16'],
    blue:   ['#3b82f6','#2563eb','#1d4ed8','#1e40af','#1e3a8a','#172554'],
    purple: ['#a855f7','#9333ea','#7e22ce','#6b21a8','#581c87','#3b0764'],
  };

  // ── Chart.js defaults ─────────────────────────────────────────────
  Chart.defaults.color = theme.textMuted;
  Chart.defaults.borderColor = theme.border;
  Chart.defaults.font.family = theme.font;

  // ── State ────────────────────────────────────────────────────────
  const charts = {};
  let worldMapInstance = null;


  let lastSuccess = null;
  let timerId = null;

  // ── Helpers ──────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
  const pct = (n, total) => (total ? ((n / total) * 100).toFixed(1) + '%' : '0%');

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

  // ── Chart helpers ────────────────────────────────────────────────
  function upsertChart(id, type, data, options) {
    if (charts[id]) {
      charts[id].data = data;
      charts[id].options = options;
      charts[id].update();
      return;
    }
    const ctx = $(id).getContext('2d');
    charts[id] = new Chart(ctx, { type, data, options });
  }

  function tooltipOpts() {
    return {
      backgroundColor: theme.bgTooltip,
      titleColor: theme.textPrimary,
      bodyColor: theme.textMuted,
      borderColor: theme.border,
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      displayColors: true,
      boxPadding: 4,
    };
  }

  /** Detect small screen (< 640px) for responsive chart tweaks */
  function isSmallScreen() {
    return window.innerWidth < 640;
  }

  function barHorizOpts() {
    const small = isSmallScreen();
    return {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipOpts() },
      scales: {
        x: {
          grid: { color: theme.border, drawBorder: false },
          ticks: {
            precision: 0,
            color: theme.textMuted,
            font: { size: small ? 9 : 11 },
            maxTicksLimit: 5,
            autoSkip: true,
          },
          border: { display: false },
          suggestedMax: undefined,
        },
        y: {
          grid: { display: false },
          ticks: {
            color: theme.textPrimary,
            font: { weight: 500, size: small ? 10 : 12 },
            maxTicksLimit: small ? 8 : 20,
            callback: small
              ? function (value, index, ticks) {
                  const label = this.getLabelForValue(value);
                  return label.length > 14 ? label.substring(0, 12) + '\u2026' : label;
                }
              : undefined,
          },
          border: { display: false },
        },
      },
      layout: { padding: { right: small ? 6 : 20 } },
    };
  }

  function getColorArr(palette, length) {
    return Array.from({ length }, (_, i) => palette[i % palette.length]);
  }

  function barDataset(data, palette, showSingleColor) {
    const count = data.length;
    const small = isSmallScreen();
    return {
      data: data.map(([, v]) => v),
      backgroundColor: showSingleColor
        ? palette[0]
        : getColorArr(palette, count),
      borderRadius: small ? 3 : 4,
      barThickness: small ? (count > 4 ? 10 : 14) : (count > 5 ? 14 : 18),
      categoryPercentage: small ? 0.7 : 0.8,
      barPercentage: small ? 0.55 : 0.6,
      maxBarThickness: small ? 16 : 28,
    };
  }

  // ── Global Activity Map ──────────────────────────────────────────
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
          style: { initial: { fill: '#3b82f6', stroke: '#60a5fa' } } // Blue
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
            style: { initial: { fill: '#22c55e', stroke: '#16a34a' } } // Green
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
      return;
    }

    // Initialize Map
    worldMapInstance = new jsVectorMap({
      selector: '#world-map',
      map: 'world',
      backgroundColor: 'transparent',
      zoomOnScroll: true,
      zoomButtons: true,
      draggable: true,
      bindTouchEvents: true,
      labels: {
        regions: {
          render(code) {
            // Only display labels for mapped countries to avoid cluttering small islands
            const entry = Object.entries(COUNTRY_MAP).find(([, val]) => val.iso === code);
            return entry ? entry[0] : null;
          }
        }
      },
      regionLabelStyle: {
        initial: {
          fontFamily: 'inherit',
          fontWeight: 500,
          fontSize: 10,
          fill: '#a1a1aa',
          cursor: 'default'
        }
      },
      onViewportChange: function(scale) {
        const mapBox = $('world-map');
        if (mapBox) {
          // Fade in labels when scaled past 2.0x zoom
          if (scale > 2.0) {
            mapBox.classList.add('map-zoomed-in');
          } else {
            mapBox.classList.remove('map-zoomed-in');
          }
        }
      },
      regionStyle: {
        initial: {
          fill: '#27272a', // Default empty region
          stroke: '#18181b',
          strokeWidth: 0.5,
          fillOpacity: 1
        },
        hover: {
          fill: '#3f3f46',
          cursor: 'pointer'
        }
      },
      series: {
        regions: [{
          attribute: 'fill',
          scale: ['#064e3b', '#10b981', '#f59e0b', '#ef4444'], // Dark Green -> Light Green -> Yellow -> Red
          values: regionData
        }]
      },
      markers: markers,
      markerStyle: {
        initial: {
          fill: '#3b82f6', // Blue for active users
          stroke: '#60a5fa',
          strokeWidth: 1.5,
          r: 5 // Dot radius
        },
        hover: {
          fill: '#60a5fa',
          stroke: '#93c5fd',
          r: 6
        }
      },
      onRegionTooltipShow(event, tooltip, code) {
        const installs = regionData[code] || 0;
        tooltip.text(
          `<div style="font-weight:600;margin-bottom:2px;">${tooltip.text()}</div>
           <div style="color:#a1a1aa">Installs: <span style="color:#22c55e;font-weight:600">${fmt(installs)}</span></div>`,
          true
        );
      },
      onMarkerTooltipShow(event, tooltip, index) {
        const marker = markers[index];
        if (marker.isInstalledOnly) {
          tooltip.text(
            `<div style="font-weight:600;margin-bottom:2px;">${marker.name}</div>
             <div style="color:#a1a1aa">Active: <span style="color:#22c55e;font-weight:600">0</span></div>`,
            true
          );
        } else {
          tooltip.text(
            `<div style="font-weight:600;margin-bottom:2px;">${marker.name}</div>
             <div style="color:#a1a1aa">Active: <span style="color:#3b82f6;font-weight:600">${fmt(marker.activeCount)}</span></div>`,
            true
          );
        }
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
          showToast(marker.name, 'No active players', '#22c55e');
        } else {
          showToast(marker.name, `${fmt(marker.activeCount)} Active Players`, '#3b82f6');
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

  // ── Update "Last updated" display ────────────────────────────────
  function updateLastUpdated() {
    const el = $('lastUpdated');
    if (lastSuccess) {
      el.textContent = lastSuccess.toLocaleTimeString();
    }
  }

  // ── Main render ──────────────────────────────────────────────────
  function render(stats) {
    // ── SECTION 1: INSTALLS ──────────────────────────────────────
    const installVersion = sortedEntries(stats.installVersionDistribution);
    const installCountry = sortedEntries(stats.installLocationDistribution);

    $('kpi-totalInstalls').textContent = fmt(stats.totalInstalls);
    $('kpi-installVersions').textContent = fmt(installVersion.length);
    $('kpi-installCountries').textContent = fmt(installCountry.length);

    upsertChart(
      'chart-installVersion',
      'bar',
      {
        labels: installVersion.map(([k]) => k),
        datasets: [barDataset(installVersion, palettes.green, false)],
      },
      barHorizOpts()
    );
    renderTable('tbl-installVersion', installVersion);

    upsertChart(
      'chart-installCountry',
      'bar',
      {
        labels: installCountry.map(([k]) => k),
        datasets: [barDataset(installCountry, palettes.green, true)],
      },
      barHorizOpts()
    );
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

    upsertChart(
      'chart-clientVersion',
      'bar',
      {
        labels: clientVersion.map(([k]) => k),
        datasets: [barDataset(clientVersion, palettes.blue, false)],
      },
      barHorizOpts()
    );

    upsertChart(
      'chart-clientLocation',
      'bar',
      {
        labels: clientLocation.map(([k]) => k),
        datasets: [barDataset(clientLocation, palettes.blue, true)],
      },
      barHorizOpts()
    );

    renderTable('tbl-clientVersion', clientVersion);
    renderTable('tbl-clientLocation', clientLocation);

    // ── SECTION 3: SERVERS ───────────────────────────────────────
    const uptime = Number(stats.globalUptimeHours) || 0;
    $('kpi-uptime').textContent =
      uptime.toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'h';
    $('kpi-running').textContent = fmt(stats.totalRunningServers);
    $('kpi-created').textContent = fmt(stats.totalServersCreated);
    $('kpi-deleted').textContent = fmt(stats.totalServersDeleted);

    const serverType = sortedEntries(stats.serverTypeDistribution);

    upsertChart(
      'chart-serverType',
      'bar',
      {
        labels: serverType.map(([k]) => k),
        datasets: [barDataset(serverType, palettes.purple, false)],
      },
      barHorizOpts()
    );
    renderTable('tbl-serverType', serverType);

    initMap(stats);
  }



  // ── Skeleton Loader ──────────────────────────────────────────────
  function showSkeletons() {
    if (lastSuccess) return;

    const kpis = [
      'kpi-totalInstalls',
      'kpi-installVersions',
      'kpi-installCountries',
      'kpi-openClients',
      'kpi-activeUsers',
      'kpi-afkUsers',
      'kpi-uptime',
      'kpi-running',
      'kpi-created',
      'kpi-deleted',
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

    const btnIcon = $('refreshBtn')?.querySelector('svg');
    if (btnIcon) btnIcon.classList.add('btn-spin');
    
    // Add abort controller to prevent indefinitely hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      showSkeletons();
      const res = await fetch(API_URL, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      render(data);

      lastSuccess = new Date();
      updateLastUpdated();
      $('errLast').textContent = lastSuccess.toLocaleTimeString();
      $('errorPanel').classList.add('hidden');
    } catch (err) {
      console.error('[telemetry] fetch failed', err);
      $('errorPanel').classList.remove('hidden');
      $('errLast').textContent = lastSuccess
        ? lastSuccess.toLocaleTimeString()
        : 'never';
      // Graceful degradation: we leave the existing UI untouched instead of mocking data
    } finally {
      isFetching = false;
      if (btnIcon) btnIcon.classList.remove('btn-spin');
    }
  }

  function triggerRefresh() {
    // Reset the auto-refresh interval whenever a manual refresh is triggered
    startAutoRefresh();
    fetchStats();
  }

  // ── Collapse toggle ──────────────────────────────────────────────
  function initCollapseToggles() {
    document.querySelectorAll('.collapse-toggle').forEach(btn => {
      btn.addEventListener('click', function () {
        const targetId = this.getAttribute('data-target');
        const body = document.getElementById(targetId);
        if (!body) return;

        const isOpen = this.getAttribute('aria-expanded') === 'true';

        if (isOpen) {
          body.classList.add('collapsed');
          this.setAttribute('aria-expanded', 'false');
          this.querySelector('.collapse-toggle-text').textContent = 'Show charts';
        } else {
          body.classList.remove('collapsed');
          this.setAttribute('aria-expanded', 'true');
          this.querySelector('.collapse-toggle-text').textContent = 'Hide charts';

          const canvases = body.querySelectorAll('canvas');
          canvases.forEach(canvas => {
            const chartId = canvas.id;
            if (charts[chartId]) {
              setTimeout(() => charts[chartId].resize(), 50);
            }
          });
        }
      });
    });
  }

  // ── Resize handler ───────────────────────────────────────────────
  let resizeTimer = null;
  function handleResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      Object.values(charts).forEach(chart => {
        if (chart) chart.resize();
      });
    }, 200);
  }

  // ── Auto-refresh loop ──────────────────────────────────────
  function startAutoRefresh() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(fetchStats, REFRESH_INTERVAL * 1000);
  }

  // ── Boot ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    $('refreshBtn').addEventListener('click', triggerRefresh);
    $('retryBtn').addEventListener('click', triggerRefresh);
    triggerRefresh();
    startAutoRefresh();
    initCollapseToggles();
    window.addEventListener('resize', handleResize);
  });
})();