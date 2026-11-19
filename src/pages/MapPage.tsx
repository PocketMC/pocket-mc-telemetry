import React from 'react';
import { Globe, Maximize2 } from 'lucide-react';
import { Button } from 'glisse';
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
  const totalCountries = Object.keys(stats?.installLocationDistribution || {}).length;

  return (
    <SectionCard
      id="section-map"
      title="Global Activity Map"
      icon={<Globe size={18} />}
      iconColor="blue"
      insight={<span>{totalCountries} countries reached with active installations worldwide</span>}
      action={
        <Button
          variant="glass"
          onClick={() => navigate('/heatmap')}
          icon={<Maximize2 size={14} />}
          aria-label="Open fullscreen map view"
        >
          Fullscreen Heatmap
        </Button>
      }
    >
      <TelemetryWorldMap stats={stats} theme={theme} />
      <div className="map-note">
        Note: Markers represent country-level telemetry coordinates for privacy. Exact coordinates are never collected.
      </div>
    </SectionCard>
  );
};
