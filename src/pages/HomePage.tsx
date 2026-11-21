import React, { useMemo } from 'react';
import { Download, Users, UserX, Globe } from 'lucide-react';
import { TelemetryStats } from '../types/telemetry';
import { SectionCard } from '../components/SectionCard';
import { KpiCard } from '../components/KpiCard';
import { BreakdownCard } from '../components/BreakdownCard';

interface HomePageProps {
  data: TelemetryStats | null;
}

export const HomePage: React.FC<HomePageProps> = ({ data }) => {
  const fmt = (n?: number | null) => (n == null ? '-' : n.toLocaleString());

  const activeUsers7d = useMemo(() => {
    const open = Number(data?.openClients) || 0;
    const raw7d = data?.activeUsers7d !== undefined ? Number(data.activeUsers7d) : open;
    return Math.max(raw7d, open);
  }, [data]);

  const totalCountries = Object.keys(data?.installLocationDistribution || {}).length;

  return (
    <SectionCard
      id="section-installs"
      title="Installations & User Base"
      icon={<Download size={18} />}
      iconColor="green"
    >
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <KpiCard
          value={fmt(data?.totalInstalls)}
          label="Total Installs"
          colorClass="text-green"
          icon={<Download size={18} />}
        />
        <KpiCard
          value={fmt(activeUsers7d)}
          label="Active Users (7D)"
          colorClass="text-blue"
          icon={<Users size={18} />}
        />
        <KpiCard
          value={fmt(data?.inactiveUsers7d)}
          label="Inactive Users"
          colorClass="text-slate"
          icon={<UserX size={18} />}
        />
        <KpiCard
          value={fmt(totalCountries)}
          label="Countries Reached"
          colorClass="text-blue"
          icon={<Globe size={18} />}
        />
      </div>

      {/* Distribution Breakdowns Grid */}
      <div className="breakdown-grid">
        <BreakdownCard
          title="Install Versions"
          data={data?.installVersionDistribution}
        />
        <BreakdownCard
          title="Install Locations"
          data={data?.installLocationDistribution}
          isCountry
        />
      </div>
    </SectionCard>
  );
};
