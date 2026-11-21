import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Info } from 'lucide-react';

interface TopBarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigateHome?: () => void;
  showMapInfo?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  theme,
  onToggleTheme,
  onNavigateHome,
  showMapInfo = false,
}) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  // Close info popover when clicking outside
  useEffect(() => {
    if (!infoOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [infoOpen]);

  // Reset open state when navigating away from map
  useEffect(() => {
    if (!showMapInfo) {
      setInfoOpen(false);
    }
  }, [showMapInfo]);

  return (
    <header className="top-header-row">
      {/* Brand Component: Solid/translucent dark capsule matching dock material */}
      <button
        type="button"
        className="top-brand-btn"
        onClick={onNavigateHome}
        aria-label="PocketMC Telemetry Home"
      >
        <img
          className="brand-logo-img"
          src="https://raw.githubusercontent.com/PocketMC/pocket-mc-website/refs/heads/master/public/logo.webp"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'icon.svg';
          }}
          alt="PocketMC logo"
          width={36}
          height={36}
        />
        <div className="brand-text">
          <span className="brand-name">PocketMC</span>
          <span className="brand-sub">Telemetry</span>
        </div>
      </button>

      {/* Topbar Actions Group (Consistent dock material, 60px height) */}
      <div className="topbar-actions-group">
        {/* Map Telemetry Info & Legend Popover Button */}
        {showMapInfo && (
          <div className="top-info-wrapper" ref={infoRef}>
            <button
              type="button"
              className={`top-action-btn ${infoOpen ? 'active' : ''}`}
              onClick={() => setInfoOpen((prev) => !prev)}
              onMouseEnter={() => setInfoOpen(true)}
              onMouseLeave={() => setInfoOpen(false)}
              aria-label="Map telemetry privacy information and legend"
              aria-expanded={infoOpen}
              title="Map privacy & legend"
            >
              <Info size={21} strokeWidth={1.9} />
            </button>

            {infoOpen && (
              <div
                className="top-info-popover"
                onMouseEnter={() => setInfoOpen(true)}
                onMouseLeave={() => setInfoOpen(false)}
              >
                <div className="top-info-title">Telemetry Privacy</div>
                <p className="top-info-text">
                  Markers represent country-level telemetry coordinates for privacy. Exact coordinates are never collected.
                </p>
                <div className="top-info-legend">
                  <div className="legend-item">
                    <span className="legend-marker marker-open-clients" />
                    <span>Open Clients</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-marker marker-installs" />
                    <span>Total Installs</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <a
          href="https://github.com/PocketMC/pocket-mc-windows"
          target="_blank"
          rel="noopener noreferrer"
          className="top-action-btn"
          aria-label="View on GitHub"
          title="View on GitHub"
        >
          {/* Well-proportioned GitHub Icon */}
          <svg
            className="top-github-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
        </a>

        {/* Theme Toggle Button with Centered Animated Icon */}
        <button
          type="button"
          className="top-action-btn"
          onClick={onToggleTheme}
          aria-label="Toggle light and dark mode"
          title="Toggle light and dark mode"
        >
          <span key={theme} className="theme-toggle-icon-wrap">
            {theme === 'dark' ? (
              <Moon size={22} strokeWidth={1.9} />
            ) : (
              <Sun size={22} strokeWidth={1.9} />
            )}
          </span>
        </button>
      </div>
    </header>
  );
};
