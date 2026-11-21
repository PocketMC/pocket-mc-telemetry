import React from 'react';

interface SectionCardProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  iconColor?: 'blue' | 'green' | 'purple';
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  id,
  title,
  icon,
  iconColor = 'blue',
  action,
  children,
}) => {
  return (
    <section className="section-card" id={id}>
      <div className="section-header">
        <div className="section-title-wrap">
          <div className={`section-icon-badge section-icon-${iconColor}`}>
            {icon}
          </div>
          <div className="section-header-text">
            <h2 className="section-title">{title}</h2>
          </div>
        </div>

        {action && <div className="section-action-wrap">{action}</div>}
      </div>

      {children}
    </section>
  );
};
