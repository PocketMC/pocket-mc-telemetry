import React, { memo } from 'react';
import { House, Users, Server, Globe, RefreshCw } from 'lucide-react';

interface BottomNavDockProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

// Stable static navigation item definitions
const NAV_ITEMS = [
  {
    value: 'overview',
    label: 'Home',
    icon: <House size={20} strokeWidth={2} />,
  },
  {
    value: 'clients',
    label: 'Clients',
    icon: <Users size={20} strokeWidth={2} />,
  },
  {
    value: 'servers',
    label: 'Servers',
    icon: <Server size={20} strokeWidth={2} />,
  },
  {
    value: 'map',
    label: 'Map',
    icon: <Globe size={20} strokeWidth={2} />,
  },
];

export const BottomNavDock: React.FC<BottomNavDockProps> = memo(({
  activeTab,
  onTabChange,
  onRefresh,
  loading,
}) => {
  return (
    <nav className="bottom-dock-wrap" aria-label="Sections navigation dock">
      <div className="bottom-dock-cluster">
        {/* Lightweight Solid Floating Segmented Bar */}
        <div className="solid-segmented-bar" role="tablist" aria-label="Sections">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={item.label}
                className={`segmented-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(item.value)}
              >
                <span className="tab-icon">{item.icon}</span>
                <span className="tab-label">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Matching Solid Circular Refresh Button */}
        <button
          type="button"
          className="solid-dock-refresh-btn"
          aria-label="Refresh telemetry"
          title="Refresh telemetry"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={22} className={loading ? 'btn-spin' : ''} />
        </button>
      </div>
    </nav>
  );
});

BottomNavDock.displayName = 'BottomNavDock';
