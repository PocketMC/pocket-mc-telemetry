import React from 'react';
import { Globe, Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TelemetryStats } from '../types/telemetry';
import { SectionCard } from '../components/SectionCard';
import { TelemetryWorldMap } from '../components/TelemetryWorldMap';

interface MapPageProps {
  stats: TelemetryStats | null;
  theme: 'light' | 'dark';
}

export const MapPage: React.FC<MapPageProps> = ({ stats, theme }) => {
  const navigate = useNavigate();

  return (
    <SectionCard
      id="section-map"
      title="Global Activity Map"
      icon={<Globe size={18} />}
      iconColor="blue"
      action={
        <button
          type="button"
          className="btn-surface"
          onClick={() => navigate('/heatmap')}
          aria-label="Open fullscreen map view"
        >
          <Maximize2 size={14} />
          <span>Fullscreen Heatmap</span>
        </button>
      }
    >
      <TelemetryWorldMap stats={stats} theme={theme} />
      <div className="map-note">
        Note: Markers represent country-level telemetry coordinates for privacy. Exact coordinates are never collected.
      </div>
    </SectionCard>
  );
};
