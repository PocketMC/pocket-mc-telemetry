/**
 * Pocket MC Telemetry Dashboard
 * Live anonymous usage analytics
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
    textPrimary: '#f5f5f5',
    textMuted: '#9ca3af',
    border: 'rgba(255, 255, 255, 0.10)',
    bgSurface: '#121212',
    bgTooltip: 'rgba(9, 9, 9, 0.98)',
    font: '"Inter", sans-serif',
    paletteGreen:  '#2dd4bf',
    paletteBlue:   '#60a5fa',
    palettePurple: '#a78bfa',
  };

  // Multi‑value palettes (cycled if more entries than palette length)

  const STATUS_COLORS = {
    online: '#22c55e',
    active: '#22c55e',
    starting: '#f59e0b',
    stopping: '#fb7185',
    offline: '#71717a',
    error: '#ef4444',
    installed: '#14b8a6',
    unknown: '#60a5fa',
  };

  function normalizeStatus(value, fallback = 'unknown') {
    return String(value || fallback).trim().toLowerCase().replace(/\s+/g, '-');
  }

  function statusColor(status) {
    return STATUS_COLORS[normalizeStatus(status)] || STATUS_COLORS.unknown;
  }

  function countryStatus(stats, country, count, installedOnly = false) {
    const statusSources = [
      stats.locationStatusDistribution,
      stats.userStateLocationDistribution,
      stats.statusLocationDistribution,
      stats.countryStatusDistribution,
    ];

    for (const source of statusSources) {
      const value = source?.[country];
      if (!value) continue;
      if (typeof value === 'string') return normalizeStatus(value);
      if (typeof value === 'object') {
        const [status] = Object.entries(value).sort((a, b) => Number(b[1]) - Number(a[1]))[0] || [];
        if (status) return normalizeStatus(status);
      }
    }

    if (installedOnly) return 'installed';
    return count > 0 ? 'online' : 'offline';
  }

  const palettes = {
    green:  ['#99f6e4','#5eead4','#2dd4bf','#14b8a6','#0f766e','#115e59'],
    blue:   ['#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8'],
    purple: ['#ddd6fe','#c4b5fd','#a78bfa','#8b5cf6','#7c3aed','#6d28d9'],
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
          grid: { color: 'rgba(148, 163, 184, 0.10)', drawBorder: false },
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
        ? palette[3] || palette[0]
        : getColorArr(palette, count),
      borderColor: 'rgba(255, 255, 255, 0.18)',
      borderWidth: 1,
      borderSkipped: false,
      hoverBackgroundColor: palette[1] || palette[0],
      borderRadius: small ? 8 : 10,
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
          status: countryStatus(stats, country, Number(count) || 0),
          style: { initial: { fill: statusColor(countryStatus(stats, country, Number(count) || 0)), stroke: '#090909' } }
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
            status: 'installed',
            style: { initial: { fill: statusColor('installed'), stroke: '#090909' } }
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
          fill: '#151515',
          stroke: '#252525',
          strokeWidth: 0.55,
          fillOpacity: 1
        },
        hover: {
          fill: '#242424',
          cursor: 'pointer'
        }
      },
      series: {
        regions: [{
          attribute: 'fill',
          scale: ['#12312e', '#0f766e', '#14b8a6', '#5eead4'],
          values: regionData
        }]
      },
      markers: markers,
      markerStyle: {
        initial: {
          fill: STATUS_COLORS.unknown,
          stroke: '#090909',
          strokeWidth: 1.25,
          r: 3.75
        },
        hover: {
          stroke: '#f5f5f5',
          strokeWidth: 1.5,
          r: 4.5
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
             <div style="color:#a1a1aa">State: <span style="color:${statusColor(marker.status)};font-weight:600">Installed</span></div>`,
            true
          );
        } else {
          tooltip.text(
            `<div style="font-weight:600;margin-bottom:2px;">${marker.name}</div>
             <div style="color:#a1a1aa">${escapeHtml(marker.status || 'online')}: <span style="color:${statusColor(marker.status)};font-weight:600">${fmt(marker.activeCount)}</span></div>`,
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
          showToast(marker.name, `${fmt(marker.activeCount)} ${escapeHtml(marker.status || 'online')} clients`, statusColor(marker.status));
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

    try {
      showSkeletons();
      const data = await fetchAggregatedStats();
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

  // ── Dashboard and chart tabs ─────────────────────────────────────
  function initDashboardTabs() {
    const tabs = [...document.querySelectorAll('.dashboard-tab')];
    if (!tabs.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-tab-target');
        tabs.forEach((item) => item.classList.remove('is-active'));
        tab.classList.add('is-active');

        tabs.forEach((item) => {
          const section = $(item.getAttribute('data-tab-target'));
          if (section) section.hidden = item.getAttribute('data-tab-target') !== targetId;
        });

        setTimeout(() => {
          Object.values(charts).forEach((chart) => chart?.resize());
          if (targetId === 'global-map-section' && worldMapInstance) {
            worldMapInstance.updateSize?.();
          }
        }, 50);
      });
    });
  }

  function initChartTabs() {
    const tabs = [...document.querySelectorAll('.chart-tab')];
    const boxes = [...document.querySelectorAll('[data-chart-group]')];
    if (!tabs.length || !boxes.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const filter = tab.getAttribute('data-chart-filter');
        tabs.forEach((item) => item.classList.remove('is-active'));
        tab.classList.add('is-active');

        boxes.forEach((box) => {
          const visible = filter === 'all' || box.getAttribute('data-chart-group') === filter;
          box.classList.toggle('is-hidden-by-tab', !visible);
        });

        setTimeout(() => Object.values(charts).forEach((chart) => chart?.resize()), 50);
      });
    });
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
    initDashboardTabs();
    initChartTabs();
    window.addEventListener('resize', handleResize);
  });
})();