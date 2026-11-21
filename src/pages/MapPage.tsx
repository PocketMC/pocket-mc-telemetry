import React from 'react';
import type { TelemetryStats } from '../types/telemetry';
import { TelemetryWorldMap } from '../components/TelemetryWorldMap';

interface MapPageProps {
  stats: TelemetryStats | null;
  theme: 'light' | 'dark';
}

export const MapPage: React.FC<MapPageProps> = ({ stats, theme }) => {
  return (
    <div className="fullscreen-map-page">
      <TelemetryWorldMap stats={stats} theme={theme} height="100%" isFullscreen />
    </div>
  );
};
