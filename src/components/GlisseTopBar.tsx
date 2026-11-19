import React from 'react';
import { TabBar, Switch, Button } from 'glisse';
import { RefreshCw, Sun, Moon } from 'lucide-react';

interface GlisseTopBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: (val: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
  lastUpdated: Date | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const GlisseTopBar: React.FC<GlisseTopBarProps> = ({
  activeTab,
  onTabChange,
  autoRefresh,
  onToggleAutoRefresh,
  onRefresh,
  loading,
  lastUpdated,
  theme,
  onToggleTheme,
}) => {
  const navItems = [
    { value: 'overview', label: 'Overview' },
    { value: 'clients', label: 'Clients' },
    { value: 'servers', label: 'Servers' },
    { value: 'map', label: 'Global Map' },
  ];

  return (
    <header className="topbar lg-glass">
      {/* Brand mark */}
      <div className="topbar-left">
        <a href="#overview" className="brand-link" aria-label="PocketMC Telemetry Home">
          <img
            className="logo-mark"
            src="https://raw.githubusercontent.com/PocketMC/pocket-mc-website/refs/heads/master/public/logo.webp"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'icon.svg';
            }}
            alt="PocketMC logo"
            width={32}
            height={32}
          />
          <div className="brand-text">
            <span className="brand-name">PocketMC</span>
            <span className="brand-sub">Telemetry</span>
          </div>
        </a>
      </div>

      {/* Real Glisse TabBar for Sections */}
      <nav className="topbar-nav" aria-label="Sections navigation">
        <TabBar
          items={navItems}
          value={activeTab}
          onValueChange={onTabChange}
          aria-label="Dashboard sections"
        />
      </nav>

      {/* Topbar Actions */}
      <div className="topbar-actions-group">
        {/* Live Status Pill */}
        <div className="live-status-pill">
          <span className="live-dot" aria-hidden="true" />
          <span className="live-title">Live</span>
          <span className="live-separator" aria-hidden="true">|</span>
          <span className="live-time">
            {!autoRefresh
              ? 'Paused'
              : lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Syncing...'}
          </span>
        </div>

        {/* Real Glisse Switch for 30s Auto-Refresh */}
        <div className="auto-refresh-control" title="Toggle 30-second live auto-refresh">
          <span className="switch-label">Live 30s</span>
          <Switch
            checked={autoRefresh}
            onCheckedChange={onToggleAutoRefresh}
            aria-label="Toggle 30-second live auto-refresh"
          />
        </div>

        {/* Real Glisse Button for Refresh */}
        <Button
          variant="glass"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh telemetry now"
          icon={<RefreshCw size={13} className={loading ? 'btn-spin' : ''} />}
        >
          Refresh
        </Button>

        {/* Real Glisse Button for GitHub */}
        <a
          href="https://github.com/PocketMC/pocket-mc-telemetry"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <Button
            variant="glass"
            aria-label="View on GitHub"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            }
          />
        </a>

        {/* Real Glisse Button for Theme Switch */}
        <Button
          variant="glass"
          onClick={onToggleTheme}
          aria-label="Toggle light and dark mode"
          icon={theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
        />
      </div>
    </header>
  );
};
