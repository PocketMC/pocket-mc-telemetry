import React from 'react';
import { Glass } from 'glisse';

interface SectionCardProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  iconColor?: 'blue' | 'green' | 'purple';
  insight?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  id,
  title,
  icon,
  iconColor = 'blue',
  insight,
  action,
  children,
}) => {
  return (
    <Glass className="section-card" id={id}>
      <div className="section-header">
        <div className="section-title-wrap">
          <div className={`section-icon-badge section-icon-${iconColor}`}>
            {icon}
          </div>
          <div className="section-header-text">
            <h2 className="section-title">{title}</h2>
            {insight && <div className="insight-text">{insight}</div>}
          </div>
        </div>

        {action && <div className="section-action-wrap">{action}</div>}
      </div>

      {children}
    </Glass>
  );
};
