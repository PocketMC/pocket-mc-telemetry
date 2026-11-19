import React from 'react';
import { TabBar } from 'glisse';
import { LayoutDashboard, Users, Server, Globe } from 'lucide-react';

interface BottomNavDockProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNavDock: React.FC<BottomNavDockProps> = ({
  activeTab,
  onTabChange,
}) => {
  const navItems = [
    {
      value: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard size={15} style={{ verticalAlign: 'middle' }} />,
    },
    {
      value: 'clients',
      label: 'Clients',
      icon: <Users size={15} style={{ verticalAlign: 'middle' }} />,
    },
    {
      value: 'servers',
      label: 'Servers',
      icon: <Server size={15} style={{ verticalAlign: 'middle' }} />,
    },
    {
      value: 'map',
      label: 'Global Map',
      icon: <Globe size={15} style={{ verticalAlign: 'middle' }} />,
    },
  ];

  return (
    <nav className="bottom-nav-dock-wrap" aria-label="Bottom section navigation dock">
      <div className="bottom-nav-dock lg-glass">
        <TabBar
          items={navItems}
          value={activeTab}
          onValueChange={onTabChange}
          aria-label="Dashboard sections"
        />
      </div>
    </nav>
  );
};
