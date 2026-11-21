import React, { useState, useMemo } from 'react';
import { HelpCircle, Search, X } from 'lucide-react';
import { getFlagUrl } from '../utils/countryFlags';
import { DistributionMap } from '../types/telemetry';

interface BreakdownCardProps {
  title: string;
  tooltip?: string;
  data: DistributionMap | undefined;
  isCountry?: boolean;
  barColor?: string;
  placeholder?: string;
}

export const BreakdownCard: React.FC<BreakdownCardProps> = ({
  title,
  tooltip,
  data,
  isCountry = false,
  barColor = 'var(--bar-fill)',
  placeholder = 'Search...',
}) => {
  const [query, setQuery] = useState('');

  const sortedEntries = useMemo(() => {
    return Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const total = useMemo(() => {
    return sortedEntries.reduce((acc, curr) => acc + curr[1], 0);
  }, [sortedEntries]);

  const maxVal = useMemo(() => {
    return sortedEntries[0] ? sortedEntries[0][1] : 1;
  }, [sortedEntries]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedEntries;
    return sortedEntries.filter(([k]) => k.toLowerCase().includes(q));
  }, [sortedEntries, query]);

  return (
    <div className="breakdown-card">
      <div className="breakdown-header">
        <h3 className="breakdown-title">
          <span>{title}</span>
          {tooltip && (
            <span className="info-wrap">
              <button
                type="button"
                className="info-btn"
                aria-label={tooltip}
                tabIndex={0}
              >
                <HelpCircle size={12} />
              </button>
              <span className="info-tooltip" role="tooltip">
                {tooltip}
              </span>
            </span>
          )}
        </h3>

        {/* Clean Native Search Field */}
        <div style={{ maxWidth: '190px', width: '100%' }}>
          <div className="search-field-wrap">
            <Search size={13} className="search-field-icon" aria-hidden="true" />
            <input
              type="text"
              className="search-field-input"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Search ${title}`}
            />
            {query && (
              <button
                type="button"
                className="search-field-clear"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="breakdown-list">
        {!filteredEntries.length ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', padding: '16px', textAlign: 'center' }}>
            {query ? 'No matching entries found' : 'No telemetry data recorded'}
          </div>
        ) : (
          filteredEntries.map(([name, count]) => {
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
