import React, { memo, useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react';
import { Download, Users, Server, Globe, RefreshCw } from 'lucide-react';

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
    label: 'Installs',
    icon: <Download size={20} strokeWidth={2} />,
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
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navGroupRef = useRef<HTMLDivElement | null>(null);

  const [pillStyle, setPillStyle] = useState<{
    x: number;
    width: number;
    height: number;
    ready: boolean;
  }>({
    x: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const updatePill = useCallback(() => {
    const activeEl = tabRefs.current[activeTab];
    if (activeEl) {
      setPillStyle({
        x: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        ready: true,
      });
    }
  }, [activeTab]);

  useLayoutEffect(() => {
    updatePill();
  }, [updatePill]);

  useEffect(() => {
    if (!navGroupRef.current) return;
    const observer = new ResizeObserver(() => {
      updatePill();
    });
    observer.observe(navGroupRef.current);
    return () => observer.disconnect();
  }, [updatePill]);

  return (
    <nav className="bottom-dock-wrap" aria-label="Sections navigation dock">
      <div className="solid-segmented-bar">
        {/* Navigation Tabs with Smooth Sliding Active Pill */}
        <div ref={navGroupRef} className="dock-nav-items" role="tablist" aria-label="Sections">
          {/* Animated sliding indicator pill */}
          <div
            className="dock-active-indicator"
            style={{
              transform: `translate3d(${pillStyle.x}px, 0, 0)`,
              width: `${pillStyle.width}px`,
              height: `${pillStyle.height}px`,
              opacity: pillStyle.ready ? 1 : 0,
            }}
            aria-hidden="true"
          />

          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.value}
                ref={(el) => {
                  tabRefs.current[item.value] = el;
                }}
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

        {/* Subtle Vertical Divider */}
        <div className="dock-divider" aria-hidden="true" />

        {/* Visually Integrated Refresh Action with Vertical Icon & Label */}
        <button
          type="button"
          className="dock-integrated-refresh-btn"
          aria-label="Refresh telemetry"
          title="Refresh telemetry"
          onClick={onRefresh}
          disabled={loading}
        >
          <span className="tab-icon">
            <RefreshCw size={20} strokeWidth={2} className={loading ? 'btn-spin' : ''} />
          </span>
          <span className="tab-label">Refresh</span>
        </button>
      </div>
    </nav>
  );
});

BottomNavDock.displayName = 'BottomNavDock';
