import React from 'react';
import { TabBar, Button } from 'glisse';
import { House, Users, Server, Globe, RefreshCw } from 'lucide-react';

interface BottomNavDockProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const BottomNavDock: React.FC<BottomNavDockProps> = ({
  activeTab,
  onTabChange,
  onRefresh,
  loading,
}) => {
  const navItems = [
    {
      value: 'overview',
      label: 'Home',
      icon: <House size={26} strokeWidth={1.9} />,
    },
    {
      value: 'clients',
      label: 'Clients',
      icon: <Users size={26} strokeWidth={1.9} />,
    },
    {
      value: 'servers',
      label: 'Servers',
      icon: <Server size={26} strokeWidth={1.8} />,
    },
    {
      value: 'map',
      label: 'Map',
      icon: <Globe size={26} strokeWidth={1.8} />,
    },
  ];

  return (
    <nav className="bottom-dock-wrap" aria-label="Sections navigation dock">
      <div className="bottom-dock-cluster">
        <TabBar
          aria-label="Library"
          items={navItems}
          value={activeTab}
          onValueChange={onTabChange}
          style={{
            '--lg-lens-grow-x': '32px',
            '--lg-lens-grow-y': '21px',
          } as React.CSSProperties}
        />
        <Button
          variant="glass"
          className="dock-refresh-btn"
          aria-label="Refresh telemetry"
          title="Refresh telemetry"
          onClick={onRefresh}
          disabled={loading}
          icon={<RefreshCw size={22} className={loading ? 'btn-spin' : ''} />}
        />
      </div>
    </nav>
  );
};


