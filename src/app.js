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
  let countdown = REFRESH_INTERVAL;
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
          // Prevent x-axis from expanding beyond container
          suggestedMax: undefined,
        },
        y: {
          grid: { display: false },
          ticks: {
            color: theme.textPrimary,
            font: { weight: 500, size: small ? 10 : 12 },
            // Truncate long labels on mobile
            maxTicksLimit: small ? 8 : 20,
            // Truncate label text to prevent overflow on small screens
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

  /**
   * Build a horizontal bar dataset.
   */
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
      // Avoid bars escaping the container
      maxBarThickness: small ? 16 : 28,
    };
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
  }

  // ── MOCK DATA FALLBACK ───────────────────────────────────────────
  function renderMockData() {
    render({
      totalInstalls: 14205,
      installVersionDistribution: {
        'v1.2.0': 8500,
        'v1.1.5': 4200,
        'v1.1.0': 1005,
        Legacy: 500,
      },
      installLocationDistribution: {
        'United States': 5200,
        Germany: 3100,
        UK: 2100,
        Brazil: 1800,
        Japan: 1205,
        Others: 800,
      },
      openClients: 1240,
      activeUsers: 950,
      versionDistribution: { 'v1.2.0': 900, 'v1.1.5': 250, 'v1.1.0': 90 },
      locationDistribution: {
        'United States': 450,
        Germany: 250,
        UK: 200,
        Brazil: 180,
        Japan: 160,
      },
      globalUptimeHours: 8540.5,
      totalRunningServers: 312,
      totalServersCreated: 4500,
      totalServersDeleted: 4188,
      serverTypeDistribution: {
        Survival: 150,
        Creative: 80,
        Minigames: 50,
        Lobby: 32,
      },
    });
  }

  // ── Status indicator ─────────────────────────────────────────────
  function setStatus(state) {
    const dotWrapper = $('statusDot');
    const dot = dotWrapper.querySelector('.status-dot');
    const txt = $('statusText');

    dotWrapper.className = 'status-dot-wrapper';
    dot.className = 'status-dot';

    if (state === 'error') {
      dotWrapper.classList.add('status-error');
      dot.classList.add('status-error');
      txt.textContent = 'Disconnected';
      txt.className = 'status-text status-text-error';
    } else if (state === 'loading') {
      dotWrapper.classList.add('status-loading');
      dot.classList.add('status-loading');
      txt.textContent = 'Updating\u2026';
      txt.className = 'status-text status-text-loading';
    } else {
      dotWrapper.classList.add('status-ok');
      dot.classList.add('status-ok');
      txt.textContent = 'Live';
      txt.className = 'status-text status-text-ok';
    }
  }

  // ── Fetch loop ───────────────────────────────────────────────────
  async function fetchStats() {
    setStatus('loading');
    try {
      const res = await fetch(API_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      render(data);

      lastSuccess = new Date();
      $('errLast').textContent = lastSuccess.toLocaleTimeString();
      $('errorPanel').classList.add('hidden');
      setStatus('ok');
    } catch (err) {
      console.error('[telemetry] fetch failed', err);
      $('errorPanel').classList.remove('hidden');
      $('errLast').textContent = lastSuccess
        ? lastSuccess.toLocaleTimeString()
        : 'never';
      setStatus('error');
      renderMockData();
    }
  }

  function tick() {
    countdown -= 1;
    if (countdown <= 0) {
      countdown = REFRESH_INTERVAL;
      fetchStats();
    }
    $('countdown').textContent = countdown + 's';
  }

  function startLoop() {
    if (timerId) clearInterval(timerId);
    countdown = REFRESH_INTERVAL;
    $('countdown').textContent = countdown + 's';
    timerId = setInterval(tick, 1000);
  }

  function manualRefresh() {
    const btnIcon = $('refreshBtn').querySelector('svg');
    if (btnIcon) btnIcon.classList.add('btn-spin');
    setTimeout(() => {
      if (btnIcon) btnIcon.classList.remove('btn-spin');
    }, 1000);

    countdown = REFRESH_INTERVAL;
    $('countdown').textContent = countdown + 's';
    fetchStats();
  }

  // ── Touch / mobile helpers ───────────────────────────────────────
  function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // ── Resize handler ───────────────────────────────────────────────
  let resizeTimer = null;
  function handleResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // On resize, just resize all existing charts (no API refetch needed)
      Object.values(charts).forEach(chart => {
        if (chart) chart.resize();
      });
    }, 200);
  }

  // ── Boot ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    $('refreshBtn').addEventListener('click', manualRefresh);
    $('retryBtn').addEventListener('click', manualRefresh);
    fetchStats();
    startLoop();

    // Re-render on resize (e.g. rotate phone)
    window.addEventListener('resize', handleResize);
  });
})();