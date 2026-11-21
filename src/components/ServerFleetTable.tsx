import React, { useMemo } from 'react';
import { Server } from 'lucide-react';
import { DistributionMap } from '../types/telemetry';

interface ServerFleetTableProps {
  data: DistributionMap | undefined;
}

function getServerTypeLogo(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('paper')) return 'flavors/paper.svg';
  if (t.includes('fabric')) return 'flavors/fabric.png';
  if (t.includes('neoforge') || t.includes('neo')) return 'flavors/neoforge.png';
  if (t.includes('forge')) return 'flavors/forge.png';
  if (t.includes('spigot')) return 'flavors/spigot.svg';
  if (t.includes('purpur')) return 'flavors/purpur.svg';
  if (t.includes('bedrock') || t.includes('bds')) return 'flavors/bedrock.png';
  if (t.includes('vanilla')) return 'flavors/vanilla.png';
  return '';
}

export const ServerFleetTable: React.FC<ServerFleetTableProps> = ({ data }) => {
  const sortedEntries = useMemo(() => {
    return Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const total = useMemo(() => {
    return sortedEntries.reduce((acc, curr) => acc + curr[1], 0);
  }, [sortedEntries]);

  const maxVal = useMemo(() => {
    return sortedEntries[0] ? sortedEntries[0][1] : 1;
  }, [sortedEntries]);

  if (!sortedEntries.length) {
    return (
      <div className="server-types-empty" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No server engine telemetry recorded
      </div>
    );
  }

  return (
    <div className="server-types-container">
      {sortedEntries.map(([type, count]) => {
        const sharePct = total ? ((count / total) * 100).toFixed(1) : '0.0';
        const barFillPct = Math.min(100, Math.max(6, (count / maxVal) * 100)).toFixed(1);
        const logoSrc = getServerTypeLogo(type);

        return (
          <div key={type} className="server-type-row">
            <div className="server-type-brand">
              {logoSrc ? (
                <img
                  className="server-logo"
                  src={logoSrc}
                  alt={`${type} logo`}
                  width={24}
                  height={24}
                  loading="lazy"
                />
              ) : (
                <Server size={20} className="server-logo" />
              )}
              <span className="server-type-name">{type}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, maxWidth: '280px', marginLeft: 'auto' }}>
              <div className="breakdown-track" style={{ flex: 1 }} aria-hidden="true">
                <div
                  className="breakdown-fill"
                  style={{ width: `${barFillPct}%`, backgroundColor: 'var(--accent-purple)' }}
                />
              </div>
              <div className="server-type-count">{count.toLocaleString()}</div>
              <div className="badge-pill" style={{ color: 'var(--accent-purple)', fontSize: '11px' }}>
                {sharePct}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
