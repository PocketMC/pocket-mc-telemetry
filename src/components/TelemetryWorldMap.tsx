import React, { useEffect, useRef } from 'react';
import type { TelemetryStats } from '../types/telemetry';
import { COUNTRY_MAP, getFlagUrl } from '../utils/countryFlags';

interface TelemetryWorldMapProps {
  stats: TelemetryStats | null;
  theme: 'light' | 'dark';
  height?: string | number;
  isFullscreen?: boolean;
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
  isFullscreen = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const prevThemeRef = useRef<'light' | 'dark'>(theme);
  const [mapLibReady, setMapLibReady] = React.useState<boolean>(
    () => typeof window !== 'undefined' && Boolean((window as any).jsVectorMap)
  );
  const [viewportCategory, setViewportCategory] = React.useState<'small' | 'medium' | 'large'>(() => {
    if (typeof window === 'undefined') return 'large';
    if (window.innerWidth <= 480) return 'small';
    if (window.innerWidth <= 768) return 'medium';
    return 'large';
  });
  const prevViewportRef = useRef<'small' | 'medium' | 'large'>(viewportCategory);

  // Auto-resize map on window resize & update responsive dot scaling
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const cat = w <= 480 ? 'small' : w <= 768 ? 'medium' : 'large';
      setViewportCategory((prev) => (prev !== cat ? cat : prev));
      if (mapInstanceRef.current?.updateSize) {
        mapInstanceRef.current.updateSize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Poll for deferred jsVectorMap script if not immediately loaded
  useEffect(() => {
    if (mapLibReady) return;

    const interval = setInterval(() => {
      if ((window as any).jsVectorMap) {
        setMapLibReady(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [mapLibReady]);

  useEffect(() => {
    if (!containerRef.current || !mapLibReady) return;

    const jsVectorMap = (window as any).jsVectorMap;
    if (!jsVectorMap) {
      console.warn('jsVectorMap library is not loaded on window.');
      return;
    }

    const isDark = theme === 'dark';

    // Build reverse ISO to canonical Country Name lookup
    const ISO_TO_COUNTRY: Record<string, string> = {};
    for (const [name, meta] of Object.entries(COUNTRY_MAP)) {
      if (meta?.iso && !ISO_TO_COUNTRY[meta.iso.toUpperCase()]) {
        ISO_TO_COUNTRY[meta.iso.toUpperCase()] = name;
      }
    }

    // Calculate aggregated lookups normalized by uppercase ISO
    const regionData: Record<string, number> = {};
    const activeByIso: Record<string, number> = {};

    for (const [country, count] of Object.entries(stats?.installLocationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      if (match?.iso) {
        const iso = match.iso.toUpperCase();
        regionData[iso] = (regionData[iso] || 0) + (Number(count) || 0);
      }
    }

    for (const [country, count] of Object.entries(stats?.locationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      if (match?.iso) {
        const iso = match.iso.toUpperCase();
        activeByIso[iso] = (activeByIso[iso] || 0) + (Number(count) || 0);
      }
    }

    // Sizing scaled dynamically to prevent thick bloated dots on mobile viewports
    const isSmall = viewportCategory === 'small';
    const isMedium = viewportCategory === 'medium';

    const liveR = isSmall ? 2.5 : isMedium ? 3.0 : 3.8;
    const liveStroke = isSmall ? 0.75 : isMedium ? 0.9 : 1.2;
    const liveHoverR = isSmall ? 3.8 : isMedium ? 4.5 : 5.5;

    const installR = isSmall ? 1.8 : isMedium ? 2.2 : 2.8;
    const installStroke = isSmall ? 0.5 : isMedium ? 0.7 : 0.9;
    const installHoverR = isSmall ? 2.8 : isMedium ? 3.4 : 4.2;

    const markers: MapMarker[] = [];
    const plottedIsos = new Set<string>();

    // 1. Open Clients Markers (Green dots)
    for (const [country, count] of Object.entries(stats?.locationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      if (match?.iso && match.coords && !plottedIsos.has(match.iso.toUpperCase())) {
        const iso = match.iso.toUpperCase();
        plottedIsos.add(iso);
        const totalActive = activeByIso[iso] || Number(count) || 0;
        markers.push({
          name: country,
          iso,
          coords: match.coords,
          activeCount: totalActive,
          isLive: true,
          style: {
            initial: {
              fill: isDark ? '#22c55e' : '#16a34a',
              stroke: isDark ? '#052e16' : '#ffffff',
              strokeWidth: liveStroke,
              r: liveR,
            },
            hover: {
              fill: isDark ? '#4ade80' : '#22c55e',
              stroke: '#ffffff',
              strokeWidth: liveStroke + 0.4,
              r: liveHoverR,
            },
          },
        });
      }
    }

    // 2. Total Installs Markers (White dot on dark theme, Black dot on light theme)
    for (const [country] of Object.entries(stats?.installLocationDistribution || {})) {
      const match = COUNTRY_MAP[country];
      if (match?.iso && match.coords && !plottedIsos.has(match.iso.toUpperCase())) {
        const iso = match.iso.toUpperCase();
        plottedIsos.add(iso);
        markers.push({
          name: country,
          iso,
          coords: match.coords,
          isInstalledOnly: true,
          style: {
            initial: {
              fill: isDark ? '#ffffff' : '#0f172a',
              stroke: isDark ? '#000000' : '#ffffff',
              strokeWidth: installStroke,
              r: installR,
            },
            hover: {
              fill: isDark ? '#f1f5f9' : '#334155',
              stroke: isDark ? '#ffffff' : '#000000',
              strokeWidth: installStroke + 0.4,
              r: installHoverR,
            },
          },
        });
      }
    }

    // If map already initialized and neither theme nor viewport scale changed, just update markers
    if (mapInstanceRef.current && prevThemeRef.current === theme && prevViewportRef.current === viewportCategory) {
      try {
        mapInstanceRef.current.removeMarkers();
        mapInstanceRef.current.addMarkers(markers);
        return;
      } catch (err) {
        console.warn('Failed to update markers, re-initializing map', err);
      }
    }

    prevThemeRef.current = theme;
    prevViewportRef.current = viewportCategory;

    // Clean container before creating new instance
    containerRef.current.innerHTML = '';

    // Reusable, non-bloated tooltip content generator for countries & markers
    const renderTooltipHtml = (rawName: string, rawIso?: string) => {
      const upperIso = (rawIso || (rawName.length === 2 ? rawName : COUNTRY_MAP[rawName]?.iso) || '').toUpperCase();
      const countryName = (upperIso && ISO_TO_COUNTRY[upperIso]) || rawName;
      const installs =
        (upperIso && regionData[upperIso]) ||
        (stats?.installLocationDistribution || {})[countryName] ||
        (rawName && (stats?.installLocationDistribution || {})[rawName]) ||
        0;
      const activeCount =
        (upperIso && activeByIso[upperIso]) ||
        (stats?.locationDistribution || {})[countryName] ||
        (rawName && (stats?.locationDistribution || {})[rawName]) ||
        0;
      const flag = getFlagUrl(countryName) || (upperIso ? getFlagUrl(upperIso) : null);
      const flagHtml = flag
        ? `<img src="${flag}" width="20" height="15" alt="" style="border-radius:2px;vertical-align:middle;display:inline-block;margin-right:6px;" />`
        : '';

      return `<div style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:6px;font-size:13px;color:var(--text-primary);">
        ${flagHtml}<span>${countryName}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;gap:14px;color:var(--text-secondary);">
          <span>Open Clients:</span>
          <strong style="color:var(--accent-green);font-weight:600;">${activeCount.toLocaleString()}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;gap:14px;color:var(--text-secondary);">
          <span>Total Installs:</span>
          <strong style="color:var(--text-primary);font-weight:600;">${installs.toLocaleString()}</strong>
        </div>
      </div>`;
    };

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
            fill: isDark ? '#121216' : '#dbe2ef',
            stroke: isDark ? '#1f1f26' : '#cbd5e1',
            strokeWidth: 0.5,
            fillOpacity: 1,
          },
          hover: {
            fill: isDark ? '#1e2230' : '#c7d2e5',
            cursor: 'pointer',
          },
        },

        markers: markers,
        markerStyle: {
          initial: {
            fill: isDark ? '#22c55e' : '#16a34a',
            stroke: isDark ? '#000000' : '#ffffff',
            strokeWidth: liveStroke,
            r: liveR,
          },
          hover: {
            stroke: '#ffffff',
            strokeWidth: liveStroke + 0.4,
            r: liveHoverR,
          },
        },

        onMarkerTooltipShow(_event: any, tooltip: any, index: number) {
          const marker = markers[index];
          if (!marker) return;
          tooltip.text(renderTooltipHtml(marker.name, marker.iso), true);
        },

        onRegionTooltipShow(_event: any, tooltip: any, code: string) {
          tooltip.text(renderTooltipHtml(code, code), true);
        },
      });
    } catch (e) {
      console.error('Failed to construct jsVectorMap', e);
    }

    // Dismiss any stuck tooltips when clicking/tapping outside
    const handleMapPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || (!target.classList.contains('jvm-region') && !target.classList.contains('jvm-marker'))) {
        document.querySelectorAll('.jvm-tooltip').forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });
      }
    };
    window.addEventListener('pointerdown', handleMapPointerDown);

    return () => {
      window.removeEventListener('pointerdown', handleMapPointerDown);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy?.();
        } catch (_) {}
        mapInstanceRef.current = null;
      }
      // Ensure all jvm-tooltip DOM elements are completely removed
      document.querySelectorAll('.jvm-tooltip').forEach((el) => el.remove());
    };
  }, [stats, theme, viewportCategory]);

  return (
    <div
      className={`map-container-box ${isFullscreen ? 'is-fullscreen' : ''}`}
      style={isFullscreen ? { height: '100%', width: '100%' } : { height }}
    >
      <div
        ref={containerRef}
        id="world-map"
        style={{ width: '100%', height: '100%' }}
        onMouseLeave={() => {
          document.querySelectorAll('.jvm-tooltip').forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
        }}
      />
    </div>
  );
};
