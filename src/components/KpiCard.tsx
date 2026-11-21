import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass?: string;
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
  badge,
}) => {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon-top ${colorClass}`}>
        {icon}
        {badge && (
          <span className={`badge-pill badge-${badge.variant || 'blue'}`}>
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
        </div>
      </div>
    </div>
  );
};
