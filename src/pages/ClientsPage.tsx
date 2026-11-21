import React from 'react';
import { Activity, Users, Clock, Globe } from 'lucide-react';
import { TelemetryStats } from '../types/telemetry';
import { SectionCard } from '../components/SectionCard';
import { KpiCard } from '../components/KpiCard';
import { BreakdownCard } from '../components/BreakdownCard';

interface ClientsPageProps {
  data: TelemetryStats | null;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ data }) => {
  const fmt = (n?: number | null) => (n == null ? '-' : n.toLocaleString());
  
  const totalClients = data?.openClients;
  const activeUsers = data?.activeUsers;
  const afkClients =
    totalClients != null && activeUsers != null
      ? Math.max(0, totalClients - activeUsers)
      : null;
  const activeCountries = data?.locationDistribution
    ? Object.keys(data.locationDistribution).length
    : null;

  return (
    <SectionCard
      id="section-clients"
      title="Active Clients & Online Population"
      icon={<Activity size={18} />}
      iconColor="blue"
    >
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <KpiCard
          value={fmt(totalClients)}
          label="Total Clients"
          colorClass="text-blue"
          icon={<Activity size={18} />}
        />
        <KpiCard
          value={fmt(activeUsers)}
          label="Online Users"
          colorClass="text-green"
          icon={<Users size={18} />}
        />
        <KpiCard
          value={fmt(afkClients)}
          label="AFK Clients"
          colorClass="text-slate"
          icon={<Clock size={18} />}
        />
        <KpiCard
          value={fmt(activeCountries)}
          label="Active Countries"
          colorClass="text-blue"
          icon={<Globe size={18} />}
        />
      </div>

      {/* Distribution Breakdowns Grid */}
      <div className="breakdown-grid">
        <BreakdownCard
          title="Active Client Versions"
          data={data?.versionDistribution}
        />
        <BreakdownCard
          title="Active Client Locations"
          data={data?.locationDistribution}
          isCountry
        />
      </div>
    </SectionCard>
  );
};
