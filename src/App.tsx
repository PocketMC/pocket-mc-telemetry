import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTelemetry } from './hooks/useTelemetry';
import { TopBar } from './components/TopBar';
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
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('pmc-theme', theme);

    const themeHex = theme === 'dark' ? '#000000' : '#f4f6fa';
    document.documentElement.style.backgroundColor = themeHex;
    if (document.body) {
      document.body.style.backgroundColor = themeHex;
    }

    const metaThemeColor = document.getElementById('meta-theme-color');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeHex);
    }

    const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleMeta) {
      appleMeta.setAttribute('content', theme === 'dark' ? 'black' : 'default');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // ── Telemetry Data Hook ──────────────────────────────────────────
  const { data, loading, error, refresh } = useTelemetry(30);

  // ── Normalize URLs: clean index.html and migrate legacy hash routes ─
  useEffect(() => {
    // 1. Strip index.html from path if present while preserving clean trailing slash
    if (window.location.pathname.endsWith('/index.html')) {
      const cleanPath = window.location.pathname.replace(/index\.html$/, '');
      window.history.replaceState(null, '', cleanPath + window.location.search + window.location.hash);
    }

    // 2. Automatically redirect legacy hash URLs (#clients, #servers, #map, #heatmap) to clean routes
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash === 'clients' || hash === 'servers' || hash === 'map') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      navigate(`/${hash}`, { replace: true });
    } else if (hash === 'heatmap') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      navigate('/map', { replace: true });
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

  const isMapPage = location.pathname.replace(/\/$/, '').endsWith('/map');

  // Lock body scroll on fullscreen map page
  useEffect(() => {
    if (isMapPage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMapPage]);

  return (
    <div className={`app-wrapper ${isMapPage ? 'map-mode' : ''}`}>
      {/* Viewport Edge Scroll Fades (Eliminates harsh cut-offs at top and bottom boundaries) */}
      {!isMapPage && (
        <>
          <div className="viewport-edge-fade viewport-edge-fade-top" aria-hidden="true" />
          <div className="viewport-edge-fade viewport-edge-fade-bottom" aria-hidden="true" />
        </>
      )}

      {/* Unified Top Navigation & Brand Bar */}
      <TopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigateHome={() => handleTabChange('overview')}
      />

      {/* Global Error Banner */}
      {error && (
        <div className="error-banner" role="alert">
          <span>⚠️ {error.message} — Showing cached data or retry shortly.</span>
          <button type="button" className="btn-surface btn-sm" onClick={refresh}>
            Retry Now
          </button>
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
            <Route path="/heatmap" element={<Navigate to="/map" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* Footer (Hidden on fullscreen map view) */}
      {!isMapPage && (
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
              href="https://github.com/PocketMC/pocket-mc-windows"
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
            <a
              href="https://pocketmc.github.io/terms/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Terms of Service
            </a>
            <a
              href="https://pocketmc.github.io/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Privacy Policy
            </a>
          </div>
        </footer>
      )}

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
