import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { TelemetryWorldMap } from './TelemetryWorldMap';
import type { TelemetryStats } from '../types/telemetry';

interface FullscreenHeatmapProps {
  stats: TelemetryStats | null;
  theme: 'light' | 'dark';
  onBack: () => void;
}

export const FullscreenHeatmap: React.FC<FullscreenHeatmapProps> = ({
  stats,
  theme,
  onBack,
}) => {
  return (
    <div id="heatmap-container" style={{ position: 'fixed', inset: 0, zIndex: 10, width: '100vw', height: '100vh', background: 'var(--bg-page)' }}>
      <div className="overlay-ui">
        <button
          type="button"
          className="btn-surface"
          onClick={onBack}
          aria-label="Back to Dashboard"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div style={{ width: '100%', height: '100%' }}>
        <TelemetryWorldMap stats={stats} theme={theme} height="100%" />
      </div>
    </div>
  );
};
