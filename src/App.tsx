import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from 'glisse';
import { useTelemetry } from './hooks/useTelemetry';
import { GlisseTopBar } from './components/GlisseTopBar';
import { FullscreenHeatmap } from './components/FullscreenHeatmap';
import { BottomNavDock } from './components/BottomNavDock';
import { HomePage, ClientsPage, ServersPage, MapPage } from './pages';

export const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

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

  // ── Telemetry Data Hook ──────────────────────────────────────────
  const { data, loading, error, refresh } = useTelemetry(30);

  // ── Normalize URLs: clean index.html and migrate legacy hash routes ─
  useEffect(() => {
    // 1. Strip index.html from path if present
    if (window.location.pathname.endsWith('/index.html')) {
      const cleanPath = window.location.pathname.replace(/\/index\.html$/, '') || '/';
      window.history.replaceState(null, '', cleanPath + window.location.search + window.location.hash);
    }

    // 2. Automatically redirect legacy hash URLs (#clients, #servers, #map, #heatmap) to clean routes
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash === 'clients' || hash === 'servers' || hash === 'map' || hash === 'heatmap') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      navigate(`/${hash}`, { replace: true });
    } else if (hash === 'overview' || hash === 'home') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Determine active tab for BottomNavDock based on current route (memoized)
  const activeTab = useMemo((): string => {
    const path = location.pathname.replace(/\/$/, '');
    if (path.endsWith('/clients')) return 'clients';
    if (path.endsWith('/servers')) return 'servers';
    if (path.endsWith('/map')) return 'map';
    return 'overview';
  }, [location.pathname]);

  const handleTabChange = useCallback((tab: string) => {
    const targetRoute = tab === 'overview' ? '/' : `/${tab}`;
    navigate(targetRoute);
    // Instant scroll prevents mobile viewport resizing/jitter fighting tab transitions
    window.scrollTo(0, 0);
  }, [navigate]);

  // Dedicated Fullscreen Heatmap Route
  if (location.pathname.endsWith('/heatmap')) {
    return (
      <FullscreenHeatmap
        stats={data}
        theme={theme}
        onBack={() => navigate('/map')}
      />
    );
  }

  return (
    <div className="app-wrapper">
      {/* Authentic Glisse Floating Command Bar */}
      <GlisseTopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigateHome={() => handleTabChange('overview')}
      />

      {/* Global Error Banner */}
      {error && (
        <div className="error-banner" role="alert">
          <span>⚠️ {error.message} — Showing cached data or retry shortly.</span>
          <Button variant="glass" onClick={refresh}>
            Retry Now
          </Button>
        </div>
      )}

      {/* Independent Page Views Routed Dynamically with Smooth Content Transitions */}
      <main className="main-content">
        <div key={location.pathname} className="page-transition">
          <Routes location={location}>
            <Route path="/" element={<HomePage data={data} />} />
            <Route path="/overview" element={<Navigate to="/" replace />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/clients" element={<ClientsPage data={data} />} />
            <Route path="/servers" element={<ServersPage data={data} />} />
            <Route path="/map" element={<MapPage stats={data} theme={theme} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* Footer */}
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

      {/* Floating Bottom Navigation Dock (Memoized) */}
      <BottomNavDock
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onRefresh={refresh}
        loading={loading}
      />
    </div>
  );
};
