/**
 * PocketMC Telemetry Dashboard
 * Live anonymous usage analytics
 * Supports Light & Dark (Black/Grey) themes, Country Flags, Real Server Flavor Logos, and Interactive Map
 */
(function () {
  'use strict';

  const TELEMETRY_PROXIES = [
    "https://pocket-mc-proxy.onrender.com/api/telemetry/stats",
    "https://pocket-mc-proxy-3fqm.onrender.com/api/telemetry/stats",
    "https://pocket-mc-proxy-20d5.onrender.com/api/telemetry/stats",
    "https://pocket-mc-proxy-n2qx.onrender.com/api/telemetry/stats",
    "https://pocketmc-welcome-bot-1e5d.onrender.com",
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

  // ── State ────────────────────────────────────────────────────────
  let worldMapInstance = null;
  let lastSuccess = null;
  let timerId = null;
  let lastStats = null;

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
      ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c])
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

  function renderCountryFlag(name) {
    const iso = getCountryIso(name);
    if (!iso) {
      return '<span class="country-flag-icon" aria-hidden="true">🌐</span>';
    }
    return `<img class="country-flag-img" src="https://flagcdn.com/20x15/${iso}.png" srcset="https://flagcdn.com/40x30/${iso}.png 2x" width="20" height="15" alt="${escapeHtml(name)} flag" loading="lazy" onerror="this.outerHTML='🌐'" />`;
  }

  // ── Render Breakdown List (Progress Bar Rows with Scrollable Container) ──
  function renderBreakdownList(containerId, entries, isCountry = false) {
    const container = $(containerId);
    if (!container) return;

    if (!entries.length) {
      container.innerHTML = `<div class="empty-breakdown-row">No telemetry data recorded</div>`;
      return;
    }

    const total = entries.reduce((s, [, v]) => s + v, 0);
    const maxVal = entries[0][1] || 1;

    container.innerHTML = entries
      .map(([k, v]) => {
        const sharePct = total ? ((v / total) * 100).toFixed(1) : '0.0';
        const barFillPct = Math.min(100, Math.max(4, (v / maxVal) * 100)).toFixed(1);
        const labelHtml = isCountry
          ? `<div class="breakdown-label-group">${renderCountryFlag(k)}<span class="breakdown-label-text" title="${escapeHtml(k)}">${escapeHtml(k)}</span></div>`
          : `<div class="breakdown-label-group"><span class="breakdown-label-text" title="${escapeHtml(k)}">${escapeHtml(k)}</span></div>`;

        return `
          <div class="breakdown-row">
            ${labelHtml}
            <div class="breakdown-track" aria-hidden="true">
              <div class="breakdown-fill" style="width: ${barFillPct}%;"></div>
            </div>
            <div class="breakdown-value num-data">${fmt(v)}</div>
            <div class="breakdown-share num-data">${sharePct}%</div>
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
      return `<img class="server-flavor-img" src="${src}" alt="${escapeHtml(alt)} logo" width="20" height="20" loading="lazy" />`;
    }

    return `<svg class="server-flavor-img" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;
  }

  function renderServerTypes(containerId, entries) {
    const container = $(containerId);
    if (!container) return;

    if (!entries.length) {
      container.innerHTML = `<div class="empty-breakdown-row">No server type telemetry recorded</div>`;
      return;
    }

    const total = entries.reduce((s, [, v]) => s + v, 0);
    const maxVal = entries[0][1] || 1;

    container.innerHTML = `
      <div class="server-types-table-header" aria-hidden="true">
        <div class="col-type">TYPE</div>
        <div class="col-servers">SERVERS</div>
        <div class="col-share">SHARE</div>
      </div>
      <div class="server-types-table-body">
        ${entries.map(([type, count]) => {
          const sharePct = total ? ((count / total) * 100).toFixed(1) : '0.0';
          const barFillPct = Math.min(100, Math.max(4, (count / maxVal) * 100)).toFixed(1);
          return `
            <div class="server-type-row">
              <div class="col-type">
                <span class="server-type-icon-box">${getServerTypeLogoHtml(type)}</span>
                <span class="server-type-name">${escapeHtml(type)}</span>
              </div>
              <div class="col-servers num-data">${fmt(count)}</div>
              <div class="col-share">
                <span class="share-pct num-data">${sharePct}%</span>
                <div class="mini-bar-track" aria-hidden="true">
                  <div class="mini-bar-fill" style="width: ${barFillPct}%;"></div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
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
      insightServers.innerHTML = `<span class="spotlight-highlight">${escapeHtml(topServer[0])}</span> is dominating as the top server type.`;
    }
    if (insightInstalls) {
      const totalInstalls = Number(stats.totalInstalls) || 0;
      const open = Number(stats.openClients) || 0;
      const hasActive7d = stats.activeUsers7d !== undefined && stats.activeUsers7d !== null;
      const active7d = hasActive7d ? Math.max(Number(stats.activeUsers7d), open) : open;
      if (totalInstalls > 0 && active7d > 0) {
        insightInstalls.innerHTML = `<span class="spotlight-highlight">${pct(active7d, totalInstalls)}</span> (${fmt(active7d)}) of registered users have been active in the last 7 days.`;
      } else if (topLoc) {
        insightInstalls.innerHTML = `<span class="spotlight-highlight">${escapeHtml(topLoc[0])}</span> leads the world in installations.`;
      }
    }
    if (insightClients && topVer) {
      const totalClients = clientVersion.reduce((s, [, v]) => s + v, 0);
      insightClients.innerHTML = `<span class="spotlight-highlight">v${escapeHtml(topVer[0])}</span> makes up ${pct(topVer[1], totalClients)} of all live servers.`;
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

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const regionData = {};
    const markers = [];

    // Region Data: Install Locations
    for (const [country, count] of Object.entries(stats.installLocationDistribution || {})) {
      if (typeof COUNTRY_MAP !== 'undefined') {
        const match = COUNTRY_MAP[country];
        if (match) regionData[match.iso] = Number(count) || 0;
      }
    }

    const activeCountries = new Set(Object.keys(stats.locationDistribution || {}));

    // Marker Data: Live Active Dots (Blue)
    for (const [country, count] of Object.entries(stats.locationDistribution || {})) {
      if (typeof COUNTRY_MAP !== 'undefined') {
        const match = COUNTRY_MAP[country];
        if (match) {
          markers.push({
            name: country,
            coords: match.coords,
            activeCount: count,
            style: {
              initial: {
                fill: isDark ? '#38bdf8' : '#2563eb',
                stroke: isDark ? '#ffffff' : '#ffffff',
                strokeWidth: 1.5,
                r: 4
              }
            }
          });
        }
      }
    }

    // Marker Data: Installed Locations (Green / Subtle)
    for (const [country, count] of Object.entries(stats.installLocationDistribution || {})) {
      if (!activeCountries.has(country)) {
        if (typeof COUNTRY_MAP !== 'undefined') {
          const match = COUNTRY_MAP[country];
          if (match) {
            markers.push({
              name: country,
              coords: match.coords,
              isInstalledOnly: true,
              style: {
                initial: {
                  fill: isDark ? '#22c55e' : '#16a34a',
                  stroke: isDark ? '#141414' : '#ffffff',
                  strokeWidth: 1,
                  r: 3
                }
              }
            });
          }
        }
      }
    }

    // If an instance exists and theme hasn't forced a rebuild, update series values dynamically
    if (worldMapInstance) {
      if (worldMapInstance.series && worldMapInstance.series.regions && worldMapInstance.series.regions[0]) {
        worldMapInstance.series.regions[0].setValues(regionData);
      }
      worldMapInstance.removeMarkers();
      worldMapInstance.addMarkers(markers);
      return;
    }

    // Rebuild jsVectorMap instance
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
          fill: isDark ? '#1c1c1c' : '#e2e8f0',
          stroke: isDark ? '#141414' : '#cbd5e1',
          strokeWidth: 0.5,
          fillOpacity: 1
        },
        hover: {
          fill: isDark ? '#2a2a2a' : '#cbd5e1',
          cursor: 'pointer'
        }
      },

      series: {
        regions: [
          {
            attribute: 'fill',
            scale: isDark ? ['#262626', '#3b82f6'] : ['#dbeafe', '#2563eb'],
            values: regionData
          }
        ]
      },

      markers: markers,
      markerStyle: {
        initial: {
          fill: isDark ? '#38bdf8' : '#2563eb',
          stroke: '#ffffff',
          strokeWidth: 1,
          r: 3.5
        },
        hover: {
          fill: isDark ? '#7dd3fc' : '#1d4ed8',
          r: 5,
          cursor: 'pointer'
        }
      },

      onRegionTooltipShow(event, tooltip, code) {
        const installs = regionData[code] || 0;
        const countryName = tooltip.text();
        const activeCount = (stats.locationDistribution || {})[countryName] || 0;
        const flagHtml = renderCountryFlag(countryName);

        tooltip.text(
          `<div style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:4px;">
            ${flagHtml} <span>${escapeHtml(countryName)}</span>
           </div>
           <div style="font-size:12px;color:var(--text-muted);">
             Active Users: <strong style="color:var(--accent-blue);">${fmt(activeCount)}</strong>
           </div>
           <div style="font-size:12px;color:var(--text-muted);">
             Total Installs: <strong style="color:var(--accent-green);">${fmt(installs)}</strong>
           </div>`,
          true
        );
      },

      onMarkerTooltipShow(event, tooltip, index) {
        const marker = markers[index];
        const countryName = marker.name;
        const installs = (stats.installLocationDistribution || {})[countryName] || 0;
        const activeCount = (stats.locationDistribution || {})[countryName] || 0;
        const flagHtml = renderCountryFlag(countryName);

        tooltip.text(
          `<div style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:4px;">
            ${flagHtml} <span>${escapeHtml(countryName)}</span>
           </div>
           <div style="font-size:12px;color:var(--text-muted);">
             Active Users: <strong style="color:var(--accent-blue);">${fmt(activeCount)}</strong>
           </div>
           <div style="font-size:12px;color:var(--text-muted);">
             Total Installs: <strong style="color:var(--accent-green);">${fmt(installs)}</strong>
           </div>`,
          true
        );
      },

      onRegionClick(event, code) {
        const installs = regionData[code] || 0;
        let name = code;
        if (typeof COUNTRY_MAP !== 'undefined') {
          const entry = Object.entries(COUNTRY_MAP).find(([, val]) => val.iso === code);
          if (entry) name = entry[0];
        }
        showToast(name, `${fmt(installs)} Total Installs`, 'var(--accent-green)');
      },

      onMarkerClick(event, index) {
        const marker = markers[index];
        if (marker.isInstalledOnly) {
          showToast(marker.name, 'No active players currently', 'var(--accent-green)');
        } else {
          showToast(marker.name, `${fmt(marker.activeCount)} Active Players`, 'var(--accent-blue)');
        }
      }
    });
  }

  // ── Custom Toast for Mobile Interactions ────────────────────────
  function showToast(title, message, color) {
    let toast = document.getElementById('map-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'map-toast';
      toast.style.cssText =
        'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-surface);color:var(--text-primary);padding:10px 20px;border-radius:10px;z-index:9999;box-shadow:var(--shadow-elevated);border:1px solid var(--border-card);text-align:center;font-size:13px;pointer-events:none;opacity:0;transition:opacity 0.2s ease, transform 0.2s ease;';
      document.body.appendChild(toast);
    }

    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 10px)';
    void toast.offsetWidth;

    const flagHtml = renderCountryFlag(title);
    toast.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;margin-bottom:2px;color:${color};font-size:14px;">
        ${flagHtml} <span>${escapeHtml(title)}</span>
      </div>
      <div>${message}</div>
    `;
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';

    if (toast.timeout) clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 10px)';
    }, 2500);
  }

  // ── Main Render Routine ──────────────────────────────────────────
  function render(stats) {
    lastStats = stats;

    // ── SECTION 1: INSTALLS & USER BASE ──────────────────────────
    const installVersion = sortedEntries(stats.installVersionDistribution);
    const installCountry = sortedEntries(stats.installLocationDistribution);

    const totalInstalls = Number(stats.totalInstalls) || 0;
    const open = Number(stats.openClients) || 0;
    const hasActive7d = stats.activeUsers7d !== undefined && stats.activeUsers7d !== null;
    const active7d = hasActive7d ? Math.max(Number(stats.activeUsers7d), open) : open;
    const inactive7d = hasActive7d && stats.inactiveUsers7d !== undefined
      ? Number(stats.inactiveUsers7d)
      : Math.max(0, totalInstalls - active7d);
    const countriesReached = installCountry.length;
    const avgInstalls = countriesReached > 0 ? (totalInstalls / countriesReached).toFixed(1) : '0.0';

    $('kpi-totalInstalls').textContent = fmt(totalInstalls);
    $('kpi-activeUsers7d').textContent = fmt(active7d);
    $('kpi-inactiveUsers7d').textContent = fmt(inactive7d);
    $('kpi-installVersions').textContent = fmt(installVersion.length);
    $('kpi-installCountries').textContent = fmt(countriesReached);
    $('kpi-avgInstalls').textContent = avgInstalls;

    renderBreakdownList('tbl-installVersion', installVersion, false);
    renderBreakdownList('tbl-installCountry', installCountry, true);

    // ── SECTION 2: CLIENTS ───────────────────────────────────────
    const active = Number(stats.activeUsers) || 0;
    const afk = Math.max(0, open - active);

    $('kpi-openClients').textContent = fmt(open);
    $('kpi-activeUsers').textContent = fmt(active);
    $('kpi-afkUsers').textContent = fmt(afk);

    const clientVersion = sortedEntries(stats.versionDistribution);
    const clientLocation = sortedEntries(stats.locationDistribution);

    renderBreakdownList('tbl-clientVersion', clientVersion, false);
    renderBreakdownList('tbl-clientLocation', clientLocation, true);

    // ── SECTION 3: SERVERS ───────────────────────────────────────
    $('kpi-totalServers').textContent = fmt(stats.totalRunningServers);
    $('kpi-totalServersCreated').textContent = fmt(stats.totalServersCreated);
    $('kpi-totalServersDeleted').textContent = fmt(stats.totalServersDeleted);
    $('kpi-uptime').textContent = fmt(Math.round(stats.globalUptimeHours)) + ' Hrs';

    const serverType = sortedEntries(stats.serverTypeDistribution);
    renderServerTypes('tbl-serverType', serverType);

    // ── INSIGHTS & MAP ───────────────────────────────────────────
    renderInsights(stats, clientVersion, serverType, installCountry);

    const mapInsight = $('insight-map');
    if (mapInsight) {
      mapInsight.textContent = `Installations from ${countriesReached} countries around the world.`;
    }

    initMap(stats);
  }

  // ── Skeleton Loader ──────────────────────────────────────────────
  function showSkeletons() {
    if (lastSuccess) return;

    const kpis = [
      'kpi-totalInstalls',
      'kpi-activeUsers7d',
      'kpi-inactiveUsers7d',
      'kpi-installVersions',
      'kpi-installCountries',
      'kpi-avgInstalls',
      'kpi-openClients',
      'kpi-activeUsers',
      'kpi-afkUsers',
      'kpi-serverDensity',
      'kpi-totalServers',
      'kpi-totalServersCreated',
      'kpi-totalServersDeleted',
      'kpi-uptime',
    ];

    kpis.forEach((id) => {
      const el = $(id);
      if (el) {
        el.innerHTML = '<span class="skeleton" style="display:inline-block;width:60%;height:1.15em;"></span>';
      }
    });

    const lists = [
      'tbl-installVersion',
      'tbl-installCountry',
      'tbl-clientVersion',
      'tbl-clientLocation',
      'tbl-serverType',
    ];

    lists.forEach((id) => {
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
    if (mapBox) {
      mapBox.classList.add('skeleton');
    }
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
      const data = await fetchAggregatedStats();
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
    if (lastSuccess) {
      caption.textContent = `Updated ${lastSuccess.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } else {
      caption.textContent = 'Updated just now';
    }
  }

  function triggerRefresh() {
    startAutoRefresh();
    fetchStats();
  }

  function startAutoRefresh() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(fetchStats, REFRESH_INTERVAL * 1000);
  }

  // ── Theme Management ─────────────────────────────────────────────
  function updateThemeMeta(theme) {
    const meta = $('meta-theme-color');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#f1f5f9');
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('pmc-theme', nextTheme);
    updateThemeMeta(nextTheme);

    // Re-render map to apply new SVG theme palette
    if (worldMapInstance && lastStats) {
      worldMapInstance.destroy();
      worldMapInstance = null;
      initMap(lastStats);
    }
  }

  // ── Active Navigation Pill Highlight ─────────────────────────────
  function setupScrollSpy() {
    const navPills = document.querySelectorAll('.nav-pill');
    const sections = ['overview', 'section-installs', 'section-map', 'section-servers']
      .map((id) => $(id))
      .filter(Boolean);

    window.addEventListener(
      'scroll',
      () => {
        let currentSectionId = 'overview';
        const scrollY = window.scrollY + 120;

        sections.forEach((section) => {
          if (section.offsetTop <= scrollY) {
            currentSectionId = section.id;
          }
        });

        navPills.forEach((pill) => {
          const href = pill.getAttribute('href').replace('#', '');
          if (href === currentSectionId) {
            pill.classList.add('active');
          } else {
            pill.classList.remove('active');
          }
        });
      },
      { passive: true }
    );
  }

  // ── Boot ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Theme setup
    const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeMeta(initialTheme);

    const themeBtn = $('themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleTheme);
    }

    const refreshBtn = $('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', triggerRefresh);
    }

    setupScrollSpy();
    triggerRefresh();
    startAutoRefresh();
  });
})();
