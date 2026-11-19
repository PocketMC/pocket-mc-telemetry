/**
 * PocketMC Telemetry Dashboard
 * Live anonymous usage analytics with Glisse Liquid Glass Design System
 * Supports Light & Dark themes, Real Server Flavor Logos, Country Flags, and Interactive Global Map
 */
(function () {
  'use strict';

  const TELEMETRY_PROXIES = [
    "https://pocket-mc-proxy.onrender.com/api/telemetry/stats"
  ];
  const DISCORD_BOT_KEEP_ALIVE_URL = "https://pocketmc-welcome-bot-1e5d.onrender.com/health";
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

  // ── State ────────────────────────────────────────────────────────
  let worldMapInstance = null;
  let lastSuccess = null;
  let timerId = null;
  let lastStats = null;
  let currentTimePeriod = '7d'; // '7d', '24h', '30d', 'total'
  let autoRefreshEnabled = localStorage.getItem('pmc-autorefresh') !== 'false';

  const breakdownData = {
    installVersion: [],
    installCountry: [],
    clientVersion: [],
    clientLocation: [],
  };

  const searchQueries = {
    installVersion: '',
    installCountry: '',
    clientVersion: '',
    clientLocation: '',
  };

  // ── Helpers ──────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n == null ? '-' : Number(n).toLocaleString());
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
      .map((result) => result.value)
      .filter((val) => val && (val.totalInstalls !== undefined || val.openClients !== undefined));

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

    // Pick windowed activity metrics from any updated proxy
    ['activeUsers7d', 'inactiveUsers7d', 'activeUsers30d', 'activeUsers24h'].forEach((field) => {
      const val = responses.map((r) => r[field]).find((v) => v !== undefined && v !== null);
      if (val !== undefined && val !== null) {
        aggregated[field] = val;
      }
    });

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
    const timeoutId = setTimeout(() => controller.abort(), 20000);

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
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // ── Country Flag Helper ──────────────────────────────────────────
  function getCountryIso(name) {
    if (!name) return null;
    if (typeof COUNTRY_MAP !== 'undefined') {
      if (COUNTRY_MAP[name] && COUNTRY_MAP[name].iso) {
        return COUNTRY_MAP[name].iso.toLowerCase();
      }
      const lower = name.toLowerCase();
      const found = Object.entries(COUNTRY_MAP).find(([k]) => k.toLowerCase() === lower);
      if (found && found[1].iso) return found[1].iso.toLowerCase();
    }
    if (name.length === 2) return name.toLowerCase();
    return null;
  }

  function renderCountryFlag(countryName) {
    const iso = getCountryIso(countryName);
    if (!iso) {
      return `<span class="flag-icon" style="background:#64748b;display:inline-block;"></span>`;
    }
    return `<img class="flag-icon" src="https://flagcdn.com/20x15/${iso}.png" srcset="https://flagcdn.com/40x30/${iso}.png 2x" alt="${escapeHtml(countryName)} flag" width="18" height="13" loading="lazy" />`;
  }

  // ── Render Breakdown List with Live Search ────────────────────────
  function renderBreakdownList(containerId, dataKey, isCountry = false) {
    const container = $(containerId);
    if (!container) return;

    const rawEntries = breakdownData[dataKey] || [];
    const query = (searchQueries[dataKey] || '').trim().toLowerCase();
    const entries = query
      ? rawEntries.filter(([k]) => k.toLowerCase().includes(query))
      : rawEntries;

    if (!entries.length) {
      container.innerHTML = `<div class="breakdown-row" style="color:var(--text-secondary);font-size:12px;padding:12px;">${query ? 'No matching results found' : 'No telemetry data recorded'}</div>`;
      return;
    }

    const total = rawEntries.reduce((s, [, v]) => s + v, 0);
    const maxVal = rawEntries[0] ? rawEntries[0][1] : 1;

    container.innerHTML = entries
      .map(([k, v]) => {
        const sharePct = total ? ((v / total) * 100).toFixed(1) : '0.0';
        const barFillPct = Math.min(100, Math.max(4, (v / maxVal) * 100)).toFixed(1);
        const labelHtml = isCountry
          ? `<div class="breakdown-label">${renderCountryFlag(k)}<span title="${escapeHtml(k)}">${escapeHtml(k)}</span></div>`
          : `<div class="breakdown-label"><span title="${escapeHtml(k)}">${escapeHtml(k)}</span></div>`;

        return `
          <div class="breakdown-row">
            ${labelHtml}
            <div class="breakdown-track" aria-hidden="true">
              <div class="breakdown-fill" style="width: ${barFillPct}%;"></div>
            </div>
            <div class="breakdown-value">${fmt(v)}</div>
            <div class="badge-glass" style="font-size:10.5px;color:var(--text-secondary);">${sharePct}%</div>
          </div>
        `;
      })
      .join('');
  }

  // ── Render Server Types with Real Official Logos ─────────────────
  function getServerTypeLogoHtml(type) {
    const t = (type || '').toLowerCase();
    let src = '';
    let alt = type;

    if (t.includes('paper')) {
      src = 'src/flavors/paper.svg';
    } else if (t.includes('fabric')) {
      src = 'src/flavors/fabric.png';
    } else if (t.includes('neoforge') || t.includes('neo')) {
      src = 'src/flavors/neoforge.png';
    } else if (t.includes('forge')) {
      src = 'src/flavors/forge.png';
    } else if (t.includes('spigot')) {
      src = 'src/flavors/spigot.svg';
    } else if (t.includes('purpur')) {
      src = 'src/flavors/purpur.svg';
    } else if (t.includes('bedrock') || t.includes('bds')) {
      src = 'src/flavors/bedrock.png';
    } else if (t.includes('vanilla')) {
      src = 'src/flavors/vanilla.png';
    }

    if (src) {
      return `<img class="server-logo" src="${src}" alt="${escapeHtml(alt)} logo" width="24" height="24" loading="lazy" />`;
    }

    return `<svg class="server-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;
  }

  function renderServerTypes(containerId, entries) {
    const container = $(containerId);
    if (!container) return;

    if (!entries.length) {
      container.innerHTML = `<div class="server-type-row" style="color:var(--text-secondary);font-size:12px;">No server type telemetry recorded</div>`;
      return;
    }

    const total = entries.reduce((s, [, v]) => s + v, 0);
    const maxVal = entries[0][1] || 1;

    container.innerHTML = entries.map(([type, count]) => {
      const sharePct = total ? ((count / total) * 100).toFixed(1) : '0.0';
      const barFillPct = Math.min(100, Math.max(6, (count / maxVal) * 100)).toFixed(1);

      return `
        <div class="server-type-row">
          <div class="server-type-brand">
            ${getServerTypeLogoHtml(type)}
            <span class="server-type-name">${escapeHtml(type)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:14px;flex:1;max-width:260px;margin-left:auto;">
            <div class="breakdown-track" style="flex:1;" aria-hidden="true">
              <div class="breakdown-fill" style="width: ${barFillPct}%; background-color: var(--accent-purple);"></div>
            </div>
            <div class="server-type-count">${fmt(count)}</div>
            <div class="badge-glass" style="color:var(--accent-purple);font-size:11px;">${sharePct}%</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Auto-Insights ────────────────────────────────────────────────
  function renderInsights(stats, clientVersion, serverType, installCountry) {
    const insightInstalls = $('insight-installs');
    const insightClients = $('insight-clients');
    const insightServers = $('insight-servers');

    const topServer = serverType.length ? serverType[0] : null;
    const topLoc = installCountry.length ? installCountry[0] : null;
    const topVer = clientVersion.length ? clientVersion[0] : null;

    if (insightServers && topServer) {
      insightServers.innerHTML = `<strong style="color:var(--accent-purple);">${escapeHtml(topServer[0])}</strong> leads as the most popular server engine.`;
    }

    if (insightInstalls) {
      const totalInstalls = Number(stats.totalInstalls) || 0;
      const open = Number(stats.openClients) || 0;
      const hasActive7d = stats.activeUsers7d !== undefined && stats.activeUsers7d !== null;
      const active7d = hasActive7d ? Math.max(Number(stats.activeUsers7d), open) : open;

      if (currentTimePeriod === '24h') {
        const a24 = Number(stats.activeUsers24h) || open;
        insightInstalls.innerHTML = `<strong style="color:var(--accent-blue);">${pct(a24, totalInstalls)}</strong> (${fmt(a24)}) active in the last 24 hours.`;
      } else if (currentTimePeriod === '30d') {
        const a30 = Number(stats.activeUsers30d) || active7d;
        insightInstalls.innerHTML = `<strong style="color:var(--accent-blue);">${pct(a30, totalInstalls)}</strong> (${fmt(a30)}) active in the last 30 days.`;
      } else if (totalInstalls > 0 && active7d > 0) {
        insightInstalls.innerHTML = `<strong style="color:var(--accent-blue);">${pct(active7d, totalInstalls)}</strong> (${fmt(active7d)}) active in the last 7 days.`;
      } else if (topLoc) {
        insightInstalls.innerHTML = `<strong style="color:var(--accent-blue);">${escapeHtml(topLoc[0])}</strong> leads globally in installations.`;
      }
    }

    if (insightClients && topVer) {
      const totalClients = clientVersion.reduce((s, [, v]) => s + v, 0);
      insightClients.innerHTML = `<strong style="color:var(--accent-green);">v${escapeHtml(topVer[0])}</strong> represents ${pct(topVer[1], totalClients)} of all live servers.`;
    }

    const densityEl = $('kpi-serverDensity');
    if (densityEl) {
      const users = Number(stats.activeUsers) || 0;
      const servers = Number(stats.totalRunningServers) || 0;
      const density = servers > 0 ? (users / servers).toFixed(1) : '0.0';
      densityEl.textContent = density;
    }
  }

  // ── Global Activity Map ──────────────────────────────────────────
  function initMap(stats) {
    const mapBox = $('world-map');
    if (!mapBox) return;
    mapBox.classList.remove('skeleton');

    if (typeof jsVectorMap === 'undefined') {
      mapBox.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:13px;">Map loading...</div>';
      return;
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const regionData = {};
    const activeByIso = {};
    const isoToName = {};

    for (const [country, count] of Object.entries(stats.installLocationDistribution || {})) {
      if (typeof COUNTRY_MAP !== 'undefined') {
        const match = COUNTRY_MAP[country];
        if (match && match.iso) {
          isoToName[match.iso] = country;
          regionData[match.iso] = (regionData[match.iso] || 0) + (Number(count) || 0);
        }
      }
    }

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

    // 1. Live Active Markers (Cyan/Blue)
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
                fill: isDark ? '#38bdf8' : '#0088ff',
                stroke: '#ffffff',
                strokeWidth: 1.5,
                r: 4.5
              },
              hover: {
                fill: isDark ? '#7dd3fc' : '#0077e6',
                stroke: '#ffffff',
                strokeWidth: 2,
                r: 6
              }
            }
          });
        }
      }
    }

    // 2. Registered Install Markers (Emerald/Green)
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
                fill: isDark ? '#30d158' : '#34c759',
                stroke: isDark ? '#141414' : '#ffffff',
                strokeWidth: 1,
                r: 3.5
              },
              hover: {
                fill: isDark ? '#4ade80' : '#15803d',
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

    mapBox.innerHTML = '';

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
          fill: isDark ? '#1a1d26' : '#e2e8f0',
          stroke: isDark ? '#262a38' : '#cbd5e1',
          strokeWidth: 0.5,
          fillOpacity: 1
        },
        hover: {
          fill: isDark ? '#292e3d' : '#cbd5e1',
          cursor: 'pointer'
        }
      },

      markers: markers,
      markerStyle: {
        initial: {
          fill: isDark ? '#38bdf8' : '#0088ff',
          stroke: '#ffffff',
          strokeWidth: 1.5,
          r: 4
        },
        hover: {
          stroke: '#ffffff',
          strokeWidth: 2,
          r: 6
        }
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
          `<div style="display:flex;align-items:center;gap:7px;font-weight:600;margin-bottom:4px;">
            ${flagHtml} <span>${escapeHtml(countryName)}</span>
           </div>
           <div style="font-size:12px;color:var(--text-secondary);">
             Active Users: <strong style="color:var(--accent-blue);">${fmt(activeCount)}</strong>
           </div>
           <div style="font-size:12px;color:var(--text-secondary);">
             Total Installs: <strong style="color:var(--accent-green);">${fmt(installs)}</strong>
           </div>`,
          true
        );
      },
    });
  }

  // ── Dynamic Timeframe Metric Switching ────────────────────────────
  function updateTimeframeKPI() {
    if (!lastStats) return;

    const totalInstalls = Number(lastStats.totalInstalls) || 0;
    const open = Number(lastStats.openClients) || 0;
    const hasActive7d = lastStats.activeUsers7d !== undefined && lastStats.activeUsers7d !== null;
    const active7d = hasActive7d ? Math.max(Number(lastStats.activeUsers7d), open) : open;

    const valEl = $('kpi-activeUsers7d');
    const labelEl = $('kpi-activeLabel');
    const tooltipEl = $('kpi-activeTooltip');

    let count = active7d;
    let label = 'Active Users (7D)';
    let tooltip = 'Active in last 7 days';

    if (currentTimePeriod === '24h') {
      count = Number(lastStats.activeUsers24h) || open;
      label = 'Active Users (24H)';
      tooltip = 'Active in last 24 hours';
    } else if (currentTimePeriod === '30d') {
      count = Number(lastStats.activeUsers30d) || active7d;
      label = 'Active Users (30D)';
      tooltip = 'Active in last 30 days';
    } else if (currentTimePeriod === 'total') {
      count = totalInstalls;
      label = 'Lifetime Installs';
      tooltip = 'Cumulative lifetime registered installations';
    }

    if (valEl) valEl.textContent = fmt(count);
    if (labelEl) labelEl.textContent = label;
    if (tooltipEl) tooltipEl.textContent = tooltip;

    renderInsights(
      lastStats,
      breakdownData.clientVersion,
      sortedEntries(lastStats.serverTypeDistribution),
      breakdownData.installCountry
    );
  }

  function setupTimeFilterSegmentedControl() {
    const segmented = $('timeFilterControl');
    if (!segmented) return;

    segmented.addEventListener('click', (e) => {
      const tab = e.target.closest('.lg-tab');
      if (!tab) return;

      const period = tab.dataset.period;
      if (!period || period === currentTimePeriod) return;

      segmented.querySelectorAll('.lg-tab').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-checked', 'false');
      });

      tab.classList.add('active');
      tab.setAttribute('aria-checked', 'true');
      currentTimePeriod = period;

      updateTimeframeKPI();
    });
  }

  // ── Auto-Refresh Glisse Switch ────────────────────────────────────
  function updateAutoRefreshSwitchUI() {
    const sw = $('autoRefreshSwitch');
    if (!sw) return;
    sw.setAttribute('aria-checked', String(autoRefreshEnabled));
  }

  function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    localStorage.setItem('pmc-autorefresh', String(autoRefreshEnabled));
    updateAutoRefreshSwitchUI();

    if (autoRefreshEnabled) {
      startAutoRefresh();
      updateStatusCaption();
    } else {
      if (timerId) clearInterval(timerId);
      timerId = null;
      const caption = $('statusCaption');
      if (caption) caption.textContent = 'Auto-refresh paused';
    }
  }

  function setupAutoRefreshSwitch() {
    const sw = $('autoRefreshSwitch');
    if (sw) {
      updateAutoRefreshSwitchUI();
      sw.addEventListener('click', toggleAutoRefresh);
    }
  }

  // ── Real-Time Breakdown Search Setup ─────────────────────────────
  function setupSearchInputs() {
    const configs = [
      { inputId: 'searchInstallVersion', dataKey: 'installVersion', containerId: 'tbl-installVersion', isCountry: false },
      { inputId: 'searchInstallCountry', dataKey: 'installCountry', containerId: 'tbl-installCountry', isCountry: true },
      { inputId: 'searchClientVersion', dataKey: 'clientVersion', containerId: 'tbl-clientVersion', isCountry: false },
      { inputId: 'searchClientLocation', dataKey: 'clientLocation', containerId: 'tbl-clientLocation', isCountry: true },
    ];

    configs.forEach(({ inputId, dataKey, containerId, isCountry }) => {
      const input = $(inputId);
      if (!input) return;

      input.addEventListener('input', (e) => {
        searchQueries[dataKey] = e.target.value;
        renderBreakdownList(containerId, dataKey, isCountry);
      });
    });
  }

  // ── Tab Bar Navigation & Scroll-Spy ──────────────────────────────
  function setupTabBarNavigation() {
    const tabBar = $('sectionTabBar');
    if (!tabBar) return;

    // Smooth scroll on tab click
    tabBar.addEventListener('click', (e) => {
      const tab = e.target.closest('.lg-tab');
      if (!tab) return;
      e.preventDefault();

      const targetId = tab.dataset.tab;
      const targetEl = $(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // Scroll-Spy to highlight current section
    const sections = ['section-installs', 'section-clients', 'section-servers', 'section-map']
      .map((id) => $(id))
      .filter(Boolean);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          tabBar.querySelectorAll('.lg-tab').forEach((tab) => {
            const isActive = tab.dataset.tab === id;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
          });
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });

    sections.forEach((sec) => observer.observe(sec));
  }

  // ── Main Render Routine ──────────────────────────────────────────
  function render(stats) {
    lastStats = stats;

    // Store breakdown entries for searchable rendering
    breakdownData.installVersion = sortedEntries(stats.installVersionDistribution);
    breakdownData.installCountry = sortedEntries(stats.installLocationDistribution);
    breakdownData.clientVersion = sortedEntries(stats.versionDistribution);
    breakdownData.clientLocation = sortedEntries(stats.locationDistribution);

    // SECTION 1: INSTALLS & USER BASE
    const totalInstalls = Number(stats.totalInstalls) || 0;
    const open = Number(stats.openClients) || 0;
    const hasActive7d = stats.activeUsers7d !== undefined && stats.activeUsers7d !== null;
    const active7d = hasActive7d ? Math.max(Number(stats.activeUsers7d), open) : open;
    const inactive7d = hasActive7d && stats.inactiveUsers7d !== undefined
      ? Number(stats.inactiveUsers7d)
      : Math.max(0, totalInstalls - active7d);
    const countriesReached = breakdownData.installCountry.length;
    const avgInstalls = countriesReached > 0 ? (totalInstalls / countriesReached).toFixed(1) : '0.0';

    $('kpi-totalInstalls').textContent = fmt(totalInstalls);
    $('kpi-inactiveUsers7d').textContent = fmt(inactive7d);
    $('kpi-installVersions').textContent = fmt(breakdownData.installVersion.length);
    $('kpi-installCountries').textContent = fmt(countriesReached);
    $('kpi-avgInstalls').textContent = avgInstalls;

    updateTimeframeKPI();

    renderBreakdownList('tbl-installVersion', 'installVersion', false);
    renderBreakdownList('tbl-installCountry', 'installCountry', true);

    // SECTION 2: CLIENTS
    const activeClients = Number(stats.activeUsers) || 0;
    const afkClients = Math.max(0, open - activeClients);
    const activeCountries = breakdownData.clientLocation.length;

    $('kpi-openClients').textContent = fmt(open);
    $('kpi-activeUsers').textContent = fmt(activeClients);
    $('kpi-afkUsers').textContent = fmt(afkClients);
    $('kpi-activeCountries').textContent = fmt(activeCountries);

    renderBreakdownList('tbl-clientVersion', 'clientVersion', false);
    renderBreakdownList('tbl-clientLocation', 'clientLocation', true);

    // SECTION 3: SERVERS
    const totalServers = Number(stats.totalRunningServers) || 0;
    const totalUptime = Number(stats.globalUptimeHours) || 0;
    const serversCreated = Number(stats.totalServersCreated) || 0;
    const serversDeleted = Number(stats.totalServersDeleted) || 0;
    const serverTypes = sortedEntries(stats.serverTypeDistribution);

    $('kpi-totalServers').textContent = fmt(totalServers);
    $('kpi-uptime').textContent = totalUptime > 0 ? `${fmt(totalUptime)}h` : '-';
    $('kpi-totalServersCreated').textContent = fmt(serversCreated);
    $('kpi-totalServersDeleted').textContent = fmt(serversDeleted);

    renderServerTypes('tbl-serverType', serverTypes);

    // SECTION 4: MAP & INSIGHTS
    initMap(stats);
    renderInsights(stats, breakdownData.clientVersion, serverTypes, breakdownData.installCountry);
  }

  // ── Skeletons ────────────────────────────────────────────────────
  function showSkeletons() {
    if (lastStats) return;

    ['kpi-totalInstalls', 'kpi-activeUsers7d', 'kpi-inactiveUsers7d', 'kpi-installCountries', 'kpi-installVersions', 'kpi-avgInstalls',
     'kpi-openClients', 'kpi-activeUsers', 'kpi-afkUsers', 'kpi-activeCountries',
     'kpi-totalServers', 'kpi-uptime', 'kpi-serverDensity', 'kpi-totalServersCreated', 'kpi-totalServersDeleted']
      .forEach((id) => {
        const el = $(id);
        if (el) el.innerHTML = '<span class="skeleton" style="display:inline-block;width:55px;height:24px;"></span>';
      });

    ['tbl-installVersion', 'tbl-installCountry', 'tbl-clientVersion', 'tbl-clientLocation', 'tbl-serverType'].forEach((id) => {
      const el = $(id);
      if (el) {
        el.innerHTML = Array.from({ length: 4 }, () => `
          <div class="breakdown-row" style="opacity:0.6;">
            <div class="skeleton" style="width:110px;height:14px;"></div>
            <div class="skeleton" style="flex:1;height:7px;"></div>
            <div class="skeleton" style="width:36px;height:14px;"></div>
          </div>
        `).join('');
      }
    });

    const mapBox = $('world-map');
    if (mapBox) mapBox.classList.add('skeleton');
  }

  // ── Fetch Loop ───────────────────────────────────────────────────
  let isFetching = false;

  async function fetchStats() {
    if (isFetching) return;
    isFetching = true;

    const btn = $('refreshBtn');
    const btnIcon = btn?.querySelector('svg');
    if (btnIcon) btnIcon.classList.add('btn-spin');

    try {
      showSkeletons();
      const [data] = await Promise.all([
        fetchAggregatedStats(),
        fetch(DISCORD_BOT_KEEP_ALIVE_URL, { cache: 'no-store' }).catch(() => null),
      ]);
      render(data);

      lastSuccess = new Date();
      updateStatusCaption();
    } catch (err) {
      console.error('[telemetry] fetch failed', err);
    } finally {
      isFetching = false;
      if (btnIcon) btnIcon.classList.remove('btn-spin');
    }
  }

  function updateStatusCaption() {
    const caption = $('statusCaption');
    if (!caption) return;
    if (!autoRefreshEnabled) {
      caption.textContent = 'Auto-refresh paused';
    } else if (lastSuccess) {
      caption.textContent = `Updated ${lastSuccess.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } else {
      caption.textContent = 'Updated just now';
    }
  }

  function triggerRefresh() {
    if (autoRefreshEnabled) startAutoRefresh();
    fetchStats();
  }

  function startAutoRefresh() {
    if (timerId) clearInterval(timerId);
    if (!autoRefreshEnabled) return;
    timerId = setInterval(fetchStats, REFRESH_INTERVAL * 1000);
  }

  // ── Theme Management ─────────────────────────────────────────────
  function updateThemeMeta(theme) {
    const meta = $('meta-theme-color');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#070709' : '#f4f6fa');
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('pmc-theme', nextTheme);
    updateThemeMeta(nextTheme);

    // Re-render map with new theme palette
    if (worldMapInstance && lastStats) {
      worldMapInstance.destroy();
      worldMapInstance = null;
      initMap(lastStats);
    }
  }

  // ── Info Tooltips (Touch & Mobile Support) ────────────────────────
  function setupInfoTooltips() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.info-btn');
      const allWraps = document.querySelectorAll('.info-wrap.active');

      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = btn.closest('.info-wrap');
        const isActive = wrap?.classList.contains('active');
        allWraps.forEach((w) => w.classList.remove('active'));
        if (wrap && !isActive) {
          wrap.classList.add('active');
        }
      } else {
        allWraps.forEach((w) => w.classList.remove('active'));
      }
    });
  }

  // ── Boot ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeMeta(initialTheme);

    const themeBtn = $('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    const refreshBtn = $('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', triggerRefresh);

    setupAutoRefreshSwitch();
    setupTimeFilterSegmentedControl();
    setupSearchInputs();
    setupTabBarNavigation();
    setupInfoTooltips();

    triggerRefresh();
  });
})();
