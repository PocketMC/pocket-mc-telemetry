import React, { useEffect, useRef } from 'react';
import type { TelemetryStats } from '../types/telemetry';
import { COUNTRY_MAP, getFlagUrl } from '../utils/countryFlags';

interface TelemetryWorldMapProps {
  stats: TelemetryStats | null;
  theme: 'light' | 'dark';
  height?: string | number;
}

interface MapMarker {
  name: string;
  iso: string;
  coords: [number, number];
  activeCount?: number;
  isLive?: boolean;
  isInstalledOnly?: boolean;
  style?: {
    initial: {
      fill: string;
      stroke: string;
      strokeWidth: number;
      r: number;
    };
    hover: {
      fill: string;
      stroke: string;
      strokeWidth: number;
      r: number;
    };
  };
}

export const TelemetryWorldMap: React.FC<TelemetryWorldMapProps> = ({
  stats,
  theme,
  height = 480,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const jsVectorMap = (window as any).jsVectorMap;
    if (!jsVectorMap) {
      console.warn('jsVectorMap library is not loaded on window.');
      return;
    }

    const isDark = theme === 'dark';

    // Calculate aggregated lookups
    const regionData: Record<string, number> = {};
    const activeByIso: Record<string, number> = {};

    for (const [country, count] of Object.entries(stats?.installLocationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      if (match?.iso) {
        regionData[match.iso] = (regionData[match.iso] || 0) + (Number(count) || 0);
      }
    }

    for (const [country, count] of Object.entries(stats?.locationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      if (match?.iso) {
        activeByIso[match.iso] = (activeByIso[match.iso] || 0) + (Number(count) || 0);
      }
    }

    const markers: MapMarker[] = [];
    const plottedIsos = new Set<string>();

    // 1. Live Active Markers (Cyan / Sky)
    for (const [country, count] of Object.entries(stats?.locationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      if (match?.iso && match.coords && !plottedIsos.has(match.iso)) {
        plottedIsos.add(match.iso);
        const totalActive = activeByIso[match.iso] || Number(count) || 0;
        markers.push({
          name: country,
          iso: match.iso,
          coords: match.coords,
          activeCount: totalActive,
          isLive: true,
          style: {
            initial: {
              fill: isDark ? '#38bdf8' : '#0088ff',
              stroke: '#ffffff',
              strokeWidth: 1.5,
              r: 4.5,
            },
            hover: {
              fill: isDark ? '#7dd3fc' : '#0077e6',
              stroke: '#ffffff',
              strokeWidth: 2,
              r: 6,
            },
          },
        });
      }
    }

    // 2. Registered Install Markers (Emerald / Green)
    for (const [country] of Object.entries(stats?.installLocationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      if (match?.iso && match.coords && !plottedIsos.has(match.iso)) {
        plottedIsos.add(match.iso);
        markers.push({
          name: country,
          iso: match.iso,
          coords: match.coords,
          isInstalledOnly: true,
          style: {
            initial: {
              fill: isDark ? '#30d158' : '#34c759',
              stroke: isDark ? '#141414' : '#ffffff',
              strokeWidth: 1,
              r: 3.5,
            },
            hover: {
              fill: isDark ? '#4ade80' : '#15803d',
              stroke: '#ffffff',
              strokeWidth: 1.5,
              r: 5,
            },
          },
        });
      }
    }

    // If map already initialized, just update markers
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.removeMarkers();
        mapInstanceRef.current.addMarkers(markers);
        return;
      } catch (err) {
        console.warn('Failed to update markers, re-initializing map', err);
      }
    }

    // Clean container before creating new instance
    containerRef.current.innerHTML = '';

    try {
      mapInstanceRef.current = new jsVectorMap({
        selector: containerRef.current,
        map: 'world',
        backgroundColor: 'transparent',
        zoomOnScroll: true,
        zoomButtons: false,
        draggable: true,
        bindTouchEvents: true,

        regionStyle: {
          initial: {
            fill: isDark ? '#1a1d26' : '#e2e8f0',
            stroke: isDark ? '#262a38' : '#cbd5e1',
            strokeWidth: 0.5,
            fillOpacity: 1,
          },
          hover: {
            fill: isDark ? '#292e3d' : '#cbd5e1',
            cursor: 'pointer',
          },
        },

        markers: markers,
        markerStyle: {
          initial: {
            fill: isDark ? '#38bdf8' : '#0088ff',
            stroke: '#ffffff',
            strokeWidth: 1.5,
            r: 4,
          },
          hover: {
            stroke: '#ffffff',
            strokeWidth: 2,
            r: 6,
          },
        },

        onMarkerTooltipShow(_event: any, tooltip: any, index: number) {
          const marker = markers[index];
          if (!marker) return;
          const countryName = marker.name;
          const iso = marker.iso;
          const installs =
            (iso && regionData[iso]) ||
            (stats?.installLocationDistribution || {})[countryName] ||
            0;
          const activeCount =
            (iso && activeByIso[iso]) ||
            (stats?.locationDistribution || {})[countryName] ||
            marker.activeCount ||
            0;
          const flag = getFlagUrl(countryName);
          const flagHtml = flag
            ? `<img src="${flag}" width="20" height="15" alt="${countryName} flag" style="border-radius:2px;vertical-align:middle;display:inline-block;" />`
            : '';

          tooltip.text(
            `<div style="display:flex;align-items:center;gap:7px;font-weight:600;margin-bottom:4px;">
              ${flagHtml} <span>${countryName}</span>
             </div>
             <div style="font-size:12px;color:var(--text-secondary);">
               Active Users: <strong style="color:var(--accent-blue);">${activeCount.toLocaleString()}</strong>
             </div>
             <div style="font-size:12px;color:var(--text-secondary);">
               Total Installs: <strong style="color:var(--accent-green);">${installs.toLocaleString()}</strong>
             </div>`,
            true
          );
        },
      });
    } catch (e) {
      console.error('Failed to construct jsVectorMap', e);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy?.();
        } catch (_) {}
        mapInstanceRef.current = null;
      }
    };
  }, [stats, theme]);

  return (
    <div className="map-container-box" style={{ height }}>
      <div ref={containerRef} id="world-map" style={{ width: '100%', height: '100%' }} />

      <div className="map-legend-overlay">
        <div className="legend-item">
          <span className="legend-marker marker-live" />
          <span>Active Now</span>
        </div>
        <div className="legend-item">
          <span className="legend-marker marker-installed" />
          <span>Registered Installs</span>
        </div>
      </div>
    </div>
  );
};
