import React from 'react';
import { Server, PlusCircle, Trash2, Clock } from 'lucide-react';
import { TelemetryStats } from '../types/telemetry';
import { SectionCard } from '../components/SectionCard';
import { KpiCard } from '../components/KpiCard';
import { ServerFleetTable } from '../components/ServerFleetTable';

interface ServersPageProps {
  data: TelemetryStats | null;
}

export const ServersPage: React.FC<ServersPageProps> = ({ data }) => {
  const fmt = (n?: number | null) => (n == null ? '-' : n.toLocaleString());

  return (
    <SectionCard
      id="section-servers"
      title="Live PocketMC Servers Fleet"
      icon={<Server size={18} />}
      iconColor="purple"
      insight={
        <span>
          <strong>{fmt(data?.totalRunningServers)}</strong> Minecraft servers actively hosted
          via PocketMC right now
        </span>
      }
    >
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <KpiCard
          value={fmt(data?.totalRunningServers)}
          label="Total Running Servers"
          colorClass="text-purple"
          icon={<Server size={18} />}
          tooltip="Currently running Minecraft server instances"
        />
        <KpiCard
          value={fmt(data?.totalServersCreated)}
          label="Total Servers Created"
          colorClass="text-blue"
          icon={<PlusCircle size={18} />}
          tooltip="Cumulative servers created across all instances"
        />
        <KpiCard
          value={fmt(data?.totalServersDeleted)}
          label="Total Servers Deleted"
          colorClass="text-slate"
          icon={<Trash2 size={18} />}
          tooltip="Cumulative servers decommissioned"
        />
        <KpiCard
          value={fmt(data?.globalUptimeHours)}
          label="Global Uptime Hours"
          colorClass="text-purple"
          icon={<Clock size={18} />}
          tooltip="Cumulative server uptime across all hosts"
        />
      </div>

      {/* Server Fleet Table with official flavor logos */}
      <ServerFleetTable data={data?.serverTypeDistribution} />
    </SectionCard>
  );
};
