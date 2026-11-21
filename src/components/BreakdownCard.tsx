import React, { useMemo } from 'react';
import { getFlagUrl } from '../utils/countryFlags';
import { DistributionMap } from '../types/telemetry';

interface BreakdownCardProps {
  title: string;
  data: DistributionMap | undefined;
  isCountry?: boolean;
  barColor?: string;
}

export const BreakdownCard: React.FC<BreakdownCardProps> = ({
  title,
  data,
  isCountry = false,
  barColor = 'var(--bar-fill)',
}) => {
  const sortedEntries = useMemo(() => {
    return Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const total = useMemo(() => {
    return sortedEntries.reduce((acc, curr) => acc + curr[1], 0);
  }, [sortedEntries]);

  const maxVal = useMemo(() => {
    return sortedEntries[0] ? sortedEntries[0][1] : 1;
  }, [sortedEntries]);

  return (
    <div className="breakdown-card">
      <div className="breakdown-header">
        <h3 className="breakdown-title">
          <span>{title}</span>
        </h3>
      </div>

      <div className="breakdown-list">
        {!sortedEntries.length ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', padding: '16px', textAlign: 'center' }}>
            No telemetry data recorded
          </div>
        ) : (
          sortedEntries.map(([name, count]) => {
            const sharePct = total ? ((count / total) * 100).toFixed(1) : '0.0';
            const barFillPct = Math.min(100, Math.max(5, (count / maxVal) * 100)).toFixed(1);
            const flagUrl = isCountry ? getFlagUrl(name) : null;

            return (
              <div key={name} className="breakdown-row">
                <div className="breakdown-label">
                  {isCountry && (
                    flagUrl ? (
                      <img
                        className="flag-icon"
                        src={flagUrl}
                        alt={`${name} flag`}
                        width={18}
                        height={13}
                        loading="lazy"
                      />
                    ) : (
                      <span className="flag-icon" style={{ background: 'var(--text-muted)', display: 'inline-block' }} />
                    )
                  )}
                  <span title={name}>{name}</span>
                </div>

                <div className="breakdown-track" aria-hidden="true">
                  <div
                    className="breakdown-fill"
                    style={{
                      width: `${barFillPct}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>

                <div className="breakdown-value">
                  {count.toLocaleString()}
                </div>

                <div className="badge-pill" style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                  {sharePct}%
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
