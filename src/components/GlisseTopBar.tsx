import React from 'react';
import { TabBar, Switch, Button, Glass } from 'glisse';
import { RefreshCw, Github, Sun, Moon } from 'lucide-react';

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
    <Glass className="topbar">
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
            icon={<Github size={15} />}
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
    </Glass>
  );
};
