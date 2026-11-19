import React from 'react';
import { SegmentedControl } from 'glisse';
import { TimeframePeriod } from '../types/telemetry';

interface TimeframeControlProps {
  period: TimeframePeriod;
  onChange: (period: TimeframePeriod) => void;
}

export const TimeframeControl: React.FC<TimeframeControlProps> = ({
  period,
  onChange,
}) => {
  const items = [
    { value: '7d', label: '7 Days' },
    { value: '24h', label: '24 Hours' },
    { value: '30d', label: '30 Days' },
    { value: 'total', label: 'All Time' },
  ];

  return (
    <div className="time-filter-wrap">
      <SegmentedControl
        items={items}
        value={period}
        onValueChange={(val) => onChange(val as TimeframePeriod)}
        aria-label="Filter active timeframe"
      />
    </div>
  );
};
