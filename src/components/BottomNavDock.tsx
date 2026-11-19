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
      icon: <LayoutDashboard size={20} strokeWidth={2.2} />,
    },
    {
      value: 'clients',
      label: 'Clients',
      icon: <Users size={20} strokeWidth={2.2} />,
    },
    {
      value: 'servers',
      label: 'Servers',
      icon: <Server size={20} strokeWidth={2.2} />,
    },
    {
      value: 'map',
      label: 'Global Map',
      icon: <Globe size={20} strokeWidth={2.2} />,
    },
  ];

  return (
    <nav className="bottom-dock-wrap" aria-label="Sections navigation dock">
      <TabBar
        items={navItems}
        value={activeTab}
        onValueChange={onTabChange}
        aria-label="Dashboard sections"
      />
    </nav>
  );
};
