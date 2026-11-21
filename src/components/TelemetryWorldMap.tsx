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
  const statsRef = useRef<TelemetryStats | null>(stats);
  statsRef.current = stats;
  const prevThemeRef = useRef<'light' | 'dark'>(theme);
  const checkMapLibReady = () => {
    if (typeof window === 'undefined') return false;
    const jvm = (window as any).jsVectorMap;
    if (!jvm || typeof jvm !== 'function') return false;
    return Boolean(
      (window as any)._jvmWorldLoaded ||
      jvm.maps?.world ||
      jvm.maps ||
      (jvm.prototype && typeof jvm.prototype.addMarkers === 'function')
    );
  };

  const [mapLibReady, setMapLibReady] = React.useState<boolean>(checkMapLibReady);
  const [loadError, setLoadError] = React.useState<string | null>(null);
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

  // Poll for both jsVectorMap and its 'world' map definition with timeout handling
  useEffect(() => {
    if (mapLibReady) return;

    if (checkMapLibReady()) {
      setMapLibReady(true);
      setLoadError(null);
      return;
    }

    let attempts = 0;
    const maxAttempts = 80;

    const interval = setInterval(() => {
      attempts++;
      if (checkMapLibReady()) {
        setMapLibReady(true);
        setLoadError(null);
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        if (typeof (window as any).jsVectorMap === 'function') {
          setMapLibReady(true);
          setLoadError(null);
        } else {
          setLoadError('World map data could not be loaded.');
        }
      }
    }, 40);

    return () => clearInterval(interval);
  }, [mapLibReady]);

  // Isolate mobile map gestures: prevent pinch-zoom and pan from zooming/scrolling the website
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let isMultiTouch = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        isMultiTouch = true;
      } else if (e.touches.length === 1) {
        isMultiTouch = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      // Prevent browser from zooming or scrolling the page viewport
      if (e.cancelable) {
        e.preventDefault();
      }

      // If user drags more than 10px, dismiss tooltip so it doesn't float adrift
      if (e.touches.length === 1 && !isMultiTouch) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 10 || dy > 10) {
          document.querySelectorAll('.jvm-tooltip').forEach((el) => {
            (el as HTMLElement).style.display = 'none';
            el.classList.remove('active');
          });
        }
      }
    };

    const onGesture = (e: Event) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('gesturestart', onGesture, { passive: false });
    container.addEventListener('gesturechange', onGesture, { passive: false });
    container.addEventListener('gestureend', onGesture, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('gesturestart', onGesture);
      container.removeEventListener('gesturechange', onGesture);
      container.removeEventListener('gestureend', onGesture);
    };
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

    const installR = isSmall ? 1.8 : isMedium ? 2.2 : 2.8;
    const installStroke = isSmall ? 0.5 : isMedium ? 0.7 : 0.9;

    const markers: MapMarker[] = [];
    const plottedIsos = new Set<string>();

    // 1. Open Clients Markers (Green dots - visual only, non-interactive)
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
              fill: isDark ? '#22c55e' : '#16a34a',
              stroke: isDark ? '#052e16' : '#ffffff',
              strokeWidth: liveStroke,
              r: liveR,
            },
          },
        });
      }
    }

    // 2. Total Installs Markers (White dot on dark theme, Black dot on light theme - visual only)
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
              fill: isDark ? '#ffffff' : '#0f172a',
              stroke: isDark ? '#000000' : '#ffffff',
              strokeWidth: installStroke,
              r: installR,
            },
          },
        });
      }
    }

    // If map already initialized and neither theme nor viewport scale changed, update markers
    if (mapInstanceRef.current && prevThemeRef.current === theme && prevViewportRef.current === viewportCategory) {
      try {
        if (mapInstanceRef.current._tooltip) {
          const tooltipEl =
            mapInstanceRef.current._tooltip.getElement?.() || mapInstanceRef.current._tooltip._tooltip;
          if (tooltipEl && !document.body.contains(tooltipEl)) {
            document.body.appendChild(tooltipEl);
          }
        }
        mapInstanceRef.current.removeMarkers();
        mapInstanceRef.current.addMarkers(markers);
        return;
      } catch (err) {
        console.warn('Failed to update markers, re-initializing map', err);
      }
    }

    // Always cleanly destroy previous map instance and wipe old tooltips from DOM before creating a new one
    if (mapInstanceRef.current) {
      try {
        const tooltipEl =
          mapInstanceRef.current._tooltip?.getElement?.() || mapInstanceRef.current._tooltip?._tooltip;
        if (tooltipEl && !tooltipEl.parentNode) {
          document.body.appendChild(tooltipEl);
        }
        mapInstanceRef.current.destroy?.();
      } catch (_) {}
      mapInstanceRef.current = null;
    }
    document.querySelectorAll('.jvm-tooltip').forEach((el) => el.remove());
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    prevThemeRef.current = theme;
    prevViewportRef.current = viewportCategory;

    // Reusable, non-bloated tooltip content generator for country regions
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
            fill: isDark ? '#22c55e' : '#16a34a',
            stroke: isDark ? '#000000' : '#ffffff',
            strokeWidth: liveStroke,
            r: liveR,
          },
        },

        onRegionTooltipShow(_event: any, tooltip: any, code: string) {
          const el = tooltip?.getElement?.() || tooltip?._tooltip;
          if (el && !document.body.contains(el)) {
            document.body.appendChild(el);
          }
          tooltip.text(renderTooltipHtml(code, code), true);
        },

        onRegionClick(event: any, code: string) {
          if (!mapInstanceRef.current?._tooltip) return;
          const tooltip = mapInstanceRef.current._tooltip;
          const el = tooltip.getElement?.() || tooltip._tooltip;
          if (el && !document.body.contains(el)) {
            document.body.appendChild(el);
          }
          tooltip.text(renderTooltipHtml(code, code), true);
          tooltip.show();

          const clientX =
            event.clientX ||
            (event.touches && event.touches[0]?.clientX) ||
            (event.changedTouches && event.changedTouches[0]?.clientX);
          const clientY =
            event.clientY ||
            (event.touches && event.touches[0]?.clientY) ||
            (event.changedTouches && event.changedTouches[0]?.clientY);
          const pageX = event.pageX || (clientX ? clientX + window.scrollX : undefined);
          const pageY = event.pageY || (clientY ? clientY + window.scrollY : undefined);

          if (pageX != null && pageY != null && el) {
            const space = 12;
            const rect = el.getBoundingClientRect();
            const tooltipW = rect.width || 190;
            const tooltipH = rect.height || 75;
            let left = pageX - tooltipW / 2;
            let top = pageY - tooltipH - space;
            if (top < 70) top = pageY + space + 10;
            if (left < 10) left = 10;
            if (left + tooltipW > window.innerWidth - 10) {
              left = window.innerWidth - tooltipW - 10;
            }
            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
            el.style.display = 'block';
            el.classList.add('active');
          }
        },
      });

      // Confirm tooltip element is firmly attached to document.body
      if (mapInstanceRef.current?._tooltip) {
        const tooltipEl =
          mapInstanceRef.current._tooltip.getElement?.() || mapInstanceRef.current._tooltip._tooltip;
        if (tooltipEl && !document.body.contains(tooltipEl)) {
          document.body.appendChild(tooltipEl);
        }
      }
    } catch (e) {
      console.error('Failed to construct jsVectorMap', e);
    }

    // Dismiss any stuck tooltips when clicking/tapping outside countries
    const handleMapPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || (!target.classList.contains('jvm-region') && !target.closest('.jvm-tooltip'))) {
        document.querySelectorAll('.jvm-tooltip').forEach((el) => {
          (el as HTMLElement).style.display = 'none';
          el.classList.remove('active');
        });
      }
    };
    window.addEventListener('pointerdown', handleMapPointerDown);

    return () => {
      window.removeEventListener('pointerdown', handleMapPointerDown);
      if (mapInstanceRef.current) {
        try {
          const tooltipEl =
            mapInstanceRef.current._tooltip?.getElement?.() || mapInstanceRef.current._tooltip?._tooltip;
          if (tooltipEl && !tooltipEl.parentNode) {
            document.body.appendChild(tooltipEl);
          }
          mapInstanceRef.current.destroy?.();
        } catch (_) {}
        mapInstanceRef.current = null;
      }
      // Ensure all jvm-tooltip DOM elements are completely removed
      document.querySelectorAll('.jvm-tooltip').forEach((el) => el.remove());
    };
  }, [stats, theme, viewportCategory, mapLibReady]);

  const handleRetryMap = () => {
    setLoadError(null);
    setMapLibReady(false);
    if (!(window as any).jsVectorMap) {
      const s = document.createElement('script');
      s.src = './vendor/jsvectormap.min.js';
      s.onerror = () => {
        s.src = 'https://cdn.jsdelivr.net/npm/jsvectormap@1.7.0/dist/jsvectormap.min.js';
      };
      document.head.appendChild(s);
    }
    if (!(window as any)._jvmWorldLoaded && !(window as any).jsVectorMap?.maps?.world) {
      const s2 = document.createElement('script');
      s2.src = './vendor/world.js';
      s2.onerror = () => {
        s2.src = 'https://cdn.jsdelivr.net/npm/jsvectormap@1.7.0/dist/maps/world.js';
      };
      document.head.appendChild(s2);
    }
  };

  return (
    <div
      className={`map-container-box ${isFullscreen ? 'is-fullscreen' : ''}`}
      style={isFullscreen ? { height: '100%', width: '100%' } : { height }}
    >
      {!mapLibReady && !loadError && (
        <div className="map-loading-overlay">
          <div className="map-loading-spinner" />
          <span className="map-loading-text">Loading Global Map...</span>
        </div>
      )}

      {loadError && (
        <div className="map-error-overlay">
          <p>{loadError}</p>
          <button type="button" className="btn-surface btn-sm" onClick={handleRetryMap}>
            Retry Map
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        id="world-map"
        style={{ width: '100%', height: '100%' }}
        onMouseLeave={() => {
          document.querySelectorAll('.jvm-tooltip').forEach((el) => {
            (el as HTMLElement).style.display = 'none';
            el.classList.remove('active');
          });
        }}
      />
    </div>
  );
};
