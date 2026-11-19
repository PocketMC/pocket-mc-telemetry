import React from 'react';
import { Glass } from 'glisse';
import { HelpCircle } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass?: string;
  tooltip?: string;
  badge?: {
    text: string;
    variant?: 'green' | 'blue' | 'purple';
  };
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  icon,
  colorClass = 'text-blue',
  tooltip,
  badge,
}) => {
  return (
    <Glass className="kpi-card">
      <div className={`kpi-icon-top ${colorClass}`}>
        {icon}
        {badge && (
          <span className={`badge-glass badge-${badge.variant || 'blue'}`}>
            {badge.text}
          </span>
        )}
      </div>

      <div className="kpi-body">
        <div className={`kpi-value ${colorClass}`}>
          {value !== undefined && value !== null ? value : '-'}
        </div>
        <div className="kpi-label">
          <span>{label}</span>
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
        </div>
      </div>
    </Glass>
  );
};
