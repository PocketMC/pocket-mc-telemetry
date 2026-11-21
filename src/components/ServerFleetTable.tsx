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
      <div className="breakdown-card">
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
          No server engine telemetry recorded
        </div>
      </div>
    );
  }

  return (
    <div className="breakdown-card">
      <div className="breakdown-header">
        <h3 className="breakdown-title">
          <span>Server Engine Distribution</span>
        </h3>
      </div>

      <div className="breakdown-list">
        {sortedEntries.map(([type, count]) => {
          const sharePct = total ? ((count / total) * 100).toFixed(1) : '0.0';
          const barFillPct = Math.min(100, Math.max(6, (count / maxVal) * 100)).toFixed(1);
          const logoSrc = getServerTypeLogo(type);

          return (
            <div key={type} className="breakdown-row">
              <div className="breakdown-label" style={{ width: '150px', minWidth: '150px' }}>
                {logoSrc ? (
                  <img
                    className="server-logo"
                    src={logoSrc}
                    alt={`${type} logo`}
                    width={20}
                    height={20}
                    loading="lazy"
                  />
                ) : (
                  <Server size={18} className="server-logo" />
                )}
                <span title={type}>{type}</span>
              </div>

              <div className="breakdown-track" aria-hidden="true">
                <div
                  className="breakdown-fill"
                  style={{ width: `${barFillPct}%`, backgroundColor: 'var(--bar-fill)' }}
                />
              </div>

              <div className="breakdown-value">{count.toLocaleString()}</div>

              <div className="badge-pill" style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                {sharePct}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
