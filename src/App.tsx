import React, { useState, useEffect, useMemo } from 'react';
import { Button } from 'glisse';
import {
  Download,
  Users,
  UserX,
  Globe,
  Activity,
  TrendingUp,
  Server,
  PlusCircle,
  Trash2,
  Clock,
  Maximize2,
} from 'lucide-react';
import { useTelemetry } from './hooks/useTelemetry';
import { LiquidAura } from './components/LiquidAura';
import { GlisseTopBar } from './components/GlisseTopBar';
import { SectionCard } from './components/SectionCard';
import { KpiCard } from './components/KpiCard';
import { TimeframeControl } from './components/TimeframeControl';
import { BreakdownCard } from './components/BreakdownCard';
import { ServerFleetTable } from './components/ServerFleetTable';
import { TelemetryWorldMap } from './components/TelemetryWorldMap';
import { FullscreenHeatmap } from './components/FullscreenHeatmap';
import type { TimeframePeriod } from './types/telemetry';

export const App: React.FC = () => {
  // ── Theme State ──────────────────────────────────────────────────
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('pmc-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pmc-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // ── View State (Dashboard vs Fullscreen Heatmap) ─────────────────
  const [view, setView] = useState<'dashboard' | 'heatmap'>(() => {
    return window.location.hash === '#heatmap' ? 'heatmap' : 'dashboard';
  });

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#heatmap') {
        setView('heatmap');
      } else {
        setView('dashboard');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // ── Section Navigation ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const targetId =
      tab === 'overview'
        ? 'section-installs'
        : tab === 'clients'
        ? 'section-clients'
        : tab === 'servers'
        ? 'section-servers'
        : 'section-map';

    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ── Telemetry Hook ───────────────────────────────────────────────
  const { data, loading, error, lastUpdated, autoRefresh, setAutoRefresh, refresh } =
    useTelemetry(30);

  // ── Section 1 Timeframe State ────────────────────────────────────
  const [timeframe, setTimeframe] = useState<TimeframePeriod>('7d');

  // Dynamic calculations for Timeframe KPI
  const { activeUsersCount, activeUsersLabel, activeUsersTooltip } = useMemo(() => {
    const totalInstalls = Number(data?.totalInstalls) || 0;
    const open = Number(data?.openClients) || 0;
    const raw7d = data?.activeUsers7d !== undefined ? Number(data.activeUsers7d) : open;
    const active7d = Math.max(raw7d, open);

    if (timeframe === '24h') {
      const active24h = data?.activeUsers24h !== undefined ? Number(data.activeUsers24h) : open;
      return {
        activeUsersCount: active24h,
        activeUsersLabel: 'Active Users (24H)',
        activeUsersTooltip: 'Active in last 24 hours',
      };
    }
    if (timeframe === '30d') {
      const active30d = data?.activeUsers30d !== undefined ? Number(data.activeUsers30d) : active7d;
      return {
        activeUsersCount: active30d,
        activeUsersLabel: 'Active Users (30D)',
        activeUsersTooltip: 'Active in last 30 days',
      };
    }
    if (timeframe === 'total') {
      return {
        activeUsersCount: totalInstalls,
        activeUsersLabel: 'Lifetime Installs',
        activeUsersTooltip: 'Cumulative registered installations',
      };
    }
    return {
      activeUsersCount: active7d,
      activeUsersLabel: 'Active Users (7D)',
      activeUsersTooltip: 'Active in last 7 days',
    };
  }, [data, timeframe]);

  // Format Helper
  const fmt = (n?: number | null) => (n == null ? '-' : n.toLocaleString());

  const totalCountries = Object.keys(data?.installLocationDistribution || {}).length;
  const activeCountries = Object.keys(data?.locationDistribution || {}).length;

  if (view === 'heatmap') {
    return (
      <>
        <LiquidAura theme={theme} />
        <FullscreenHeatmap
          stats={data}
          theme={theme}
          onBack={() => {
            setView('dashboard');
            window.location.hash = '';
          }}
        />
      </>
    );
  }

  return (
    <>
      {/* Background Dynamic Wallpaper Canvas */}
      <LiquidAura theme={theme} />

      <div className="app-wrapper">
        {/* Authentic Glisse Floating Command Bar */}
        <GlisseTopBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={setAutoRefresh}
          onRefresh={refresh}
          loading={loading}
          lastUpdated={lastUpdated}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Global Error Banner if proxy unavailable */}
        {error && (
          <div className="error-banner" role="alert">
            <span>⚠️ {error.message} — Showing cached data or retry shortly.</span>
            <Button variant="glass" onClick={refresh}>
              Retry Now
            </Button>
          </div>
        )}

        <main className="main-content">
          {/* ═══════════════════════════════════════════════════════════
               SECTION 1 : Installations & User Base
               ═══════════════════════════════════════════════════════════ */}
          <SectionCard
            id="section-installs"
            title="Installations & User Base"
            icon={<Download size={18} />}
            iconColor="green"
            insight={
              <span>
                Over <strong>{fmt(data?.totalInstalls)}</strong> registered installs with{' '}
                <strong>{fmt(activeUsersCount)}</strong> active in {timeframe.toUpperCase()} (
                {data?.totalInstalls
                  ? ((activeUsersCount / (data.totalInstalls || 1)) * 100).toFixed(1)
                  : '0'}
                %)
              </span>
            }
            action={<TimeframeControl period={timeframe} onChange={setTimeframe} />}
          >
            {/* KPI Cards Grid */}
            <div className="kpi-grid">
              <KpiCard
                value={fmt(data?.totalInstalls)}
                label="Total Installs"
                colorClass="text-green"
                icon={<Download size={18} />}
                tooltip="Lifetime installations"
              />
              <KpiCard
                value={fmt(activeUsersCount)}
                label={activeUsersLabel}
                colorClass="text-blue"
                icon={<Users size={18} />}
                tooltip={activeUsersTooltip}
              />
              <KpiCard
                value={fmt(data?.inactiveUsers7d)}
                label="Inactive Users"
                colorClass="text-slate"
                icon={<UserX size={18} />}
                tooltip="Not active in 7+ days"
              />
              <KpiCard
                value={fmt(totalCountries)}
                label="Countries Reached"
                colorClass="text-blue"
                icon={<Globe size={18} />}
                tooltip="Total unique countries with installations"
              />
            </div>

            {/* Distribution Breakdowns Grid */}
            <div className="breakdown-grid">
              <BreakdownCard
                title="Install Versions"
                data={data?.installVersionDistribution}
                placeholder="Filter install versions..."
              />
              <BreakdownCard
                title="Install Locations"
                data={data?.installLocationDistribution}
                placeholder="Filter install countries..."
                isCountry
              />
            </div>
          </SectionCard>

          {/* ═══════════════════════════════════════════════════════════
               SECTION 2 : Active Clients & Online Population
               ═══════════════════════════════════════════════════════════ */}
          <SectionCard
            id="section-clients"
            title="Active Clients & Online Population"
            icon={<Activity size={18} />}
            iconColor="blue"
            insight={
              <span>
                <strong>{fmt(data?.openClients)}</strong> clients currently online running PocketMC
              </span>
            }
          >
            {/* KPI Cards Grid */}
            <div className="kpi-grid">
              <KpiCard
                value={fmt(data?.openClients)}
                label="Open Clients Now"
                colorClass="text-blue"
                icon={<Activity size={18} />}
                tooltip="Connected clients sending live telemetry heartbeat"
              />
              <KpiCard
                value={fmt(data?.activeUsers7d)}
                label="Active Users (7D)"
                colorClass="text-blue"
                icon={<Users size={18} />}
                tooltip="Distinct active user sessions in the last 7 days"
              />
              <KpiCard
                value={fmt(data?.openClients)}
                label="Peak Concurrent"
                colorClass="text-slate"
                icon={<TrendingUp size={18} />}
                tooltip="Live concurrent client peak observed"
              />
              <KpiCard
                value={fmt(activeCountries)}
                label="Active Countries"
                colorClass="text-blue"
                icon={<Globe size={18} />}
                tooltip="Countries with currently active clients"
              />
            </div>

            {/* Distribution Breakdowns Grid */}
            <div className="breakdown-grid">
              <BreakdownCard
                title="Active Client Versions"
                data={data?.versionDistribution}
                placeholder="Filter client versions..."
              />
              <BreakdownCard
                title="Active Client Locations"
                data={data?.locationDistribution}
                placeholder="Filter client countries..."
                isCountry
              />
            </div>
          </SectionCard>

          {/* ═══════════════════════════════════════════════════════════
               SECTION 3 : Live PocketMC Servers Fleet
               ═══════════════════════════════════════════════════════════ */}
          <SectionCard
            id="section-servers"
            title="Live PocketMC Servers Fleet"
            icon={<Server size={18} />}
            iconColor="purple"
            insight={
              <span>
                <strong>{fmt(data?.totalRunningServers)}</strong> Minecraft servers actively hosted
                via PocketMC right now
              </span>
            }
          >
            {/* KPI Cards Grid */}
            <div className="kpi-grid">
              <KpiCard
                value={fmt(data?.totalRunningServers)}
                label="Total Running Servers"
                colorClass="text-purple"
                icon={<Server size={18} />}
                tooltip="Currently running Minecraft server instances"
              />
              <KpiCard
                value={fmt(data?.totalServersCreated)}
                label="Total Servers Created"
                colorClass="text-blue"
                icon={<PlusCircle size={18} />}
                tooltip="Cumulative servers created across all instances"
              />
              <KpiCard
                value={fmt(data?.totalServersDeleted)}
                label="Total Servers Deleted"
                colorClass="text-slate"
                icon={<Trash2 size={18} />}
                tooltip="Cumulative servers decommissioned"
              />
              <KpiCard
                value={fmt(data?.globalUptimeHours)}
                label="Global Uptime Hours"
                colorClass="text-purple"
                icon={<Clock size={18} />}
                tooltip="Cumulative server uptime across all hosts"
              />
            </div>

            {/* Server Fleet Table with official flavor logos */}
            <ServerFleetTable data={data?.serverTypeDistribution} />
          </SectionCard>

          {/* ═══════════════════════════════════════════════════════════
               SECTION 4 : Global Activity Map
               ═══════════════════════════════════════════════════════════ */}
          <SectionCard
            id="section-map"
            title="Global Activity Map"
            icon={<Globe size={18} />}
            iconColor="blue"
            insight={<span>{totalCountries} countries reached with active installations worldwide</span>}
            action={
              <Button
                variant="glass"
                onClick={() => {
                  setView('heatmap');
                  window.location.hash = '#heatmap';
                }}
                icon={<Maximize2 size={14} />}
                aria-label="Open fullscreen map view"
              >
                Fullscreen Heatmap
              </Button>
            }
          >
            <TelemetryWorldMap stats={data} theme={theme} />
            <div className="map-note">
              Note: Markers represent country-level telemetry coordinates for privacy. Exact coordinates are never collected.
            </div>
          </SectionCard>
        </main>

        {/* ═══════════════════════════════════════════════════════════
             FOOTER
             ═══════════════════════════════════════════════════════════ */}
        <footer className="app-footer">
          <div className="footer-brand">
            <img
              src="https://raw.githubusercontent.com/PocketMC/pocket-mc-website/refs/heads/master/public/logo.webp"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'icon.svg';
              }}
              alt="PocketMC logo"
              width={22}
              height={22}
              className="footer-logo"
            />
            <span className="footer-title">PocketMC Telemetry</span>
          </div>

          <p className="footer-text">
            Anonymous telemetry data collected securely to improve performance and understand real-world application usage patterns.
          </p>

          <div className="footer-links">
            <a
              href="https://github.com/PocketMC/pocket-mc-telemetry"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              GitHub Repository
            </a>
            <a
              href="https://github.com/PocketMC"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              PocketMC Organization
            </a>
            <a
              href="https://pocketmc.github.io/pocket-mc-website/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Official Website
            </a>
          </div>
        </footer>
      </div>
    </>
  );
};
