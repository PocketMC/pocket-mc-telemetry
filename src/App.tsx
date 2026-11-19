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
import { BreakdownCard } from './components/BreakdownCard';
import { ServerFleetTable } from './components/ServerFleetTable';
import { TelemetryWorldMap } from './components/TelemetryWorldMap';
import { FullscreenHeatmap } from './components/FullscreenHeatmap';
import { BottomNavDock } from './components/BottomNavDock';

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

  // ── Section Navigation & Smooth Scroll Spy ──────────────────────
  const [activeTab, setActiveTab] = useState('overview');
  const isNavigatingRef = React.useRef(false);
  const scrollTimeoutRef = React.useRef<number | null>(null);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    isNavigatingRef.current = true;

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
      const topOffset = element.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: topOffset, behavior: 'smooth' });
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
      isNavigatingRef.current = false;
    }, 800);
  };

  useEffect(() => {
    if (view !== 'dashboard') return;

    const sectionMap: Record<string, string> = {
      'section-installs': 'overview',
      'section-clients': 'clients',
      'section-servers': 'servers',
      'section-map': 'map',
    };

    const handleScroll = () => {
      // If user clicked a tab, ignore intermediate scroll events so indicator doesn't jitter
      if (isNavigatingRef.current) return;

      const scrollY = window.scrollY;
      const sections = Object.keys(sectionMap).map((id) => document.getElementById(id));
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        if (sec && scrollY >= sec.offsetTop - 220) {
          const tab = sectionMap[sec.id];
          if (tab) {
            setActiveTab(tab);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [view]);

  // ── Telemetry Hook ───────────────────────────────────────────────
  const { data, loading, error, lastUpdated, autoRefresh, setAutoRefresh, refresh } =
    useTelemetry(30);

  // ── 7-Day Active Users (accounting for open clients fallback) ──────
  const activeUsers7d = useMemo(() => {
    const open = Number(data?.openClients) || 0;
    const raw7d = data?.activeUsers7d !== undefined ? Number(data.activeUsers7d) : open;
    return Math.max(raw7d, open);
  }, [data]);

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
                <strong>{fmt(activeUsers7d)}</strong> active in 7D (
                {data?.totalInstalls
                  ? ((activeUsers7d / (data.totalInstalls || 1)) * 100).toFixed(1)
                  : '0'}
                %)
              </span>
            }
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
                value={fmt(activeUsers7d)}
                label="Active Users (7D)"
                colorClass="text-blue"
                icon={<Users size={18} />}
                tooltip="Active in last 7 days"
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

        {/* Floating Bottom Navigation Dock with Authentic Glisse TabBar & Refresh Button */}
        <BottomNavDock
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onRefresh={refresh}
          loading={loading}
        />
      </div>
    </>
  );
};
